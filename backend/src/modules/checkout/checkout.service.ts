import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { createHash } from 'crypto';
import { CartRepository } from '../cart/cart.repository';
import {
  CartPricingService,
  RevalidationResult,
} from '../cart/cart-pricing.service';
import { IdempotencyRepository } from '../cart/idempotency.repository';
import { IdempotencyKeyEntity } from '../cart/entities/idempotency-key.entity';
import { OrderEntity } from '../cart/entities/order.entity';
import { OrderStatusHistoryEntity } from '../cart/entities/order-status-history.entity';
import { OrderStatus } from '../cart/enums/order-status.enum';
import { PaymentsRepository } from '../payments/payments.repository';
import { PaymentEntity } from '../payments/entities/payment.entity';
import { PaymentProvider } from '../payments/enums/payment-provider.enum';
import { PaymentStatus } from '../payments/enums/payment-status.enum';
import { PAYMENT_GATEWAY } from '../payments/payos-gateway.interface';
import type { PaymentGateway } from '../payments/payos-gateway.interface';
import { CouponsService } from '../coupons/coupons.service';
import { AddressesService } from '../addresses/addresses.service';
import { AddressEntity } from '../addresses/entities/address.entity';
import { ClockService } from '../../common/clock/clock.service';
import { CreateCheckoutDto } from '../payments/dto/create-checkout.dto';
import { CheckoutResponseDto } from '../payments/dto/checkout-response.dto';
import {
  CHECKOUT_COD_OPERATION,
  CHECKOUT_PAYOS_OPERATION,
} from './checkout.constants';

const NO_COUPON: RevalidationResult = {
  discountAmount: 0,
  couponRemoved: false,
  removedReason: null,
};

@Injectable()
export class CheckoutService {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly cartPricingService: CartPricingService,
    private readonly idempotencyRepository: IdempotencyRepository,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly couponsService: CouponsService,
    private readonly addressesService: AddressesService,
    private readonly clock: ClockService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  /**
   * COD confirms payment synchronously — no external gateway call — so the
   * entire flow (cart -> PAID Order -> PAID Payment -> Coupon redemption)
   * runs in a SINGLE transaction. This IS the order-confirmation transition
   * for COD (see plan): Coupon usage finalizes here, not anywhere else.
   */
  async placeCodOrder(
    userId: string,
    dto: CreateCheckoutDto,
    idempotencyKey: string,
  ): Promise<CheckoutResponseDto> {
    const requestHash = this.hashPayload(dto);

    return this.cartRepository.runInTransaction(async (manager) => {
      const insertOutcome = await this.idempotencyRepository.insertPlaceholder(
        {
          userId,
          operation: CHECKOUT_COD_OPERATION,
          idempotencyKey,
          requestHash,
        },
        manager,
      );

      if (insertOutcome.kind === 'existing') {
        this.ensureReplayable(insertOutcome.record, requestHash);
        return insertOutcome.record
          .responseBody as unknown as CheckoutResponseDto;
      }

      // Resolved AFTER the idempotency short-circuit above — a retry of an
      // already-succeeded checkout must replay the stored response even if
      // the Address has since been deleted; only a genuinely NEW attempt
      // needs the address to still exist and be owned by this user.
      const address = await this.addressesService.getOwnedActiveEntityOrThrow(
        userId,
        dto.addressId,
      );

      const order = await this.loadCheckoutableCart(userId, manager);
      const { subtotal, discountAmount } = await this.revalidateAndTotal(
        order,
        manager,
      );
      const total = subtotal - discountAmount;
      const now = this.clock.now();

      this.applyShippingSnapshot(order, address, dto.shippingNote);
      order.subtotalAmount = subtotal;
      order.discountAmount = discountAmount;
      order.totalAmount = total;
      order.status = OrderStatus.PAID;
      order.placedAt = now;
      await manager.getRepository(OrderEntity).save(order);

      await manager.getRepository(OrderStatusHistoryEntity).insert({
        orderId: order.id,
        fromStatus: OrderStatus.CART,
        toStatus: OrderStatus.PAID,
        reason: 'checkout:cod',
      });

      await this.couponsService.redeemForOrder(
        {
          id: order.id,
          couponId: order.couponId,
          discountAmount: order.discountAmount,
          couponCodeSnapshot: order.couponCodeSnapshot,
        },
        userId,
        manager,
      );

      const payment = this.paymentsRepository.create(
        {
          orderId: order.id,
          provider: PaymentProvider.COD,
          status: PaymentStatus.PAID,
          amount: total,
          paidAt: now,
          attemptNumber: 1,
        },
        manager,
      );
      const savedPayment = await this.paymentsRepository.save(payment, manager);

      const response: CheckoutResponseDto = {
        orderId: order.id,
        paymentId: savedPayment.id,
        paymentMethod: PaymentProvider.COD,
        paymentStatus: PaymentStatus.PAID,
        checkoutUrl: null,
      };

      await this.idempotencyRepository.recordResponse(
        insertOutcome.record.id,
        200,
        response as unknown as Record<string, unknown>,
        manager,
      );

      return response;
    });
  }

