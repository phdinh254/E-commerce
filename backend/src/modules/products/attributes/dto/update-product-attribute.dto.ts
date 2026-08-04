import { PartialType } from '@nestjs/swagger';
import { CreateProductAttributeDto } from './create-product-attribute.dto';

export class UpdateProductAttributeDto extends PartialType(
  CreateProductAttributeDto,
) {}
