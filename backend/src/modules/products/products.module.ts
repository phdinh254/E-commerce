import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from './entities/product.entity';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductsCacheService } from './cache/products-cache.service';
import { CategoriesModule } from '../categories/categories.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';

import { ProductOptionEntity } from './variants/entities/product-option.entity';
import { ProductOptionValueEntity } from './variants/entities/product-option-value.entity';
import { ProductVariantEntity } from './variants/entities/product-variant.entity';
import { ProductVariantOptionValueEntity } from './variants/entities/product-variant-option-value.entity';
import { ProductVariantChangeLogEntity } from './variants/entities/product-variant-change-log.entity';
import { ProductOptionsRepository } from './variants/product-options.repository';
import { ProductOptionsService } from './variants/product-options.service';
import { ProductOptionsController } from './variants/product-options.controller';
import { ProductVariantsRepository } from './variants/product-variants.repository';
import { ProductVariantsService } from './variants/product-variants.service';
import { ProductVariantsController } from './variants/product-variants.controller';

import { ProductAttributeEntity } from './attributes/entities/product-attribute.entity';
import { ProductAttributesRepository } from './attributes/product-attributes.repository';
import { ProductAttributesService } from './attributes/product-attributes.service';
import { ProductAttributesController } from './attributes/product-attributes.controller';

import { ProductImageEntity } from './images/entities/product-image.entity';
import { ProductImagesRepository } from './images/product-images.repository';
import { ProductImagesService } from './images/product-images.service';
import { ProductImagesController } from './images/product-images.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductEntity,
      ProductOptionEntity,
      ProductOptionValueEntity,
      ProductVariantEntity,
      ProductVariantOptionValueEntity,
      ProductVariantChangeLogEntity,
      ProductAttributeEntity,
      ProductImageEntity,
    ]),
    CategoriesModule,
    StorageModule,
  ],
  controllers: [
    ProductsController,
    ProductOptionsController,
    ProductVariantsController,
    ProductAttributesController,
    ProductImagesController,
  ],
  providers: [
    ProductsRepository,
    ProductsService,
    ProductsCacheService,
    ProductOptionsRepository,
    ProductOptionsService,
    ProductVariantsRepository,
    ProductVariantsService,
    ProductAttributesRepository,
    ProductAttributesService,
    ProductImagesRepository,
    ProductImagesService,
  ],
  exports: [ProductsService],
})
export class ProductsModule {}
