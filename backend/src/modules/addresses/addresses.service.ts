import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AddressesRepository } from './addresses.repository';
import { AddressEntity } from './entities/address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AddressResponseDto } from './dto/address-response.dto';

/**
 * Ch18-B181: the single place default-address invariants are enforced.
 * Every mutation runs inside one transaction, locking the User row first
 * (see AddressesRepository.lockUserForAddressMutation) to serialize
 * concurrent create/update/delete/setDefault calls for the same user — the
 * partial unique index `UQ_addresses_user_default_active` is the DB-level
 * backstop, this lock is what keeps two concurrent requests from both
 * deciding to insert/promote a default at the same time in the first place.
 */
@Injectable()
export class AddressesService {
  constructor(private readonly addressesRepository: AddressesRepository) {}

  async listForUser(userId: string): Promise<AddressResponseDto[]> {
    const addresses =
      await this.addressesRepository.findAllActiveByUserId(userId);
    return addresses.map((address) => this.toResponse(address));
  }

  async getOwnedOrThrow(
    userId: string,
    addressId: string,
  ): Promise<AddressResponseDto> {
    const address = await this.getOwnedActiveEntityOrThrow(userId, addressId);
    return this.toResponse(address);
  }

  /** Reused by CheckoutService to build the shipping snapshot — returns the
   * raw entity (not the response DTO) since the caller needs every field to
   * copy onto Order, not a client-facing projection. */
  async getOwnedActiveEntityOrThrow(
    userId: string,
    addressId: string,
  ): Promise<AddressEntity> {
    const address = await this.addressesRepository.findOwnedActiveById(
      userId,
      addressId,
    );
    if (!address) {
      throw this.notFound();
    }
    return address;
  }

  async create(
    userId: string,
    dto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    const saved = await this.addressesRepository.runInTransaction(
      async (manager) => {
        await this.addressesRepository.lockUserForAddressMutation(
          userId,
          manager,
        );

        const existingCount =
          await this.addressesRepository.countActiveByUserId(userId, manager);
        // First address is always the default, regardless of what the
        // client requested — a user must never end up with addresses and
        // no default.
        const shouldBeDefault = existingCount === 0 || dto.isDefault === true;

        if (shouldBeDefault) {
          await this.addressesRepository.clearDefaultForUser(userId, manager);
        }

        const address = this.addressesRepository.create(
          {
            userId,
            label: dto.label ?? null,
            recipientName: dto.recipientName,
            phoneNumber: dto.phoneNumber,
            province: dto.province,
            district: dto.district,
            ward: dto.ward,
            streetAddress: dto.streetAddress,
            isDefault: shouldBeDefault,
          },
          manager,
        );
        return this.addressesRepository.save(address, manager);
      },
    );
    return this.toResponse(saved);
  }

  async update(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    if (dto.isDefault === false) {
      // Unsetting the default without nominating a replacement would leave
      // the user with addresses but no default — use setDefault on a
      // different address instead.
      throw new BadRequestException({
        code: 'ADDRESS_DEFAULT_CANNOT_UNSET',
        message:
          'Không thể bỏ địa chỉ mặc định trực tiếp — hãy đặt một địa chỉ khác làm mặc định',
      });
    }

    const saved = await this.addressesRepository.runInTransaction(
      async (manager) => {
        await this.addressesRepository.lockUserForAddressMutation(
          userId,
          manager,
        );

        const address =
          await this.addressesRepository.findOwnedActiveByIdForUpdate(
            userId,
            addressId,
            manager,
          );
        if (!address) {
          throw this.notFound();
        }

        if (dto.label !== undefined) address.label = dto.label ?? null;
        if (dto.recipientName !== undefined)
          address.recipientName = dto.recipientName;
        if (dto.phoneNumber !== undefined)
          address.phoneNumber = dto.phoneNumber;
        if (dto.province !== undefined) address.province = dto.province;
        if (dto.district !== undefined) address.district = dto.district;
        if (dto.ward !== undefined) address.ward = dto.ward;
        if (dto.streetAddress !== undefined)
          address.streetAddress = dto.streetAddress;

        if (dto.isDefault === true && !address.isDefault) {
          await this.addressesRepository.clearDefaultForUser(userId, manager);
          address.isDefault = true;
        }

        return this.addressesRepository.save(address, manager);
      },
    );
    return this.toResponse(saved);
  }

  async delete(userId: string, addressId: string): Promise<void> {
    await this.addressesRepository.runInTransaction(async (manager) => {
      await this.addressesRepository.lockUserForAddressMutation(
        userId,
        manager,
      );

      const address =
        await this.addressesRepository.findOwnedActiveByIdForUpdate(
          userId,
          addressId,
          manager,
        );
      if (!address) {
        throw this.notFound();
      }

      await this.addressesRepository.softDelete(addressId, manager);

      if (address.isDefault) {
        const replacement =
          await this.addressesRepository.findReplacementDefaultCandidate(
            userId,
            addressId,
            manager,
          );
        if (replacement) {
          replacement.isDefault = true;
          await this.addressesRepository.save(replacement, manager);
        }
        // No replacement found — zero addresses remain, which is valid: a
        // user may have no addresses and therefore no default.
      }
    });
  }

  async setDefault(
    userId: string,
    addressId: string,
  ): Promise<AddressResponseDto> {
    const saved = await this.addressesRepository.runInTransaction(
      async (manager) => {
        await this.addressesRepository.lockUserForAddressMutation(
          userId,
          manager,
        );

        const address =
          await this.addressesRepository.findOwnedActiveByIdForUpdate(
            userId,
            addressId,
            manager,
          );
        if (!address) {
          throw this.notFound();
        }

        if (address.isDefault) {
          // Already the default — idempotent no-op, not an error.
          return address;
        }

        await this.addressesRepository.clearDefaultForUser(userId, manager);
        address.isDefault = true;
        return this.addressesRepository.save(address, manager);
      },
    );
    return this.toResponse(saved);
  }

  private notFound(): NotFoundException {
    // Deliberately the same error for "does not exist" and "belongs to
    // another user" — an address ID guess by a non-owner is indistinguishable
    // from a typo, never leaking existence.
    return new NotFoundException({
      code: 'ADDRESS_NOT_FOUND',
      message: 'Không tìm thấy địa chỉ',
    });
  }

  private toResponse(address: AddressEntity): AddressResponseDto {
    return {
      id: address.id,
      label: address.label,
      recipientName: address.recipientName,
      phoneNumber: address.phoneNumber,
      province: address.province,
      district: address.district,
      ward: address.ward,
      streetAddress: address.streetAddress,
      isDefault: address.isDefault,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }
}
