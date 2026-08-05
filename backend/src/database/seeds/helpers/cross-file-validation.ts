import { UserSeedRecordDto } from '../dto/user-seed-record.dto';
import { CategorySeedRecordDto } from '../dto/category-seed-record.dto';
import { ProductSeedRecordDto } from '../dto/product-seed-record.dto';
import { ProductOptionSeedRecordDto } from '../dto/product-option-seed-record.dto';
import { ProductVariantSeedRecordDto } from '../dto/product-variant-seed-record.dto';
import { ProductImageSeedRecordDto } from '../dto/product-image-seed-record.dto';
import { ProductAttributeSeedRecordDto } from '../dto/product-attribute-seed-record.dto';
import { CouponSeedRecordDto } from '../dto/coupon-seed-record.dto';
import { CouponDiscountType } from '../../../modules/coupons/entities/coupon.entity';
import { normalizeLabel } from '../../../common/utils/normalize-label.util';

export interface SeedGraph {
  users: UserSeedRecordDto[];
  categories: CategorySeedRecordDto[];
  products: ProductSeedRecordDto[];
  options: ProductOptionSeedRecordDto[];
  variants: ProductVariantSeedRecordDto[];
  images: ProductImageSeedRecordDto[];
  attributes: ProductAttributeSeedRecordDto[];
  coupons: CouponSeedRecordDto[];
}

export class SeedGraphValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(
      `Seed data graph is invalid:\n${issues.map((i) => `  - ${i}`).join('\n')}`,
    );
  }
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

/**
 * Validates referential integrity and business rules ACROSS the seed JSON
 * files — this runs after each file individually passed
 * `readFromFile`'s per-record schema validation, and before any database
 * connection is opened (see seed.ts step ordering).
 */
