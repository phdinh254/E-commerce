import { EntityManager } from 'typeorm';
import * as argon2 from 'argon2';
import { UserEntity } from '../../../modules/users/entities/user.entity';
import { UserRole } from '../../../common/enums/user-role.enum';
import { UserStatus } from '../../../common/enums/user-status.enum';
import { UserSeedRecordDto } from '../dto/user-seed-record.dto';

export interface UsersSeedResult {
  created: number;
  updated: number;
}

export interface SeedPasswords {
  admin: string;
  default: string;
}

/**
 * Natural key: email (case-insensitive, matching the app's own
 * `UQ_users_email` + AuthService normalization). Reuses `argon2.hash()`
 * with the same default options AuthService/admin.seed.ts already use —
 * never a different cost/algorithm.
 *
 * Never sends verification email, OTP, welcome email, refresh token, or
 * calls OAuth — this only writes rows via the DataSource passed in by
 * seed.ts (no HTTP server, no AuthService instantiated).
 */
export async function seedUsers(
  manager: EntityManager,
  records: UserSeedRecordDto[],
  passwords: SeedPasswords,
): Promise<UsersSeedResult> {
  const repository = manager.getRepository(UserEntity);
  let created = 0;
  let updated = 0;

  for (const record of records) {
    const normalizedEmail = record.email.toLowerCase().trim();
    const plainPassword =
      record.role === UserRole.ADMIN ? passwords.admin : passwords.default;
    const passwordHash = await argon2.hash(plainPassword);

    const existing = await repository.findOne({
      where: { email: normalizedEmail },
    });

    if (existing) {
      // Update policy: demo profile fields may be refreshed; password is
      // NOT rotated on every re-run (would silently invalidate whatever
      // the operator has been logging in with), and a soft-deleted seed
      // user is never silently resurrected.
      if (existing.deletedAt) {
        continue;
      }
      existing.fullName = record.fullName;
      existing.role = record.role;
      existing.status = record.status ?? UserStatus.ACTIVE;
      await repository.save(existing);
      updated += 1;
      continue;
    }

    const created_ = repository.create({
      email: normalizedEmail,
      passwordHash,
      fullName: record.fullName,
      role: record.role,
      status: record.status ?? UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    });
    await repository.save(created_);
    created += 1;
  }

  return { created, updated };
}
