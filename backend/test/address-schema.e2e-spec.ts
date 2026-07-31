import { DataSource } from 'typeorm';
import dataSource from '../src/database/data-source';
import { AddressEntity } from '../src/modules/addresses/entities/address.entity';
import { UserEntity } from '../src/modules/users/entities/user.entity';

/**
 * These tests exercise real PostgreSQL behavior (foreign keys, partial
 * unique indexes) against an isolated test database — not mocks, and not
 * SQLite, since those cannot verify Postgres-specific partial index
 * enforcement.
 */
describe('Address schema (PostgreSQL integration)', () => {
  let ds: DataSource;
  let userCounter = 0;

  beforeAll(async () => {
    ds = await dataSource.initialize();
  });

  afterAll(async () => {
    await ds.destroy();
  });

  beforeEach(async () => {
    await ds.query('TRUNCATE TABLE "addresses" CASCADE');
    await ds.query('TRUNCATE TABLE "refresh_tokens" CASCADE');
    await ds.query('TRUNCATE TABLE "users" CASCADE');
    userCounter = 0;
  });

  const addressRepo = () => ds.getRepository(AddressEntity);
  const userRepo = () => ds.getRepository(UserEntity);

  async function createUser(): Promise<UserEntity> {
    userCounter += 1;
    return userRepo().save(
      userRepo().create({
        email: `address-test-${userCounter}@example.com`,
        passwordHash: 'not-a-real-hash',
        fullName: 'Address Test User',
      }),
    );
  }

  function baseAddress(userId: string, overrides: Partial<AddressEntity> = {}) {
    return {
      userId,
      recipientName: 'Nguyễn Văn A',
      phoneNumber: '0901234567',
      province: 'TP. Hồ Chí Minh',
      district: 'Quận 1',
      ward: 'Phường Bến Nghé',
      streetAddress: '123 Đường Lê Lợi',
      ...overrides,
    };
  }

  it('creates multiple addresses for the same user', async () => {
    const user = await createUser();

    const a = await addressRepo().save(
      addressRepo().create(baseAddress(user.id)),
    );
    const b = await addressRepo().save(
      addressRepo().create(baseAddress(user.id, { ward: 'Phường Đa Kao' })),
    );

    expect(a.userId).toBe(user.id);
    expect(b.userId).toBe(user.id);
  });

  it('creates multiple non-default addresses for the same user', async () => {
    const user = await createUser();

    await addressRepo().save(
      addressRepo().create(baseAddress(user.id, { isDefault: false })),
    );
    await addressRepo().save(
      addressRepo().create(baseAddress(user.id, { isDefault: false })),
    );

    const count = await addressRepo().count({ where: { userId: user.id } });
    expect(count).toBe(2);
  });

  it('creates one default address for a user', async () => {
    const user = await createUser();

    const created = await addressRepo().save(
      addressRepo().create(baseAddress(user.id, { isDefault: true })),
    );

    expect(created.isDefault).toBe(true);
  });

  it('rejects a second active default address for the same user', async () => {
    const user = await createUser();
    await addressRepo().save(
      addressRepo().create(baseAddress(user.id, { isDefault: true })),
    );

    await expect(
      addressRepo().save(
        addressRepo().create(baseAddress(user.id, { isDefault: true })),
      ),
    ).rejects.toThrow();
  });

  it('allows two different users to each have their own default address', async () => {
    const userA = await createUser();
    const userB = await createUser();

    const a = await addressRepo().save(
      addressRepo().create(baseAddress(userA.id, { isDefault: true })),
    );
    const b = await addressRepo().save(
      addressRepo().create(baseAddress(userB.id, { isDefault: true })),
    );

    expect(a.isDefault).toBe(true);
    expect(b.isDefault).toBe(true);
  });

  it('allows a new default address after the old default is soft-deleted', async () => {
    const user = await createUser();
    const oldDefault = await addressRepo().save(
      addressRepo().create(baseAddress(user.id, { isDefault: true })),
    );

    await addressRepo().softDelete(oldDefault.id);

    const newDefault = await addressRepo().save(
      addressRepo().create(baseAddress(user.id, { isDefault: true })),
    );

    expect(newDefault.isDefault).toBe(true);
  });

  it('rejects an address referencing a non-existent userId', async () => {
    await expect(
      addressRepo().save(
        addressRepo().create(
          baseAddress('00000000-0000-0000-0000-000000000000'),
        ),
      ),
    ).rejects.toThrow();
  });

  it('soft delete keeps the row in the database', async () => {
    const user = await createUser();
    const created = await addressRepo().save(
      addressRepo().create(baseAddress(user.id)),
    );

    await addressRepo().softDelete(created.id);

    const foundByDefault = await addressRepo().findOne({
      where: { id: created.id },
    });
    expect(foundByDefault).toBeNull();

    const rawRow = await ds.query(
      'SELECT deleted_at FROM "addresses" WHERE id = $1',
      [created.id],
    );
    expect(rawRow).toHaveLength(1);
    expect(rawRow[0].deleted_at).not.toBeNull();
  });

  it('stores and reads Vietnamese Unicode text correctly', async () => {
    const user = await createUser();
    const created = await addressRepo().save(
      addressRepo().create(
        baseAddress(user.id, {
          recipientName: 'Đặng Thị Bích Ngọc',
          streetAddress: '45 Đường Nguyễn Huệ, Phường Bến Nghé',
        }),
      ),
    );

    const found = await addressRepo().findOneOrFail({
      where: { id: created.id },
    });
    expect(found.recipientName).toBe('Đặng Thị Bích Ngọc');
    expect(found.streetAddress).toBe('45 Đường Nguyễn Huệ, Phường Bến Nghé');
  });

  it('defaults isDefault to false', async () => {
    const user = await createUser();
    const created = await addressRepo().save(
      addressRepo().create(baseAddress(user.id)),
    );

    const found = await addressRepo().findOneOrFail({
      where: { id: created.id },
    });
    expect(found.isDefault).toBe(false);
  });
});
