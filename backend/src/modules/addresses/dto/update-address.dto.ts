import { PartialType } from '@nestjs/swagger';
import { CreateAddressDto } from './create-address.dto';

/**
 * `PartialType(CreateAddressDto)` — a DTO, never `PartialType(AddressEntity)`
 * — so every field keeps CreateAddressDto's own validation decorators
 * (trim, length, phone pattern) instead of inheriting raw entity/column
 * options. `isDefault` is technically still `boolean | undefined` here;
 * AddressesService is the one place that enforces "only `true` is a legal
 * transition through this endpoint" (see ADDRESS_DEFAULT_CANNOT_UNSET) —
 * validation at the DTO layer can't express "false is fine on create but
 * rejected on update" without duplicating the whole class.
 */
export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
