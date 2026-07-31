import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddressEntity } from './entities/address.entity';

/**
 * Registers AddressEntity so autoLoadEntities picks it up at runtime and a
 * repository is available for injection once Address CRUD is built.
 * Intentionally has no controller/service — those are out of scope here.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AddressEntity])],
})
export class AddressesModule {}
