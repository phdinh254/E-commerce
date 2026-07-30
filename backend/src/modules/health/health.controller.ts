import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';
import { RedisService } from '../../infrastructure/cache/redis.service';

@ApiTags('health')
@Controller({ path: 'health' })
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Check backend, database and cache health' })
  @ApiResponse({ status: 200, description: 'All dependencies are healthy' })
  @ApiResponse({
    status: 503,
    description: 'One or more dependencies are down',
  })
  async check(): Promise<{
    status: 'ok';
    database: 'up';
    redis: 'up';
    timestamp: string;
  }> {
    const databaseUp = await this.checkDatabase();
    const redisUp = await this.checkRedis();

    if (!databaseUp || !redisUp) {
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Một hoặc nhiều dịch vụ phụ thuộc không khả dụng',
      });
    }

    return {
      status: 'ok',
      database: 'up',
      redis: 'up',
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const pong = await this.redisService.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