  /**
   * PayOS spans two transactions around one uncommitted network call (see
   * plan): TX1 moves the Order to PENDING_PAYMENT and creates a PENDING
   * Payment row, committing BEFORE calling PayOS so a slow/failed gateway
   * call never holds a Postgres transaction open. The idempotency record
   * written in TX1 stores only `{orderId, paymentId}` — never a frozen
   * response body — so a retried request (same Idempotency-Key) always
   * re-reads the CURRENT payment row instead of replaying a stale
   * `checkoutUrl`. Order confirmation itself (Coupon redemption) does NOT
   * happen here — only once the webhook/sync path confirms PAID.
   */
  async placePayOsOrder(
    userId: string,
    dto: CreateCheckoutDto,
    idempotencyKey: string,
  ): Promise<CheckoutResponseDto> {
    const requestHash = this.hashPayload(dto);

    const { paymentId, isNew } = await this.cartRepository.runInTransaction(
      async (manager) => {
        const insertOutcome =
          await this.idempotencyRepository.insertPlaceholder(
            {
              userId,
              operation: CHECKOUT_PAYOS_OPERATION,
              idempotencyKey,
              requestHash,
            },
            manager,
          );

        if (insertOutcome.kind === 'existing') {
          this.ensureReplayable(insertOutcome.record, requestHash);
          const body = insertOutcome.record.responseBody as {
            orderId: string;
            paymentId: string;
          };
          return { paymentId: body.paymentId, isNew: false };
        }

        const address = await this.addressesService.getOwnedActiveEntityOrThrow(
          userId,
          dto.addressId,
        );

        const order = await this.loadCheckoutableCart(userId, manager);
        const { subtotal, discountAmount } = await this.revalidateAndTotal(
          order,
          manager,
        );
        const total = subtotal - discountAmount;
        const now = this.clock.now();

        this.applyShippingSnapshot(order, address, dto.shippingNote);
        order.subtotalAmount = subtotal;
        order.discountAmount = discountAmount;
        order.totalAmount = total;
        order.status = OrderStatus.PENDING_PAYMENT;
        order.placedAt = now;
        await manager.getRepository(OrderEntity).save(order);

        await manager.getRepository(OrderStatusHistoryEntity).insert({
          orderId: order.id,
          fromStatus: OrderStatus.CART,
          toStatus: OrderStatus.PENDING_PAYMENT,
          reason: 'checkout:payos',
        });

        const orderCode = await this.paymentsRepository.nextOrderCode(manager);
        const payment = this.paymentsRepository.create(
          {
            orderId: order.id,
            provider: PaymentProvider.PAYOS,
            status: PaymentStatus.PENDING,
            amount: total,
            providerOrderCode: orderCode,
            description: `Thanh toan don hang ${order.id.slice(0, 8)}`,
            attemptNumber: 1,
          },
          manager,
        );
        const savedPayment = await this.paymentsRepository.save(
          payment,
          manager,
        );

        await this.idempotencyRepository.recordResponse(
          insertOutcome.record.id,
          200,
          { orderId: order.id, paymentId: savedPayment.id },
          manager,
        );

        return { paymentId: savedPayment.id, isNew: true };
      },
    );

    if (isNew) {
      await this.createPaymentLinkForAttempt(paymentId);
    }

    return this.readCurrentCheckoutResponse(paymentId);
  }

