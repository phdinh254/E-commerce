import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

/**
 * Every field optional for partial update. Like Category, renaming `name`
 * never implicitly changes `slug` — only an explicit `slug` field does, so
 * product URLs stay stable across cosmetic name edits.
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {}
