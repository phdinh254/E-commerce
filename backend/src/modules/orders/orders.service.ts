import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { OrderEntity } from '../cart/entities/order.entity';
import { OrderStatus } from '../cart/enums/order-status.enum';
import { PaymentEntity } from '../payments/entities/payment.entity';
import { PaymentProvider } from '../payments/enums/payment-provider.enum';
import { PaymentsRepository } from '../payments/payments.repository';
import { OrderHistoryService } from './order-history.service';
import { orderNotFound } from './order-errors';
import { QueryOrdersDto } from './dto/query-orders.dto';
import {
  OrderSummaryResponseDto,
  PaginatedOrderSummaryResponseDto,
} from './dto/order-summary-response.dto';
import { OrderDetailResponseDto } from './dto/order-detail-response.dto';

const CURRENCY = 'VND';

/** `OrderEntity` has no `itemCount` column — `loadRelationCountAndMap`
 * bolts it onto the returned instance at runtime. */
type OrderWithItemCount = OrderEntity & { itemCount: number };

/**
 * Read-only query service for the customer-facing order list/detail
 * endpoints — deliberately separate from `OrderTransitionService`, which
 * owns state changes.
 */
@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepo: Repository<PaymentEntity>,
    private readonly paymentsRepository: PaymentsRepository,
    private readonly orderHistoryService: OrderHistoryService,
  ) {}

  async listForUser(
    userId: string,
    query: QueryOrdersDto,
  ): Promise<PaginatedOrderSummaryResponseDto> {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.userId = :userId', { userId })
      .andWhere('o.status != :cart', { cart: OrderStatus.CART });

    if (query.status) {
      qb.andWhere('o.status = :status', { status: query.status });
    }

    qb.loadRelationCountAndMap('o.itemCount', 'o.items');

    qb.orderBy(`o.${query.sortBy}`, query.sortOrder)
      .addOrderBy('o.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [rows, total] = await qb.getManyAndCount();

    // Batch-fetch the latest payment method per order in a single query —
    // never one query per row (would be N+1).
    const orderIds = rows.map((row) => row.id);
    const paymentMethodByOrderId =
      await this.latestPaymentMethodByOrderId(orderIds);

    return {
      data: rows.map((row) =>
        this.toSummaryDto(
          row as OrderWithItemCount,
          paymentMethodByOrderId.get(row.id) ?? null,
        ),
      ),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async getDetailForUser(
    orderId: string,
    userId: string,
  ): Promise<OrderDetailResponseDto> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, userId, status: Not(OrderStatus.CART) },
      relations: ['items'],
    });
    if (!order) {
      throw orderNotFound();
    }

    const [payment, history] = await Promise.all([
      this.paymentsRepository.findLatestByOrderId(orderId),
      this.orderHistoryService.listCustomerSafe(orderId),
    ]);

    return this.toDetailDto(order, payment?.provider ?? null, history);
  }

  /** Single query for all requested orders' latest payment provider,
   * picking the highest attemptNumber per orderId client-side (cheap: at
   * most `page limit` orders, each with very few payment rows). */
  private async latestPaymentMethodByOrderId(
    orderIds: string[],
  ): Promise<Map<string, PaymentProvider>> {
    const result = new Map<string, PaymentProvider>();
    if (orderIds.length === 0) {
      return result;
    }
    const payments = await this.paymentRepo
      .createQueryBuilder('p')
      .where('p.orderId IN (:...orderIds)', { orderIds })
      .orderBy('p.orderId', 'ASC')
      .addOrderBy('p.attemptNumber', 'DESC')
      .getMany();
    for (const payment of payments) {
      if (!result.has(payment.orderId)) {
        result.set(payment.orderId, payment.provider);
      }
    }
    return result;
  }

  private toSummaryDto(
    order: OrderWithItemCount,
    paymentMethod: PaymentProvider | null,
  ): OrderSummaryResponseDto {
    return {
      id: order.id,
      status: order.status,
      paymentMethod,
      createdAt: order.createdAt,
      totalAmount: order.totalAmount,
      currency: CURRENCY,
      itemCount: order.itemCount,
    };
  }

  private toDetailDto(
    order: OrderEntity,
    paymentMethod: PaymentProvider | null,
    history: Awaited<ReturnType<OrderHistoryService['listCustomerSafe']>>,
  ): OrderDetailResponseDto {
    return {
      id: order.id,
      status: order.status,
      paymentMethod,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productNameSnapshot,
        sku: item.skuSnapshot,
        imageUrl: item.imageUrlSnapshot,
        quantity: item.quantity,
        unitPriceAmount: item.unitPriceAmount,
        lineTotal: item.unitPriceAmount * item.quantity,
      })),
      subtotalAmount: order.subtotalAmount,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
      currency: CURRENCY,
      shippingAddress: {
        recipientName: order.shippingRecipientName,
        phoneNumber: order.shippingPhoneNumber,
        province: order.shippingProvince,
        district: order.shippingDistrict,
        ward: order.shippingWard,
        streetAddress: order.shippingStreetAddress,
        note: order.shippingNote,
      },
      history,
    };
  }
}
