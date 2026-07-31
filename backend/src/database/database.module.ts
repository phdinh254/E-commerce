import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseConfig } from '../config/configuration';
import { createPostgresConnectionOptions } from './database.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get<DatabaseConfig>(
          'database',
        ) as DatabaseConfig;
        return {
          ...createPostgresConnectionOptions(dbConfig),
          autoLoadEntities: true,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
