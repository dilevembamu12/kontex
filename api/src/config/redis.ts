/// @anchor: Redis — PROJECT_CONTEXT.md §3.1 Cache Layer
/// Module de connexion au cache Redis pour les nœuds fréquents.

import { environment } from './environment.js';

/**
 * Interface pour le client Redis.
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  /** Supprime toutes les clés correspondant à un pattern (ex: kontex:cache:*:nodes:*) */
  deleteByPattern(pattern: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  /** Vérifie que Redis est joignable (PING) */
  ping(): Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * Crée le client Redis réel.
 */
async function createRedisClient(): Promise<RedisClient> {
  try {
    const RedisModule = await import('ioredis');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Redis = (RedisModule as any).default;

    const redis = new Redis(environment.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 3) return null; // Arrête après 3 tentatives
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    await redis.connect();
    await redis.ping();

    console.log('[KontEx::Redis] Connexion Redis établie');

    return {
      async get(key: string): Promise<string | null> {
        return redis.get(key);
      },
      async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        if (ttlSeconds) {
          await redis.setex(key, ttlSeconds, value);
        } else {
          await redis.set(key, value);
        }
      },
      async del(key: string): Promise<void> {
        await redis.del(key);
      },
      async deleteByPattern(pattern: string): Promise<number> {
        let cursor = '0';
        let deletedCount = 0;
        do {
          const [newCursor, keys] = await redis.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            100,
          );
          cursor = newCursor;
          if (keys.length > 0) {
            const pipeline = redis.pipeline();
            for (const k of keys) {
              pipeline.del(k);
            }
            const results = await pipeline.exec();
            if (results) {
              for (const [err] of results) {
                if (!err) deletedCount++;
              }
            }
          }
        } while (cursor !== '0');
        return deletedCount;
      },
      async exists(key: string): Promise<boolean> {
        const result = await redis.exists(key);
        return result === 1;
      },
      async ping(): Promise<boolean> {
        try {
          const result = await redis.ping();
          return result === 'PONG';
        } catch {
          return false;
        }
      },
      async connect() {
        await redis.ping();
      },
      async disconnect() {
        await redis.quit();
      },
    };
  } catch (error: unknown) {
    console.warn('[KontEx::Redis] Redis indisponible — cache désactivé');
    if (error instanceof Error) {
      console.warn(`  Cause : ${error.message}`);
    }
    return createNoopCache();
  }
}

/**
 * Cache no-op pour le développement sans Redis.
 */
function createNoopCache(): RedisClient {
  return {
    async get() { return null; },
    async set() { /* no-op */ },
    async del() { /* no-op */ },
    async deleteByPattern() { return 0; },
    async exists() { return false; },
    async ping() { return false; },
    async connect() { /* no-op */ },
    async disconnect() { /* no-op */ },
  };
}

let redisClient: RedisClient | null = null;

/**
 * Retourne le client Redis (singleton).
 */
export async function getRedis(): Promise<RedisClient> {
  if (!redisClient) {
    redisClient = await createRedisClient();
  }
  return redisClient;
}
