import redisClient from './redis-client';

class CacheManager {
  private inMemoryCache = new Map<string, string>();
  private useRedis: boolean;

  constructor() {
    // Check if Redis is configured and connected
    this.useRedis = Boolean(process.env.REDIS_URL) && Boolean(redisClient.isOpen);
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.useRedis) {
      try {
        const value = await redisClient.get(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.error('Redis GET error:', error);
        return null;
      }
    } else {
      const value = this.inMemoryCache.get(key);
      return value ? JSON.parse(value) : null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const stringValue = JSON.stringify(value);
    if (this.useRedis) {
      try {
        if (ttl) {
          await redisClient.set(key, stringValue, { EX: ttl });
        } else {
          await redisClient.set(key, stringValue);
        }
      } catch (error) {
        console.error('Redis SET error:', error);
      }
    } else {
      this.inMemoryCache.set(key, stringValue);
      if (ttl) {
        setTimeout(() => {
          this.inMemoryCache.delete(key);
        }, ttl * 1000);
      }
    }
  }

  async del(key: string): Promise<void> {
    if (this.useRedis) {
      try {
        await redisClient.del(key);
      } catch (error) {
        console.error('Redis DEL error:', error);
      }
    } else {
      this.inMemoryCache.delete(key);
    }
  }
}

export const cacheManager = new CacheManager();
