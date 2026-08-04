import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from './entities/product.entity';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductsCacheService } from './cache/products-cache.service';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity]), CategoriesModule],
  controllers: [ProductsController],
  providers: [ProductsRepository, ProductsService, ProductsCacheService],
  exports: [ProductsService],
})
export class ProductsModule {}
