import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from './entities/product.entity';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity]), CategoriesModule],
  controllers: [ProductsController],
  providers: [ProductsRepository, ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