  private async createPaymentLinkForAttempt(paymentId: string): Promise<void> {
    const payment = await this.paymentsRepository.findById(paymentId);
    if (!payment || payment.status !== PaymentStatus.PENDING) return;

    const orderItems = await this.paymentsRepository.findOrderItemsForPayment(
      payment.orderId,
    );

    try {
      const result = await this.gateway.createPaymentLink({
        orderCode: payment.providerOrderCode as number,
        amount: payment.amount,
        description: payment.description ?? 'Thanh toan don hang',
        items: orderItems.map((item) => ({
          name: item.productName,
          quantity: item.quantity,
          price: item.unitPriceAmount,
        })),
      });

      await this.paymentsRepository.runInTransaction(async (manager) => {
        const locked = await this.paymentsRepository.findByIdForUpdate(
          paymentId,
          manager,
        );
        if (!locked || locked.status !== PaymentStatus.PENDING) return;
        locked.checkoutUrl = result.checkoutUrl;
        locked.providerPaymentLinkId = result.paymentLinkId;
        await manager.getRepository(PaymentEntity).save(locked);
      });
    } catch (error) {
      await this.paymentsRepository.runInTransaction(async (manager) => {
        const locked = await this.paymentsRepository.findByIdForUpdate(
          paymentId,
          manager,
        );
        if (!locked || locked.status !== PaymentStatus.PENDING) return;
        locked.status = PaymentStatus.FAILED;
        locked.failedAt = this.clock.now();
        locked.failureReason =
          error instanceof Error
            ? error.message.slice(0, 500)
            : 'unknown error';
        await manager.getRepository(PaymentEntity).save(locked);
      });
      throw error;
    }
  }

  private async readCurrentCheckoutResponse(
    paymentId: string,
  ): Promise<CheckoutResponseDto> {
    const payment = await this.paymentsRepository.findById(paymentId);
    if (!payment) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Không tìm thấy thanh toán vừa tạo',
      });
    }
    return {
      orderId: payment.orderId,
      paymentId: payment.id,
      paymentMethod: payment.provider,
      paymentStatus: payment.status,
      checkoutUrl: payment.checkoutUrl,
    };
  }

  private async loadCheckoutableCart(
    userId: string,
    manager: EntityManager,
  ): Promise<OrderEntity> {
    const order = await this.cartRepository.lockActiveCartWithItemsForUser(
      userId,
      manager,
    );
    if (!order || order.items.length === 0) {
      throw new BadRequestException({
        code: 'CART_EMPTY',
        message: 'Giỏ hàng trống, không thể thanh toán',
      });
    }

    const hasUnavailableItem = order.items.some((item) => {
      const productActive = item.product.isActive && !item.product.deletedAt;
      const variantActive = item.variant ? item.variant.isActive : true;
      return !productActive || !variantActive;
    });
    if (hasUnavailableItem) {
      throw new BadRequestException({
        code: 'CART_ITEM_UNAVAILABLE',
        message:
          'Giỏ hàng có sản phẩm/biến thể không còn khả dụng, vui lòng cập nhật giỏ hàng',
      });
    }

    return order;
  }

  private async revalidateAndTotal(
    order: OrderEntity,
    manager: EntityManager,
  ): Promise<{ subtotal: number; discountAmount: number }> {
    const subtotal = order.items.reduce(
      (sum, item) => sum + item.unitPriceAmount * item.quantity,
      0,
    );
    const pricing = order.couponId
      ? await this.cartPricingService.revalidateCoupon(order, manager)
      : NO_COUPON;

    if (pricing.couponRemoved) {
      order.couponId = null;
      order.couponCodeSnapshot = null;
      order.couponNameSnapshot = null;
      order.couponDiscountTypeSnapshot = null;
      order.couponDiscountValueSnapshot = null;
    }

    return { subtotal, discountAmount: pricing.discountAmount };
  }

  /** Copies the Address as it exists RIGHT NOW into Order's own shipping
   * columns — an immutable snapshot, not a live reference. Editing or
   * deleting the Address afterward never changes this Order (see
   * AddressesService.delete/update — neither touches `orders`). */
  private applyShippingSnapshot(
    order: OrderEntity,
    address: AddressEntity,
    shippingNote: string | undefined,
  ): void {
    order.shippingRecipientName = address.recipientName;
    order.shippingPhoneNumber = address.phoneNumber;
    order.shippingProvince = address.province;
    order.shippingDistrict = address.district;
    order.shippingWard = address.ward;
    order.shippingStreetAddress = address.streetAddress;
    order.shippingNote = shippingNote ?? null;
  }

  private ensureReplayable(
    record: IdempotencyKeyEntity,
    requestHash: string,
  ): void {
    if (record.responseStatus === 0) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_IN_PROGRESS',
        message: 'Yêu cầu với Idempotency-Key này đang được xử lý',
      });
    }
    if (record.requestHash !== requestHash) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_CONFLICT',
        message: 'Idempotency-Key đã dùng cho một yêu cầu khác nội dung',
      });
    }
  }

  private hashPayload(dto: CreateCheckoutDto): string {
    const normalized = JSON.stringify({
      addressId: dto.addressId,
      shippingNote: dto.shippingNote ?? null,
    });
    return createHash('sha256').update(normalized).digest('hex');
  }
}
