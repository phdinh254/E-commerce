import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryEntity } from './entities/category.entity';

/**
 * Registers CategoryEntity so autoLoadEntities picks it up at runtime and a
 * repository is available for injection once Category CRUD is built.
 * Intentionally has no controller/service — those are out of scope here.
 */
@Module({
  imports: [TypeOrmModule.forFeature([CategoryEntity])],
})
export class CategoriesModule {}
