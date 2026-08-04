import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

/**
 * Every field is optional for a partial update. Notably, `slug` is only
 * ever changed when the client explicitly sends it — renaming `name` never
 * implicitly regenerates the slug, so existing category URLs stay stable.
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
