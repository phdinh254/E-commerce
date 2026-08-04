import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProductOptionEntity } from './entities/product-option.entity';
import { ProductOptionValueEntity } from './entities/product-option-value.entity';
import { ProductVariantEntity } from './entities/product-variant.entity';

@Injectable()
export class ProductOptionsRepository {
  constructor(
    @InjectRepository(ProductOptionEntity)
    private readonly optionsRepository: Repository<ProductOptionEntity>,
    @InjectRepository(ProductOptionValueEntity)
    private readonly valuesRepository: Repository<ProductOptionValueEntity>,
    @InjectRepository(ProductVariantEntity)
    private readonly variantsRepository: Repository<ProductVariantEntity>,
  ) {}

  countByProductId(productId: string): Promise<number> {
    return this.optionsRepository.count({ where: { productId } });
  }

  countVariantsByProductId(productId: string): Promise<number> {
    return this.variantsRepository.count({ where: { productId } });
  }

  findByProductId(productId: string): Promise<ProductOptionEntity[]> {
    return this.optionsRepository.find({
      where: { productId },
      order: { displayOrder: 'ASC', name: 'ASC', id: 'ASC' },
    });
  }

  findValuesByOptionIds(
    optionIds: string[],
  ): Promise<ProductOptionValueEntity[]> {
    if (optionIds.length === 0) return Promise.resolve([]);
    return this.valuesRepository.find({
      where: { optionId: In(optionIds) },
      order: { displayOrder: 'ASC', value: 'ASC', id: 'ASC' },
    });
  }

  findOptionById(id: string): Promise<ProductOptionEntity | null> {
    return this.optionsRepository.findOne({ where: { id } });
  }

  findValuesByIds(ids: string[]): Promise<ProductOptionValueEntity[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.valuesRepository.find({ where: { id: In(ids) } });
  }

  /**
   * Creates the option and every value in one transaction: an option with
   * zero values (a value insert failing partway through) is never left
   * committed.
   */
  async createOptionWithValues(data: {
    productId: string;
    name: string;
    normalizedName: string;
    displayOrder: number;
    values: { value: string; normalizedValue: string; displayOrder: number }[];
  }): Promise<ProductOptionEntity> {
    return this.optionsRepository.manager.transaction(async (manager) => {
      const optionRepo = manager.getRepository(ProductOptionEntity);
      const valueRepo = manager.getRepository(ProductOptionValueEntity);

      const option = await optionRepo.save(
        optionRepo.create({
          productId: data.productId,
          name: data.name,
          normalizedName: data.normalizedName,
          displayOrder: data.displayOrder,
        }),
      );

      const values = await valueRepo.save(
        data.values.map((v) =>
          valueRepo.create({
            optionId: option.id,
            value: v.value,
            normalizedValue: v.normalizedValue,
            displayOrder: v.displayOrder,
          }),
        ),
      );

      option.values = values;
      return option;
    });
  }

  async addValue(data: {
    optionId: string;
    value: string;
    normalizedValue: string;
    displayOrder: number;
  }): Promise<ProductOptionValueEntity> {
    const entity = this.valuesRepository.create(data);
    return this.valuesRepository.save(entity);
  }
}