export function validateSeedGraph(graph: SeedGraph): void {
  const issues: string[] = [];

  // --- users ------------------------------------------------------------
  const emails = graph.users.map((u) => u.email.toLowerCase().trim());
  for (const dup of findDuplicates(emails)) {
    issues.push(`users.json: duplicate email "${dup}"`);
  }

  // --- categories ---------------------------------------------------------
  const categorySlugs = new Set(graph.categories.map((c) => c.slug));
  for (const dup of findDuplicates(graph.categories.map((c) => c.slug))) {
    issues.push(`categories.json: duplicate slug "${dup}"`);
  }
  for (const category of graph.categories) {
    if (category.parentSlug === category.slug) {
      issues.push(
        `categories.json: category "${category.slug}" is its own parent`,
      );
    } else if (category.parentSlug && !categorySlugs.has(category.parentSlug)) {
      issues.push(
        `categories.json: category "${category.slug}" references unknown parentSlug "${category.parentSlug}"`,
      );
    }
  }
  // Multi-level cycle detection (A -> B -> C -> A).
  for (const category of graph.categories) {
    const visited = new Set<string>([category.slug]);
    let current: string | undefined = category.parentSlug;
    while (current) {
      if (visited.has(current)) {
        issues.push(
          `categories.json: cycle detected involving "${category.slug}"`,
        );
        break;
      }
      visited.add(current);
      current = graph.categories.find((c) => c.slug === current)?.parentSlug;
    }
  }

  // --- products -----------------------------------------------------------
  const productSlugs = new Set(graph.products.map((p) => p.slug));
  for (const dup of findDuplicates(graph.products.map((p) => p.slug))) {
    issues.push(`products.json: duplicate slug "${dup}"`);
  }
  for (const dup of findDuplicates(graph.products.map((p) => p.sku))) {
    issues.push(`products.json: duplicate sku "${dup}"`);
  }
  for (const product of graph.products) {
    if (!categorySlugs.has(product.categorySlug)) {
      issues.push(
        `products.json: product "${product.slug}" references unknown categorySlug "${product.categorySlug}"`,
      );
    }
  }

  // --- options + values ----------------------------------------------------
  const optionKeySet = new Set<string>();
  for (const option of graph.options) {
    if (!productSlugs.has(option.productSlug)) {
      issues.push(
        `product-options.json: option "${option.name}" references unknown productSlug "${option.productSlug}"`,
      );
    }
    const key = `${option.productSlug}::${normalizeLabel(option.name)}`;
    if (optionKeySet.has(key)) {
      issues.push(
        `product-options.json: duplicate option "${option.name}" for product "${option.productSlug}"`,
      );
    }
    optionKeySet.add(key);

    const normalizedValues = option.values.map((v) => normalizeLabel(v.value));
    for (const dup of findDuplicates(normalizedValues)) {
      issues.push(
        `product-options.json: option "${option.name}" (product "${option.productSlug}") has duplicate value "${dup}"`,
      );
    }
  }

  // --- variants -------------------------------------------------------------
  for (const dup of findDuplicates(graph.variants.map((v) => v.sku))) {
    issues.push(
      `product-variants.json: duplicate sku "${dup}" (variant SKU is unique table-wide)`,
    );
  }
  const variantCombinationKeys = new Map<string, string>();
  for (const variant of graph.variants) {
    if (!productSlugs.has(variant.productSlug)) {
      issues.push(
        `product-variants.json: variant "${variant.sku}" references unknown productSlug "${variant.productSlug}"`,
      );
      continue;
    }
    const productOptions = graph.options.filter(
      (o) => o.productSlug === variant.productSlug,
    );
    const requiredOptionNames = new Set(
      productOptions.map((o) => normalizeLabel(o.name)),
    );
    const suppliedOptionNames = variant.optionValues.map((ov) =>
      normalizeLabel(ov.optionName),
    );
    for (const dup of findDuplicates(suppliedOptionNames)) {
      issues.push(
        `product-variants.json: variant "${variant.sku}" selects option "${dup}" more than once`,
      );
    }
    const suppliedSet = new Set(suppliedOptionNames);
    for (const required of requiredOptionNames) {
      if (!suppliedSet.has(required)) {
        issues.push(
          `product-variants.json: variant "${variant.sku}" is missing a value for option "${required}"`,
        );
      }
    }
    for (const name of suppliedSet) {
      if (!requiredOptionNames.has(name)) {
        issues.push(
          `product-variants.json: variant "${variant.sku}" references option "${name}" not defined for product "${variant.productSlug}"`,
        );
      }
    }
    for (const ov of variant.optionValues) {
      const option = productOptions.find(
        (o) => normalizeLabel(o.name) === normalizeLabel(ov.optionName),
      );
      if (
        option &&
        !option.values.some(
          (v) => normalizeLabel(v.value) === normalizeLabel(ov.value),
        )
      ) {
        issues.push(
          `product-variants.json: variant "${variant.sku}" uses value "${ov.value}" not defined for option "${ov.optionName}"`,
        );
      }
    }

    const combinationKey = [...suppliedOptionNames]
      .map(
        (name, idx) =>
          `${name}=${normalizeLabel(variant.optionValues[idx].value)}`,
      )
      .sort()
      .join('|');
    const fullKey = `${variant.productSlug}::${combinationKey}`;
    const existingSku = variantCombinationKeys.get(fullKey);
    if (existingSku) {
      issues.push(
        `product-variants.json: variants "${existingSku}" and "${variant.sku}" declare the same option-value combination for product "${variant.productSlug}"`,
      );
    } else {
      variantCombinationKeys.set(fullKey, variant.sku);
    }
  }
  // --- images -----------------------------------------------------------
  for (const image of graph.images) {
    if (!productSlugs.has(image.productSlug)) {
      issues.push(
        `product-images.json: image references unknown productSlug "${image.productSlug}"`,
      );
      continue;
    }
    if (image.variantSku) {
      const variant = graph.variants.find((v) => v.sku === image.variantSku);
      if (!variant) {
        issues.push(
          `product-images.json: image references unknown variantSku "${image.variantSku}"`,
        );
      } else if (variant.productSlug !== image.productSlug) {
        issues.push(
          `product-images.json: image references variant "${image.variantSku}" which belongs to product "${variant.productSlug}", not "${image.productSlug}"`,
        );
      }
    }
  }

  // --- attributes ---------------------------------------------------------
  const attributeKeySet = new Set<string>();
  for (const attribute of graph.attributes) {
    if (!productSlugs.has(attribute.productSlug)) {
      issues.push(
        `product-attributes.json: attribute "${attribute.name}" references unknown productSlug "${attribute.productSlug}"`,
      );
    }
    const key = `${attribute.productSlug}::${normalizeLabel(attribute.name)}`;
    if (attributeKeySet.has(key)) {
      issues.push(
        `product-attributes.json: duplicate attribute "${attribute.name}" for product "${attribute.productSlug}"`,
      );
    }
    attributeKeySet.add(key);
  }

  // --- coupons -----------------------------------------------------------
  for (const dup of findDuplicates(
    graph.coupons.map((c) => c.code.toUpperCase()),
  )) {
    issues.push(`coupons.json: duplicate code "${dup}"`);
  }
  for (const coupon of graph.coupons) {
    if (new Date(coupon.startsAt) >= new Date(coupon.endsAt)) {
      issues.push(
        `coupons.json: coupon "${coupon.code}" has startsAt >= endsAt`,
      );
    }
    if (
      coupon.discountType === CouponDiscountType.PERCENTAGE &&
      (coupon.discountValue < 1 || coupon.discountValue > 100)
    ) {
      issues.push(
        `coupons.json: coupon "${coupon.code}" is PERCENTAGE but discountValue ${coupon.discountValue} is outside 1-100`,
      );
    }
    if (coupon.applicableCategorySlug && coupon.applicableProductSlug) {
      issues.push(
        `coupons.json: coupon "${coupon.code}" sets both applicableCategorySlug and applicableProductSlug — only one is allowed`,
      );
    }
    if (
      coupon.applicableCategorySlug &&
      !categorySlugs.has(coupon.applicableCategorySlug)
    ) {
      issues.push(
        `coupons.json: coupon "${coupon.code}" references unknown applicableCategorySlug "${coupon.applicableCategorySlug}"`,
      );
    }
    if (
      coupon.applicableProductSlug &&
      !productSlugs.has(coupon.applicableProductSlug)
    ) {
      issues.push(
        `coupons.json: coupon "${coupon.code}" references unknown applicableProductSlug "${coupon.applicableProductSlug}"`,
      );
    }
  }

  if (issues.length > 0) {
    throw new SeedGraphValidationError(issues);
  }
}
