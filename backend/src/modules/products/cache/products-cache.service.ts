import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { ProductCacheConfig } from '../../../config/configuration';
import {
  PRODUCT_CACHE_SCHEMA_VERSION,
  PRODUCT_FEATURED_CACHE_PREFIX,
  PRODUCT_FEATURED_GENERATION_KEY,
  PRODUCT_SEARCH_CACHE_PREFIX,
  PRODUCT_SEARCH_GENERATION_KEY,
} from './products-cache.constants';
import {
  FeaturedProductResponseDto,
  PaginatedProductResponseDto,
} from '../dto/product-response.dto';

interface CacheEnvelope<T> {
  schemaVersion: number;
  payload: T;
}

export interface SearchCacheKeyParams {
  search?: string;
  page: number;
  limit: number;
  categoryId?: string;
  sortBy?: string;
  sortOrder: 'ASC' | 'DESC';
  minPrice?: number;
  maxPrice?: number;
}

/**
 * Cache-aside for product search and featured listings, built on the
 * existing global RedisService/RedisModule — no second Redis client, no new
 * connection lifecycle.
 *
 * Invalidation uses a per-collection generation counter (Redis INCR) rather
 * than deleting individual keys or ever calling KEYS/SCAN on the request
 * path: every cache key embeds the generation value read at request time,
 * so bumping the counter after a mutation makes every previously-cached
 * permutation of search/featured queries simultaneously unreachable —
 * without knowing or enumerating what those permutations were. The old
 * entries are never explicitly deleted; they just become dead weight until
 * their own TTL expires and Redis reclaims them.
 *
 * Every Redis operation here is wrapped so a Redis outage degrades to
 * "always cache miss" rather than breaking the public read path — the
 * caller (ProductsService) always falls back to PostgreSQL. Only actual
 * Redis errors are logged at `warn`; an ordinary cache miss is not an
 * error and is not logged at all.
 */
@Injectable()
export class ProductsCacheService {
  private readonly logger = new Logger(ProductsCacheService.name);
  private readonly cacheConfig: ProductCacheConfig;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.cacheConfig = this.configService.get<ProductCacheConfig>(
      'productCache',
    ) as ProductCacheConfig;
  }

  async buildSearchKey(params: SearchCacheKeyParams): Promise<string> {
    const generation = await this.currentGeneration(
      PRODUCT_SEARCH_GENERATION_KEY,
    );
    const digest = this.hashParams({
      q: params.search ?? '',
      page: params.page,
      limit: params.limit,
      categoryId: params.categoryId ?? '',
      sortBy: params.sortBy ?? '',
      sortOrder: params.sortOrder,
      minPrice: params.minPrice ?? '',
      maxPrice: params.maxPrice ?? '',
    });
    return `${PRODUCT_SEARCH_CACHE_PREFIX}${generation}:${digest}`;
  }

  async buildFeaturedKey(limit: number): Promise<string> {
    const generation = await this.currentGeneration(
      PRODUCT_FEATURED_GENERATION_KEY,
    );
    return `${PRODUCT_FEATURED_CACHE_PREFIX}${generation}:limit=${limit}`;
  }

  async getSearch(key: string): Promise<PaginatedProductResponseDto | null> {
    return this.safeGet<PaginatedProductResponseDto>(key);
  }

  async setSearch(
    key: string,
    value: PaginatedProductResponseDto,
  ): Promise<void> {
    await this.safeSet(key, value, this.cacheConfig.searchTtlSeconds);
  }

  async getFeatured(key: string): Promise<FeaturedProductResponseDto[] | null> {
    return this.safeGet<FeaturedProductResponseDto[]>(key);
  }

  async setFeatured(
    key: string,
    value: FeaturedProductResponseDto[],
  ): Promise<void> {
    await this.safeSet(key, value, this.cacheConfig.featuredTtlSeconds);
  }

  /** Called after a successful DB write that could affect search results. */
  async invalidateSearch(): Promise<void> {
    await this.safeIncr(PRODUCT_SEARCH_GENERATION_KEY);
  }

  /** Called after a successful DB write that could affect the featured list. */
  async invalidateFeatured(): Promise<void> {
    await this.safeIncr(PRODUCT_FEATURED_GENERATION_KEY);
  }

  private async currentGeneration(generationKey: string): Promise<number> {
    try {
      const raw = await this.redisService.get(generationKey);
      const parsed = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(parsed) ? parsed : 0;
    } catch (error) {
      this.logger.warn(
        `Redis unavailable while reading generation counter (${generationKey}); treating as generation 0`,
        error as Error,
      );
      return 0;
    }
  }

  private async safeIncr(key: string): Promise<void> {
    try {
      await this.redisService.incr(key);
    } catch (error) {
      // Non-fatal: PostgreSQL already committed the write. Worst case, a
      // stale cache entry survives until its own TTL expires — bounded
      // staleness, not silent data loss.
      this.logger.warn(
        `Redis unavailable while invalidating cache (${key}); stale entries will still expire via TTL`,
        error as Error,
      );
    }
  }

  private async safeGet<T>(key: string): Promise<T | null> {
    let raw: string | null;
    try {
      raw = await this.redisService.get(key);
    } catch (error) {
      this.logger.warn(
        'Redis GET failed; falling back to PostgreSQL',
        error as Error,
      );
      return null;
    }
    if (!raw) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.warn('Discarding product cache entry with malformed JSON');
      return null;
    }
    if (!this.isValidEnvelope(parsed)) {
      this.logger.warn('Discarding product cache entry with unexpected schema');
      return null;
    }
    return (parsed as CacheEnvelope<T>).payload;
  }

  private async safeSet<T>(
    key: string,
    value: T,
    ttlSeconds: number,
  ): Promise<void> {
    const envelope: CacheEnvelope<T> = {
      schemaVersion: PRODUCT_CACHE_SCHEMA_VERSION,
      payload: value,
    };
    try {
      await this.redisService.set(key, JSON.stringify(envelope), ttlSeconds);
    } catch (error) {
      // Non-fatal: the caller already has the freshly-queried result to
      // return to this request regardless of whether it got cached.
      this.logger.warn(
        'Redis SET failed; result was not cached',
        error as Error,
      );
    }
  }

  private isValidEnvelope(value: unknown): value is CacheEnvelope<unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'schemaVersion' in value &&
      value.schemaVersion === PRODUCT_CACHE_SCHEMA_VERSION &&
      'payload' in value
    );
  }

  private hashParams(params: Record<string, string | number>): string {
    return createHash('sha256')
      .update(JSON.stringify(params))
      .digest('hex')
      .slice(0, 16);
  }
}
