import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ProfileController } from './profile.controller';

/**
 * Ch18-B177: thin module — reuses UsersModule's UsersService/UsersRepository
 * rather than a second data-access abstraction over the same `users` table.
 * No new TypeOrmModule.forFeature, no new DataSource, no new Redis/HTTP
 * client.
 */
@Module({
  imports: [UsersModule],
  controllers: [ProfileController],
})
export class ProfileModule {}
