import { ConfigService } from '@nestjs/config';
import { ProductsCacheService } from './products-cache.service';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import {
  PRODUCT_FEATURED_GENERATION_KEY,
  PRODUCT_SEARCH_GENERATION_KEY,
} from './products-cache.constants';

function buildConfigService(): ConfigService {
  return {
    get: jest.fn().mockReturnValue({
      searchTtlSeconds: 60,
      featuredTtlSeconds: 300,
    }),
  } as unknown as ConfigService;
}

describe('ProductsCacheService', () => {
  let redis: jest.Mocked<Pick<RedisService, 'get' | 'set' | 'incr'>>;
  let service: ProductsCacheService;

  beforeEach(() => {
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      incr: jest.fn(),
    };
    service = new ProductsCacheService(
      redis as unknown as RedisService,
      buildConfigService(),
    );
  });

  describe('search cache key', () => {
    it('includes generation 0 when the generation key has never been set', async () => {
      redis.get.mockResolvedValue(null);
      const key = await service.buildSearchKey({
        page: 1,
        limit: 20,
        sortOrder: 'DESC',
      });
      expect(key).toContain(':0:');
    });

    it('changes when the keyword changes', async () => {
      redis.get.mockResolvedValue('3');
      const keyA = await service.buildSearchKey({
        search: 'áo',
        page: 1,
        limit: 20,
        sortOrder: 'DESC',
      });
      const keyB = await service.buildSearchKey({
        search: 'quần',
        page: 1,
        limit: 20,
        sortOrder: 'DESC',
      });
      expect(keyA).not.toBe(keyB);
    });

    it('changes when the page changes', async () => {
      redis.get.mockResolvedValue('3');
      const keyA = await service.buildSearchKey({
        page: 1,
        limit: 20,
        sortOrder: 'DESC',
      });
      const keyB = await service.buildSearchKey({
        page: 2,
        limit: 20,
        sortOrder: 'DESC',
      });
      expect(keyA).not.toBe(keyB);
    });

    it('changes when sortBy/sortOrder changes', async () => {
      redis.get.mockResolvedValue('3');
      const keyA = await service.buildSearchKey({
        page: 1,
        limit: 20,
        sortBy: 'price',
        sortOrder: 'ASC',
      });
      const keyB = await service.buildSearchKey({
        page: 1,
        limit: 20,
        sortBy: 'price',
        sortOrder: 'DESC',
      });
      expect(keyA).not.toBe(keyB);
    });

    it('changes when categoryId changes', async () => {
      redis.get.mockResolvedValue('3');
      const keyA = await service.buildSearchKey({
        page: 1,
        limit: 20,
        sortOrder: 'DESC',
        categoryId: 'cat-1',
      });
      const keyB = await service.buildSearchKey({
        page: 1,
        limit: 20,
        sortOrder: 'DESC',
        categoryId: 'cat-2',
      });
      expect(keyA).not.toBe(keyB);
    });

    it('produces the same key for equivalent params (order of construction does not matter)', async () => {
      redis.get.mockResolvedValue('3');
      const keyA = await service.buildSearchKey({
        page: 1,
        limit: 20,
        search: 'áo',
        sortOrder: 'DESC',
      });
      const keyB = await service.buildSearchKey({
        search: 'áo',
        sortOrder: 'DESC',
        limit: 20,
        page: 1,
      });
      expect(keyA).toBe(keyB);
    });

    it('embeds the current generation counter, read from Redis under the expected key', async () => {
      redis.get.mockResolvedValue('7');
      await service.buildSearchKey({ page: 1, limit: 20, sortOrder: 'DESC' });
      expect(redis.get).toHaveBeenCalledWith(PRODUCT_SEARCH_GENERATION_KEY);
    });
  });

  describe('featured cache key', () => {
    it('changes when limit changes', async () => {
      redis.get.mockResolvedValue('1');
      const keyA = await service.buildFeaturedKey(8);
      const keyB = await service.buildFeaturedKey(16);
      expect(keyA).not.toBe(keyB);
    });

    it('reads the featured-specific generation key, not the search one', async () => {
      redis.get.mockResolvedValue('1');
      await service.buildFeaturedKey(8);
      expect(redis.get).toHaveBeenCalledWith(PRODUCT_FEATURED_GENERATION_KEY);
    });
  });

  describe('get/set round-trip', () => {
    it('returns null on a cache miss', async () => {
      redis.get.mockResolvedValue(null);
      const result = await service.getSearch('some-key');
      expect(result).toBeNull();
    });

    it('returns the stored payload on a hit', async () => {
      const payload = {
        items: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
      redis.get.mockResolvedValue(
        JSON.stringify({ schemaVersion: 1, payload }),
      );
      const result = await service.getSearch('some-key');
      expect(result).toEqual(payload);
    });

    it('sets with the configured search TTL', async () => {
      await service.setSearch('some-key', {
        items: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
      expect(redis.set).toHaveBeenCalledWith(
        'some-key',
        expect.any(String),
        60,
      );
    });

    it('sets with the configured featured TTL', async () => {
      await service.setFeatured('some-key', []);
      expect(redis.set).toHaveBeenCalledWith(
        'some-key',
        expect.any(String),
        300,
      );
    });
  });

  describe('corrupted / malformed cache payloads', () => {
    it('falls back to null on malformed JSON', async () => {
      redis.get.mockResolvedValue('{not valid json');
      const result = await service.getSearch('some-key');
      expect(result).toBeNull();
    });

    it('falls back to null when the schema version does not match', async () => {
      redis.get.mockResolvedValue(
        JSON.stringify({ schemaVersion: 999, payload: {} }),
      );
      const result = await service.getSearch('some-key');
      expect(result).toBeNull();
    });

    it('falls back to null when the payload has an unexpected shape (no envelope)', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ items: [] }));
      const result = await service.getSearch('some-key');
      expect(result).toBeNull();
    });
  });

  describe('Redis failure fallback', () => {
    it('GET failure falls back to null (cache miss) instead of throwing', async () => {
      redis.get.mockRejectedValue(new Error('connection refused'));
      const result = await service.getSearch('some-key');
      expect(result).toBeNull();
    });

    it('SET failure does not throw and does not propagate', async () => {
      redis.set.mockRejectedValue(new Error('connection refused'));
      await expect(
        service.setSearch('some-key', {
          items: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        }),
      ).resolves.toBeUndefined();
    });

    it('generation-key GET failure defaults to generation 0 instead of throwing', async () => {
      redis.get.mockRejectedValue(new Error('connection refused'));
      const key = await service.buildSearchKey({
        page: 1,
        limit: 20,
        sortOrder: 'DESC',
      });
      expect(key).toContain(':0:');
    });

    it('invalidateSearch does not throw when Redis INCR fails', async () => {
      redis.incr.mockRejectedValue(new Error('connection refused'));
      await expect(service.invalidateSearch()).resolves.toBeUndefined();
    });

    it('invalidateFeatured does not throw when Redis INCR fails', async () => {
      redis.incr.mockRejectedValue(new Error('connection refused'));
      await expect(service.invalidateFeatured()).resolves.toBeUndefined();
    });
  });

  describe('invalidation', () => {
    it('invalidateSearch increments the search generation key', async () => {
      await service.invalidateSearch();
      expect(redis.incr).toHaveBeenCalledWith(PRODUCT_SEARCH_GENERATION_KEY);
    });

    it('invalidateFeatured increments the featured generation key', async () => {
      await service.invalidateFeatured();
      expect(redis.incr).toHaveBeenCalledWith(PRODUCT_FEATURED_GENERATION_KEY);
    });
  });
});
