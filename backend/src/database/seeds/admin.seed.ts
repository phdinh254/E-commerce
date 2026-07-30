import 'reflect-metadata';
import { config } from 'dotenv';
import * as argon2 from 'argon2';
import { dataSourceOptions } from '../data-source';
import { DataSource } from 'typeorm';
import { UserEntity } from '../../modules/users/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';

config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

async function run(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_FULL_NAME ?? 'System Admin';

  if (!email || !password) {
    throw new Error(
      'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set to run the admin seed',
    );
  }

  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();

  try {
    const repository = dataSource.getRepository(UserEntity);
    const normalizedEmail = email.toLowerCase();
    const existing = await repository.findOne({
      where: { email: normalizedEmail },
    });

    if (existing) {
      console.log(`Admin user already exists: ${normalizedEmail} (skipped)`);
      return;
    }

    const passwordHash = await argon2.hash(password);
    const admin = repository.create({
      email: normalizedEmail,
      passwordHash,
      fullName,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
    await repository.save(admin);
    console.log(`Admin user created: ${normalizedEmail}`);
  } finally {
    await dataSource.destroy();
  }
}

run().catch((error) => {
  console.error('Admin seed failed:', error);
  process.exitCode = 1;
});
