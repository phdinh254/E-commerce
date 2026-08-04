import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductAttributeEntity } from './entities/product-attribute.entity';

@Injectable()
export class ProductAttributesRepository {
  constructor(
    @InjectRepository(ProductAttributeEntity)
    private readonly repository: Repository<ProductAttributeEntity>,
  ) {}

  create(data: Partial<ProductAttributeEntity>): ProductAttributeEntity {
    return this.repository.create(data);
  }

  save(entity: ProductAttributeEntity): Promise<ProductAttributeEntity> {
    return this.repository.save(entity);
  }

  findById(id: string): Promise<ProductAttributeEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByProductId(
    productId: string,
    visibleOnly: boolean,
  ): Promise<ProductAttributeEntity[]> {
    return this.repository.find({
      where: visibleOnly ? { productId, isVisible: true } : { productId },
      order: { displayOrder: 'ASC', name: 'ASC', id: 'ASC' },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }
}
