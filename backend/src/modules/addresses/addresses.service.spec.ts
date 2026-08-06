import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { AddressesService } from './addresses.service';
import { AddressesRepository } from './addresses.repository';
import { AddressEntity } from './entities/address.entity';

function buildAddress(overrides: Partial<AddressEntity> = {}): AddressEntity {
  return {
    id: 'address-1',
    userId: 'user-1',
    user: null as unknown as AddressEntity['user'],
    label: null,
    recipientName: 'Nguyen Van A',
    phoneNumber: '0912345678',
    province: 'Ha Noi',
    district: 'Cau Giay',
    ward: 'Dich Vong',
    streetAddress: '123 Xuan Thuy',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('AddressesService', () => {
  let repository: jest.Mocked<
    Pick<
      AddressesRepository,
      | 'findAllActiveByUserId'
      | 'findOwnedActiveById'
      | 'findOwnedActiveByIdForUpdate'
      | 'countActiveByUserId'
      | 'clearDefaultForUser'
      | 'findReplacementDefaultCandidate'
      | 'create'
      | 'save'
      | 'softDelete'
      | 'lockUserForAddressMutation'
    >
  > & { runInTransaction: jest.Mock };
  let fakeManager: EntityManager;
  let service: AddressesService;

  beforeEach(() => {
    fakeManager = {} as EntityManager;
    repository = {
      findAllActiveByUserId: jest.fn(),
      findOwnedActiveById: jest.fn(),
      findOwnedActiveByIdForUpdate: jest.fn(),
      countActiveByUserId: jest.fn(),
      clearDefaultForUser: jest.fn().mockResolvedValue(undefined),
      findReplacementDefaultCandidate: jest.fn(),
      create: jest.fn((data) => data as AddressEntity),
      save: jest.fn((address) => Promise.resolve(address)),
      softDelete: jest.fn().mockResolvedValue(undefined),
      lockUserForAddressMutation: jest.fn().mockResolvedValue(undefined),
      runInTransaction: jest.fn((fn: (manager: EntityManager) => unknown) =>
        fn(fakeManager),
      ),
    };
    service = new AddressesService(
      repository as unknown as AddressesRepository,
    );
  });

  describe('create', () => {
    it('makes the first address the default regardless of the requested flag', async () => {
      repository.countActiveByUserId.mockResolvedValue(0);

      const result = await service.create('user-1', {
        recipientName: 'A',
        phoneNumber: '0912345678',
        province: 'HN',
        district: 'CG',
        ward: 'DV',
        streetAddress: '1 X',
      });

      expect(repository.clearDefaultForUser).toHaveBeenCalledWith(
        'user-1',
        fakeManager,
      );
      expect(result.isDefault).toBe(true);
    });

    it('leaves a second address non-default when isDefault is not requested', async () => {
      repository.countActiveByUserId.mockResolvedValue(1);

      const result = await service.create('user-1', {
        recipientName: 'A',
        phoneNumber: '0912345678',
        province: 'HN',
        district: 'CG',
        ward: 'DV',
        streetAddress: '1 X',
      });

      expect(repository.clearDefaultForUser).not.toHaveBeenCalled();
      expect(result.isDefault).toBe(false);
    });

    it('creating with isDefault=true replaces the previous default', async () => {
      repository.countActiveByUserId.mockResolvedValue(1);

      const result = await service.create('user-1', {
        recipientName: 'A',
        phoneNumber: '0912345678',
        province: 'HN',
        district: 'CG',
        ward: 'DV',
        streetAddress: '1 X',
        isDefault: true,
      });

      expect(repository.clearDefaultForUser).toHaveBeenCalledWith(
        'user-1',
        fakeManager,
      );
      expect(result.isDefault).toBe(true);
    });

    it('locks the user row before touching the address set (serializes concurrent creates)', async () => {
      repository.countActiveByUserId.mockResolvedValue(0);

      await service.create('user-1', {
        recipientName: 'A',
        phoneNumber: '0912345678',
        province: 'HN',
        district: 'CG',
        ward: 'DV',
        streetAddress: '1 X',
      });

      expect(repository.lockUserForAddressMutation).toHaveBeenCalledWith(
        'user-1',
        fakeManager,
      );
    });
  });

  describe('update', () => {
    it('rejects isDefault=false explicitly instead of silently ignoring it', async () => {
      await expect(
        service.update('user-1', 'address-1', { isDefault: false }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.findOwnedActiveByIdForUpdate).not.toHaveBeenCalled();
    });

    it('404s when the address does not belong to the user', async () => {
      repository.findOwnedActiveByIdForUpdate.mockResolvedValue(null);

      await expect(
        service.update('user-1', 'address-1', { recipientName: 'B' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates content fields without touching isDefault when not requested', async () => {
      const address = buildAddress({ isDefault: true });
      repository.findOwnedActiveByIdForUpdate.mockResolvedValue(address);

      const result = await service.update('user-1', 'address-1', {
        recipientName: 'B',
      });

      expect(result.recipientName).toBe('B');
      expect(result.isDefault).toBe(true);
      expect(repository.clearDefaultForUser).not.toHaveBeenCalled();
    });

    it('isDefault=true on a non-default address promotes it and clears the old default', async () => {
      const address = buildAddress({ isDefault: false });
      repository.findOwnedActiveByIdForUpdate.mockResolvedValue(address);

      const result = await service.update('user-1', 'address-1', {
        isDefault: true,
      });

      expect(repository.clearDefaultForUser).toHaveBeenCalledWith(
        'user-1',
        fakeManager,
      );
      expect(result.isDefault).toBe(true);
    });
  });

  describe('delete', () => {
    it('404s when the address does not belong to the user', async () => {
      repository.findOwnedActiveByIdForUpdate.mockResolvedValue(null);

      await expect(service.delete('user-1', 'address-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('deleting a non-default address never touches default state', async () => {
      const address = buildAddress({ isDefault: false });
      repository.findOwnedActiveByIdForUpdate.mockResolvedValue(address);

      await service.delete('user-1', 'address-1');

      expect(repository.softDelete).toHaveBeenCalledWith(
        'address-1',
        fakeManager,
      );
      expect(repository.findReplacementDefaultCandidate).not.toHaveBeenCalled();
    });

    it('deleting the default address promotes the oldest remaining address', async () => {
      const address = buildAddress({ isDefault: true });
      repository.findOwnedActiveByIdForUpdate.mockResolvedValue(address);
      const replacement = buildAddress({ id: 'address-2', isDefault: false });
      repository.findReplacementDefaultCandidate.mockResolvedValue(replacement);

      await service.delete('user-1', 'address-1');

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'address-2', isDefault: true }),
        fakeManager,
      );
    });

    it('deleting the last (default) address leaves the user with no default — valid, no error', async () => {
      const address = buildAddress({ isDefault: true });
      repository.findOwnedActiveByIdForUpdate.mockResolvedValue(address);
      repository.findReplacementDefaultCandidate.mockResolvedValue(null);

      await expect(
        service.delete('user-1', 'address-1'),
      ).resolves.toBeUndefined();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('setDefault', () => {
    it('404s when the address does not belong to the user', async () => {
      repository.findOwnedActiveByIdForUpdate.mockResolvedValue(null);

      await expect(service.setDefault('user-1', 'address-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('is idempotent when the address is already the default', async () => {
      const address = buildAddress({ isDefault: true });
      repository.findOwnedActiveByIdForUpdate.mockResolvedValue(address);

      const result = await service.setDefault('user-1', 'address-1');

      expect(result.isDefault).toBe(true);
      expect(repository.clearDefaultForUser).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('promotes a non-default address and clears the previous default', async () => {
      const address = buildAddress({ isDefault: false });
      repository.findOwnedActiveByIdForUpdate.mockResolvedValue(address);

      const result = await service.setDefault('user-1', 'address-1');

      expect(repository.clearDefaultForUser).toHaveBeenCalledWith(
        'user-1',
        fakeManager,
      );
      expect(result.isDefault).toBe(true);
    });
  });

  describe('getOwnedActiveEntityOrThrow', () => {
    it('404s for both a nonexistent id and an id owned by another user (same error, no enumeration)', async () => {
      repository.findOwnedActiveById.mockResolvedValue(null);

      await expect(
        service.getOwnedActiveEntityOrThrow('user-1', 'address-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns the entity when owned', async () => {
      const address = buildAddress();
      repository.findOwnedActiveById.mockResolvedValue(address);

      await expect(
        service.getOwnedActiveEntityOrThrow('user-1', 'address-1'),
      ).resolves.toBe(address);
    });
  });

  describe('listForUser', () => {
    it('maps entities to response DTOs without leaking userId/deletedAt', async () => {
      repository.findAllActiveByUserId.mockResolvedValue([buildAddress()]);

      const result = await service.listForUser('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('userId');
      expect(result[0]).not.toHaveProperty('deletedAt');
      expect(result[0].id).toBe('address-1');
    });
  });
});
