import {
  Global,
  Module,
  OnApplicationShutdown,
  Provider,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisConfig } from '../../config/configuration';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const redisConfig = configService.get<RedisConfig>('redis');
    return new Redis({
      host: redisConfig?.host,
      port: redisConfig?.port,
      password: redisConfig?.password,
      maxRetriesPerRequest: null,
    });
  },
};

@Global()
@Module({
  providers: [redisProvider, RedisService],
  exports: [redisProvider, RedisService],
})
export class RedisModule implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisModule.name);

  constructor(private readonly redisService: RedisService) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redisService.getClient().quit();
    this.logger.log('Redis connection closed');
  }
}
