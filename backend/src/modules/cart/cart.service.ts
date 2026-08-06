import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { CartRepository } from './cart.repository';
import { IdempotencyRepository } from './idempotency.repository';
import { CartMapper, EMPTY_CART, VariantOptionLabel } from './cart.mapper';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { ProductsService } from '../products/products.service';
import { ProductVariantsService } from '../products/variants/product-variants.service';
import { OrderEntity } from './entities/order.entity';
import { CART_ADD_ITEM_OPERATION } from './cart.constants';

@Injectable()
export class CartService {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly idempotencyRepository: IdempotencyRepository,
    private readonly cartMapper: CartMapper,
    private readonly productsService: ProductsService,
    private readonly productVariantsService: ProductVariantsService,
  ) {}

  async getCart(userId: string): Promise<CartResponseDto> {
    const order = await this.cartRepository.findActiveCartWithItems(userId);
    if (!order) {
      return EMPTY_CART;
    }
    return this.toResponse(order);
  }

  async addItem(
    userId: string,
    dto: AddCartItemDto,
    idempotencyKey: string,
  ): Promise<CartResponseDto> {
    const requestHash = this.hashPayload(dto);

    return this.cartRepository.runInTransaction(async (manager) => {
      const insertOutcome = await this.idempotencyRepository.insertPlaceholder(
        {
          userId,
          operation: CART_ADD_ITEM_OPERATION,
          idempotencyKey,
          requestHash,
        },
        manager,
      );

      if (insertOutcome.kind === 'existing') {
        const record = insertOutcome.record;
        if (record.responseStatus === 0) {
          // Another request with the same key is still committing —
          // extremely narrow window (same transaction, row-locked by the
          // unique index), safe to ask the caller to retry.
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
        return record.responseBody as unknown as CartResponseDto;
      }

      const { unitPrice, variantId } = await this.resolveLinePrice(dto);

      const cart = await this.cartRepository.getOrCreateActiveCart(
        userId,
        manager,
      );

      await this.cartRepository.addOrIncrementItem(manager, {
        orderId: cart.id,
        productId: dto.productId,
        variantId,
        quantity: dto.quantity,
        unitPriceAmount: unitPrice,
      });

      const fullOrder = await manager.getRepository(OrderEntity).findOne({
        where: { id: cart.id },
        relations: { items: { product: true, variant: true } },
        order: { items: { createdAt: 'ASC', id: 'ASC' } },
      });
      const response = await this.toResponse(fullOrder as OrderEntity);

      await this.idempotencyRepository.recordResponse(
        insertOutcome.record.id,
        200,
        response as unknown as Record<string, unknown>,
        manager,
      );

      return response;
    });
  }

  async updateItemQuantity(
    userId: string,
    itemId: string,
    quantity: number,
  ): Promise<CartResponseDto> {
    const current = await this.cartRepository.findItemForUser(userId, itemId);
    if (!current) {
      throw this.itemNotFound();
    }

    const productActive =
      current.product.isActive && !current.product.deletedAt;
    const variantActive = current.variant ? current.variant.isActive : true;
    const available = productActive && variantActive;

    if (!available && quantity > current.quantity) {
      throw new BadRequestException({
        code: 'CART_ITEM_UNAVAILABLE',
        message:
          'Sản phẩm/biến thể không còn khả dụng, chỉ có thể giảm số lượng hoặc xóa',
      });
    }

    const outcome = await this.cartRepository.updateItemQuantityForUser(
      userId,
      itemId,
      quantity,
    );
    if (outcome.kind === 'not_found') {
      throw this.itemNotFound();
    }

    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<void> {
    await this.cartRepository.deleteItemForUser(userId, itemId);
  }

  private async resolveLinePrice(
    dto: AddCartItemDto,
  ): Promise<{ unitPrice: number; variantId: string | null }> {
    // Throws 404 PRODUCT_NOT_FOUND if missing, inactive, or soft-deleted —
    // reuses the same public-read policy as GET /products/:id.
    const product = await this.productsService.getPublicOrThrow(dto.productId);

    if (dto.variantId) {
      const variant = await this.productVariantsService.findRawById(
        dto.variantId,
      );
      if (!variant || variant.productId !== dto.productId) {
        throw new NotFoundException({
          code: 'VARIANT_NOT_FOUND',
          message: 'Không tìm thấy biến thể của sản phẩm này',
        });
      }
      if (!variant.isActive) {
        throw new BadRequestException({
          code: 'VARIANT_INACTIVE',
          message: 'Biến thể sản phẩm không còn hoạt động',
        });
      }
      // Variant.price is NOT NULL in this schema — no null-fallback case
      // exists (see ProductVariantEntity comment), so no nullish-coalescing
      // to Product.price is needed here.
      return { unitPrice: variant.price, variantId: variant.id };
    }

    const activeVariants = await this.productVariantsService.listPublicVariants(
      dto.productId,
    );
    if (activeVariants.length > 0) {
      throw new BadRequestException({
        code: 'VARIANT_REQUIRED',
        message: 'Sản phẩm này yêu cầu chọn biến thể trước khi thêm vào giỏ',
      });
    }

    return { unitPrice: product.price, variantId: null };
  }

  private async toResponse(order: OrderEntity): Promise<CartResponseDto> {
    const variantIds = [
      ...new Set(
        order.items
          .map((i) => i.variantId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const labelRows =
      await this.productVariantsService.findManyByIdsWithOptionValues(
        variantIds,
      );
    const labelsByVariantId = new Map<string, VariantOptionLabel[]>(
      labelRows.map((row) => [
        row.variant.id,
        row.optionValues.map((ov) => ({
          optionName: ov.optionName,
          value: ov.value,
        })),
      ]),
    );

    return this.cartMapper.toResponse(order, labelsByVariantId);
  }

  private hashPayload(dto: AddCartItemDto): string {
    const normalized = JSON.stringify({
      productId: dto.productId,
      variantId: dto.variantId ?? null,
      quantity: dto.quantity,
    });
    return createHash('sha256').update(normalized).digest('hex');
  }

  private itemNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'CART_ITEM_NOT_FOUND',
      message: 'Không tìm thấy dòng giỏ hàng',
    });
  }
}
