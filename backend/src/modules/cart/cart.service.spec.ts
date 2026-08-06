import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { CartService } from './cart.service';
import { CartRepository } from './cart.repository';
import { IdempotencyRepository } from './idempotency.repository';
import { CartMapper, EMPTY_CART } from './cart.mapper';
import { ProductsService } from '../products/products.service';
import { ProductVariantsService } from '../products/variants/product-variants.service';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { OrderStatus } from './enums/order-status.enum';
import { ProductEntity } from '../products/entities/product.entity';
import { ProductVariantEntity } from '../products/variants/entities/product-variant.entity';
import { CartResponseDto } from './dto/cart-response.dto';
import { CartPricingService } from './cart-pricing.service';

function buildProduct(overrides: Partial<ProductEntity> = {}): ProductEntity {
  return {
    id: 'prod-1',
    categoryId: 'cat-1',
    category: null as unknown as ProductEntity['category'],
    name: 'Áo thun nam',
    slug: 'ao-thun-nam',
    sku: 'ATN-001',
    shortDescription: null,
    description: null,
    price: 100_000,
    thumbnailUrl: null,
    isActive: true,
    isFeatured: false,
    featuredOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function buildVariant(
  overrides: Partial<ProductVariantEntity> = {},
): ProductVariantEntity {
  return {
    id: 'variant-1',
    productId: 'prod-1',
    product: null as unknown as ProductVariantEntity['product'],
    sku: 'ATN-001-M',
    combinationKey: 'k1',
    price: 120_000,
    stock: 10,
    isActive: true,
    optionValues: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildOrder(overrides: Partial<OrderEntity> = {}): OrderEntity {
  return {
    id: 'order-1',
    userId: 'user-1',
    user: null as unknown as OrderEntity['user'],
    status: OrderStatus.CART,
    subtotalAmount: 0,
    totalAmount: 0,
    couponId: null,
    coupon: null,
    couponCodeSnapshot: null,
    couponNameSnapshot: null,
    couponDiscountTypeSnapshot: null,
    couponDiscountValueSnapshot: null,
    discountAmount: 0,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const CART_RESPONSE: CartResponseDto = {
  cartId: 'order-1',
  items: [],
  totalQuantity: 0,
  subtotal: 0,
  discountAmount: 0,
  total: 0,
  appliedCoupon: null,
  couponRemovedReason: null,
  currency: 'VND',
  updatedAt: new Date(),
};

describe('CartService', () => {
  // `runInTransaction` is generic (<T>(fn) => Promise<T>) — jest.Mocked's
  // mapped type can't be satisfied by a plain jest.fn() mock, so it's typed
  // separately here as a plain jest.Mock rather than forced through the
  // same mapped-type machinery as the other (non-generic) methods.
  let cartRepository: jest.Mocked<
    Pick<
      CartRepository,
      | 'findActiveCartWithItems'
      | 'getOrCreateActiveCart'
      | 'addOrIncrementItem'
      | 'findItemForUser'
      | 'updateItemQuantityForUser'
      | 'deleteItemForUser'
    >
  > & { runInTransaction: jest.Mock };
  let idempotencyRepository: jest.Mocked<
    Pick<IdempotencyRepository, 'insertPlaceholder' | 'recordResponse'>
  >;
  let cartMapper: jest.Mocked<Pick<CartMapper, 'toResponse'>>;
  let productsService: jest.Mocked<Pick<ProductsService, 'getPublicOrThrow'>>;
  let productVariantsService: jest.Mocked<
    Pick<
      ProductVariantsService,
      'findRawById' | 'listPublicVariants' | 'findManyByIdsWithOptionValues'
    >
  >;
  let cartPricingService: jest.Mocked<
    Pick<CartPricingService, 'revalidateCoupon'>
  >;
  let service: CartService;
  let fakeManager: EntityManager;

  beforeEach(() => {
    fakeManager = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(buildOrder({ items: [] })),
      }),
    } as unknown as EntityManager;

    cartRepository = {
      findActiveCartWithItems: jest.fn(),
      getOrCreateActiveCart: jest.fn(),
      runInTransaction: jest.fn((fn: (manager: unknown) => unknown) =>
        fn(fakeManager),
      ),
      addOrIncrementItem: jest.fn(),
      findItemForUser: jest.fn(),
      updateItemQuantityForUser: jest.fn(),
      deleteItemForUser: jest.fn(),
    };
    idempotencyRepository = {
      insertPlaceholder: jest.fn(),
      recordResponse: jest.fn(),
    };
    cartMapper = { toResponse: jest.fn().mockReturnValue(CART_RESPONSE) };
    productsService = { getPublicOrThrow: jest.fn() };
    productVariantsService = {
      findRawById: jest.fn(),
      listPublicVariants: jest.fn().mockResolvedValue([]),
      findManyByIdsWithOptionValues: jest.fn().mockResolvedValue([]),
    };

    cartPricingService = {
      revalidateCoupon: jest.fn().mockResolvedValue({
        discountAmount: 0,
        couponRemoved: false,
        removedReason: null,
      }),
    };

    service = new CartService(
      cartRepository as unknown as CartRepository,
      idempotencyRepository as unknown as IdempotencyRepository,
      cartMapper,
      productsService as unknown as ProductsService,
      productVariantsService as unknown as ProductVariantsService,
      cartPricingService as unknown as CartPricingService,
    );
  });

  describe('getCart', () => {
    it('returns EMPTY_CART when the user has no active cart (no row created)', async () => {
      cartRepository.findActiveCartWithItems.mockResolvedValue(null);

      const result = await service.getCart('user-1');

      expect(result).toBe(EMPTY_CART);
      expect(cartRepository.getOrCreateActiveCart).not.toHaveBeenCalled();
    });

    it('maps an existing cart via CartMapper', async () => {
      const order = buildOrder();
      cartRepository.findActiveCartWithItems.mockResolvedValue(order);

      const result = await service.getCart('user-1');

      expect(cartMapper.toResponse).toHaveBeenCalledWith(
        order,
        expect.any(Map),
        { discountAmount: 0, couponRemoved: false, removedReason: null },
      );
      expect(result).toBe(CART_RESPONSE);
    });
  });

  describe('addItem', () => {
    it('rejects a product that has active variants but no variantId given', async () => {
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'inserted',
        record: { id: 'idem-1' } as never,
      });
      productsService.getPublicOrThrow.mockResolvedValue(buildProduct());
      productVariantsService.listPublicVariants.mockResolvedValue([
        { id: 'variant-1' } as never,
      ]);

      await expect(
        service.addItem(
          'user-1',
          { productId: 'prod-1', quantity: 1 },
          'key-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(cartRepository.addOrIncrementItem).not.toHaveBeenCalled();
    });

    it('uses Product.price when the product has no variants', async () => {
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'inserted',
        record: { id: 'idem-1' } as never,
      });
      productsService.getPublicOrThrow.mockResolvedValue(
        buildProduct({ price: 100_000 }),
      );
      productVariantsService.listPublicVariants.mockResolvedValue([]);
      cartRepository.getOrCreateActiveCart.mockResolvedValue(buildOrder());
      cartRepository.addOrIncrementItem.mockResolvedValue({
        kind: 'created',
        item: {} as OrderItemEntity,
      });

      await service.addItem(
        'user-1',
        { productId: 'prod-1', quantity: 2 },
        'key-1',
      );

      expect(cartRepository.addOrIncrementItem).toHaveBeenCalledWith(
        fakeManager,
        expect.objectContaining({
          orderId: 'order-1',
          productId: 'prod-1',
          variantId: null,
          quantity: 2,
          unitPriceAmount: 100_000,
        }),
      );
    });

    it('revalidates the applied coupon (using the freshly-loaded order) after adding an item', async () => {
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'inserted',
        record: { id: 'idem-1' } as never,
      });
      productsService.getPublicOrThrow.mockResolvedValue(
        buildProduct({ price: 100_000 }),
      );
      productVariantsService.listPublicVariants.mockResolvedValue([]);
      cartRepository.getOrCreateActiveCart.mockResolvedValue(buildOrder());
      cartRepository.addOrIncrementItem.mockResolvedValue({
        kind: 'created',
        item: {} as OrderItemEntity,
      });
      const orderWithCoupon = buildOrder({ couponId: 'coupon-1', items: [] });
      (fakeManager.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue(orderWithCoupon),
      });
      cartPricingService.revalidateCoupon.mockResolvedValue({
        discountAmount: 9_000,
        couponRemoved: false,
        removedReason: null,
      });

      await service.addItem(
        'user-1',
        { productId: 'prod-1', quantity: 1 },
        'key-1',
      );

      expect(cartPricingService.revalidateCoupon).toHaveBeenCalledWith(
        orderWithCoupon,
        fakeManager,
      );
    });

    it('skips coupon revalidation entirely when the cart has no coupon', async () => {
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'inserted',
        record: { id: 'idem-1' } as never,
      });
      productsService.getPublicOrThrow.mockResolvedValue(
        buildProduct({ price: 100_000 }),
      );
      productVariantsService.listPublicVariants.mockResolvedValue([]);
      cartRepository.getOrCreateActiveCart.mockResolvedValue(buildOrder());
      cartRepository.addOrIncrementItem.mockResolvedValue({
        kind: 'created',
        item: {} as OrderItemEntity,
      });

      await service.addItem(
        'user-1',
        { productId: 'prod-1', quantity: 1 },
        'key-1',
      );

      expect(cartPricingService.revalidateCoupon).not.toHaveBeenCalled();
    });

    it('uses Variant.price (never Product.price) when a variant is given', async () => {
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'inserted',
        record: { id: 'idem-1' } as never,
      });
      productsService.getPublicOrThrow.mockResolvedValue(
        buildProduct({ price: 100_000 }),
      );
      productVariantsService.findRawById.mockResolvedValue(
        buildVariant({ price: 150_000, productId: 'prod-1', isActive: true }),
      );
      cartRepository.getOrCreateActiveCart.mockResolvedValue(buildOrder());
      cartRepository.addOrIncrementItem.mockResolvedValue({
        kind: 'created',
        item: {} as OrderItemEntity,
      });

      await service.addItem(
        'user-1',
        { productId: 'prod-1', variantId: 'variant-1', quantity: 1 },
        'key-1',
      );

      expect(cartRepository.addOrIncrementItem).toHaveBeenCalledWith(
        fakeManager,
        expect.objectContaining({
          unitPriceAmount: 150_000,
          variantId: 'variant-1',
        }),
      );
    });

    it('rejects a variant that does not belong to the given product', async () => {
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'inserted',
        record: { id: 'idem-1' } as never,
      });
      productsService.getPublicOrThrow.mockResolvedValue(buildProduct());
      productVariantsService.findRawById.mockResolvedValue(
        buildVariant({ productId: 'other-product' }),
      );

      await expect(
        service.addItem(
          'user-1',
          { productId: 'prod-1', variantId: 'variant-1', quantity: 1 },
          'key-1',
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an inactive variant', async () => {
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'inserted',
        record: { id: 'idem-1' } as never,
      });
      productsService.getPublicOrThrow.mockResolvedValue(buildProduct());
      productVariantsService.findRawById.mockResolvedValue(
        buildVariant({ isActive: false }),
      );

      await expect(
        service.addItem(
          'user-1',
          { productId: 'prod-1', variantId: 'variant-1', quantity: 1 },
          'key-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('replays the stored response for a retried key with the same payload, without mutating again', async () => {
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'existing',
        record: {
          id: 'idem-1',
          responseStatus: 200,
          requestHash: expect.any(String) as unknown as string,
          responseBody: CART_RESPONSE,
        } as never,
      });
      // Force the stored hash to equal whatever the service computes by
      // reading it back out of the same call — simplest is to bypass exact
      // hash matching and assert no mutation happened when kind === 'existing'.
      idempotencyRepository.insertPlaceholder.mockImplementation((params) =>
        Promise.resolve({
          kind: 'existing',
          record: {
            id: 'idem-1',
            responseStatus: 200,
            requestHash: params.requestHash,
            responseBody: CART_RESPONSE,
          } as never,
        }),
      );

      const result = await service.addItem(
        'user-1',
        { productId: 'prod-1', quantity: 1 },
        'key-1',
      );

      expect(result).toEqual(CART_RESPONSE);
      expect(cartRepository.addOrIncrementItem).not.toHaveBeenCalled();
      expect(productsService.getPublicOrThrow).not.toHaveBeenCalled();
    });

    it('rejects the same key reused with a different payload', async () => {
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'existing',
        record: {
          id: 'idem-1',
          responseStatus: 200,
          requestHash: 'a-completely-different-hash',
          responseBody: CART_RESPONSE,
        } as never,
      });

      await expect(
        service.addItem(
          'user-1',
          { productId: 'prod-1', quantity: 1 },
          'key-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(cartRepository.addOrIncrementItem).not.toHaveBeenCalled();
    });

    it('rejects a concurrent still-processing key (responseStatus 0 placeholder)', async () => {
      idempotencyRepository.insertPlaceholder.mockResolvedValue({
        kind: 'existing',
        record: { id: 'idem-1', responseStatus: 0, requestHash: 'x' } as never,
      });

      await expect(
        service.addItem(
          'user-1',
          { productId: 'prod-1', quantity: 1 },
          'key-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updateItemQuantity', () => {
    it('throws 404 when the item does not belong to this user (or does not exist)', async () => {
      cartRepository.findItemForUser.mockResolvedValue(null);

      await expect(
        service.updateItemQuantity('user-1', 'item-1', 3),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(cartRepository.updateItemQuantityForUser).not.toHaveBeenCalled();
    });

    it('rejects increasing quantity on an unavailable (inactive product) item', async () => {
      cartRepository.findItemForUser.mockResolvedValue({
        id: 'item-1',
        quantity: 1,
        product: buildProduct({ isActive: false }),
        variant: null,
      } as unknown as OrderItemEntity);

      await expect(
        service.updateItemQuantity('user-1', 'item-1', 5),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(cartRepository.updateItemQuantityForUser).not.toHaveBeenCalled();
    });

    it('allows decreasing quantity on an unavailable item', async () => {
      cartRepository.findItemForUser.mockResolvedValue({
        id: 'item-1',
        quantity: 5,
        product: buildProduct({ isActive: false }),
        variant: null,
      } as unknown as OrderItemEntity);
      cartRepository.updateItemQuantityForUser.mockResolvedValue({
        kind: 'ok',
        item: {} as OrderItemEntity,
      });
      cartRepository.findActiveCartWithItems.mockResolvedValue(buildOrder());

      await service.updateItemQuantity('user-1', 'item-1', 1);

      expect(cartRepository.updateItemQuantityForUser).toHaveBeenCalledWith(
        'user-1',
        'item-1',
        1,
      );
    });

    it('applies absolute-value semantics (sets, does not add)', async () => {
      cartRepository.findItemForUser.mockResolvedValue({
        id: 'item-1',
        quantity: 2,
        product: buildProduct(),
        variant: null,
      } as unknown as OrderItemEntity);
      cartRepository.updateItemQuantityForUser.mockResolvedValue({
        kind: 'ok',
        item: {} as OrderItemEntity,
      });
      cartRepository.findActiveCartWithItems.mockResolvedValue(buildOrder());

      await service.updateItemQuantity('user-1', 'item-1', 9);

      expect(cartRepository.updateItemQuantityForUser).toHaveBeenCalledWith(
        'user-1',
        'item-1',
        9,
      );
    });
  });

  describe('removeItem', () => {
    it('delegates to the ownership-scoped repository delete', async () => {
      await service.removeItem('user-1', 'item-1');
      expect(cartRepository.deleteItemForUser).toHaveBeenCalledWith(
        'user-1',
        'item-1',
      );
    });

    it('revalidates and persists coupon state immediately after removing an item', async () => {
      const orderWithCoupon = buildOrder({ couponId: 'coupon-1' });
      cartRepository.findActiveCartWithItems.mockResolvedValue(orderWithCoupon);

      await service.removeItem('user-1', 'item-1');

      expect(cartPricingService.revalidateCoupon).toHaveBeenCalledWith(
        orderWithCoupon,
        fakeManager,
      );
    });

    it('does not attempt coupon revalidation when the cart has no coupon applied', async () => {
      cartRepository.findActiveCartWithItems.mockResolvedValue(buildOrder());

      await service.removeItem('user-1', 'item-1');

      expect(cartPricingService.revalidateCoupon).not.toHaveBeenCalled();
    });
  });
});
