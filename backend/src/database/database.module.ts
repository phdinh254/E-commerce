import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseConfig } from '../config/configuration';
import { SnakeCaseNamingStrategy } from './naming-strategy';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbConfig = configService.get<DatabaseConfig>('database');
        return {
          type: 'postgres',
          host: dbConfig?.host,
          port: dbConfig?.port,
          username: dbConfig?.user,
          password: dbConfig?.password,
          database: dbConfig?.name,
          ssl: dbConfig?.ssl,
          synchronize: false,
          autoLoadEntities: true,
          namingStrategy: new SnakeCaseNamingStrategy(),
        };
      },
    }),
  ],
})
export class DatabaseModule {}
