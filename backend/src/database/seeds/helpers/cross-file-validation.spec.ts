import {
  validateSeedGraph,
  SeedGraph,
  SeedGraphValidationError,
} from './cross-file-validation';
import { UserRole } from '../../../common/enums/user-role.enum';
import { CouponDiscountType } from '../../../modules/coupons/entities/coupon.entity';

function baseGraph(): SeedGraph {
  return {
    users: [
      { email: 'admin@example.local', fullName: 'Admin', role: UserRole.ADMIN },
    ],
    categories: [{ slug: 'ao-thun', name: 'Áo thun' }],
    products: [
      {
        sku: 'TSHIRT-001',
        slug: 'ao-thun-basic',
        name: 'Áo thun basic',
        categorySlug: 'ao-thun',
        price: 100000,
      },
    ],
    options: [
      {
        productSlug: 'ao-thun-basic',
        name: 'Màu sắc',
        values: [{ value: 'Đỏ' }, { value: 'Xanh' }],
      },
    ],
    variants: [
      {
        productSlug: 'ao-thun-basic',
        sku: 'TSHIRT-001-RED',
        optionValues: [{ optionName: 'Màu sắc', value: 'Đỏ' }],
      },
    ],
    images: [
      {
        productSlug: 'ao-thun-basic',
        assetFile: 'placeholder-1.jpg',
      },
    ],
    attributes: [
      { productSlug: 'ao-thun-basic', name: 'Chất liệu', value: 'Cotton' },
    ],
    coupons: [
      {
        code: 'WELCOME10',
        discountType: CouponDiscountType.PERCENTAGE,
        discountValue: 10,
        startsAt: '2025-01-01T00:00:00.000Z',
        endsAt: '2030-01-01T00:00:00.000Z',
      },
    ],
  };
}

describe('validateSeedGraph', () => {
  it('accepts a valid, fully-connected graph', () => {
    expect(() => validateSeedGraph(baseGraph())).not.toThrow();
  });

  it('rejects duplicate user email', () => {
    const graph = baseGraph();
    graph.users.push({ ...graph.users[0] });
    expect(() => validateSeedGraph(graph)).toThrow(SeedGraphValidationError);
  });

  it('rejects duplicate category slug', () => {
    const graph = baseGraph();
    graph.categories.push({ ...graph.categories[0] });
    expect(() => validateSeedGraph(graph)).toThrow(/duplicate slug/);
  });

  it('rejects a category cycle', () => {
    const graph = baseGraph();
    graph.categories = [
      { slug: 'a', name: 'A', parentSlug: 'b' },
      { slug: 'b', name: 'B', parentSlug: 'a' },
    ];
    expect(() => validateSeedGraph(graph)).toThrow(/cycle/);
  });

  it('rejects duplicate product sku', () => {
    const graph = baseGraph();
    graph.products.push({ ...graph.products[0], slug: 'another-slug' });
    expect(() => validateSeedGraph(graph)).toThrow(/duplicate sku/);
  });

  it('rejects duplicate product slug', () => {
    const graph = baseGraph();
    graph.products.push({ ...graph.products[0], sku: 'ANOTHER-SKU' });
    expect(() => validateSeedGraph(graph)).toThrow(/duplicate slug/);
  });

  it('rejects a product referencing an unknown category', () => {
    const graph = baseGraph();
    graph.products[0].categorySlug = 'does-not-exist';
    expect(() => validateSeedGraph(graph)).toThrow(/unknown categorySlug/);
  });

  it('rejects duplicate variant sku', () => {
    const graph = baseGraph();
    graph.variants.push({ ...graph.variants[0] });
    expect(() => validateSeedGraph(graph)).toThrow(/duplicate sku/);
  });

  it('rejects a variant selecting two values of the same option', () => {
    const graph = baseGraph();
    graph.variants[0].optionValues.push({
      optionName: 'Màu sắc',
      value: 'Xanh',
    });
    expect(() => validateSeedGraph(graph)).toThrow(/more than once/);
  });

  it('rejects a variant using an option not defined for its product', () => {
    const graph = baseGraph();
    graph.variants[0].optionValues = [{ optionName: 'Kích thước', value: 'M' }];
    expect(() => validateSeedGraph(graph)).toThrow(/not defined for product/);
  });

  it('rejects a variant missing a required option', () => {
    const graph = baseGraph();
    graph.options.push({
      productSlug: 'ao-thun-basic',
      name: 'Kích thước',
      values: [{ value: 'M' }],
    });
    expect(() => validateSeedGraph(graph)).toThrow(/missing a value/);
  });

  it('rejects two variants declaring the same combination', () => {
    const graph = baseGraph();
    graph.variants.push({
      productSlug: 'ao-thun-basic',
      sku: 'TSHIRT-001-RED-2',
      optionValues: [{ optionName: 'Màu sắc', value: 'Đỏ' }],
    });
    expect(() => validateSeedGraph(graph)).toThrow(
      /same option-value combination/,
    );
  });

  it('rejects an image referencing a variant from a different product', () => {
    const graph = baseGraph();
    graph.products.push({
      sku: 'OTHER-001',
      slug: 'other-product',
      name: 'Other',
      categorySlug: 'ao-thun',
      price: 50000,
    });
    graph.images[0].variantSku = graph.variants[0].sku;
    graph.images[0].productSlug = 'other-product';
    expect(() => validateSeedGraph(graph)).toThrow(/belongs to product/);
  });

  it('rejects duplicate attribute name for the same product', () => {
    const graph = baseGraph();
    graph.attributes.push({ ...graph.attributes[0] });
    expect(() => validateSeedGraph(graph)).toThrow(/duplicate attribute/);
  });

  it('rejects duplicate coupon code (case-insensitive)', () => {
    const graph = baseGraph();
    graph.coupons.push({ ...graph.coupons[0], code: 'welcome10' });
    expect(() => validateSeedGraph(graph)).toThrow(/duplicate code/);
  });

  it('rejects PERCENTAGE coupon with discountValue outside 1-100', () => {
    const graph = baseGraph();
    graph.coupons[0].discountValue = 150;
    expect(() => validateSeedGraph(graph)).toThrow(/outside 1-100/);
  });

  it('rejects a coupon with startsAt after endsAt', () => {
    const graph = baseGraph();
    graph.coupons[0].startsAt = '2030-01-01T00:00:00.000Z';
    graph.coupons[0].endsAt = '2025-01-01T00:00:00.000Z';
    expect(() => validateSeedGraph(graph)).toThrow(/startsAt >= endsAt/);
  });

  it('rejects a coupon setting both applicableCategorySlug and applicableProductSlug', () => {
    const graph = baseGraph();
    graph.coupons[0].applicableCategorySlug = 'ao-thun';
    graph.coupons[0].applicableProductSlug = 'ao-thun-basic';
    expect(() => validateSeedGraph(graph)).toThrow(/only one is allowed/);
  });
});
