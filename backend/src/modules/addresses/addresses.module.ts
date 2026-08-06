import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddressEntity } from './entities/address.entity';
import { AddressesRepository } from './addresses.repository';
import { AddressesService } from './addresses.service';
import { AddressesController } from './addresses.controller';

/**
 * Ch18: full CRUD + default-address business rules. Exports
 * AddressesService (not the repository) so CheckoutModule can resolve and
 * ownership-check an addressId for the shipping snapshot without reaching
 * into Address's persistence layer directly.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AddressEntity])],
  controllers: [AddressesController],
  providers: [AddressesRepository, AddressesService],
  exports: [AddressesService],
})
export class AddressesModule {}
