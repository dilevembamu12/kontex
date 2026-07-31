/// @anchor: Cache Redis — PROJECT_CONTEXT.md §3.1 Cache Layer
/// Service de cache avec invalidation par pattern et isolation tenant.
///
/// # Format des clés
/// `kontex:cache:{tenantId}:{resource}:{identifier}`
///
/// # Stratégie
/// - TTL configurable par ressource (défaut 300s)
/// - Invalidation par SCAN + pipeline DEL sur mutation
/// - Fallback silencieux si Redis est indisponible

import { getRedis, type RedisClient } from '../config/redis.js';

const CACHE_PREFIX = 'kontex:cache';
const DEFAULT_TTL_SECONDS = 300;

/**
 * Service de cache tenant-isolé.
 * Toute clé est préfixée par `kontex:cache:{tenantId}:`.
 */
export class CacheService {
  private redis: RedisClient | null = null;

  /**
   * Initialise la connexion Redis (appelé au premier usage).
   */
  private async ensureRedis(): Promise<RedisClient> {
    if (!this.redis) {
      this.redis = await getRedis();
    }
    return this.redis;
  }

  /**
   * Construit une clé de cache tenant-isolée.
   * Format : `kontex:cache:{tenantId}:{resource}:{identifier}`
   */
  buildKey(tenantId: string, resource: string, identifier: string): string {
    return `${CACHE_PREFIX}:${tenantId}:${resource}:${identifier}`;
  }

  /**
   * Construit un pattern pour SCAN sur une ressource entière.
   * Format : `kontex:cache:{tenantId}:{resource}:*`
   */
  private buildResourcePattern(tenantId: string, resource: string): string {
    return `${CACHE_PREFIX}:${tenantId}:${resource}:*`;
  }

  /**
   * Récupère une valeur du cache et la désérialise.
   * Retourne `undefined` si absente ou si Redis est down.
   */
  async get<T = unknown>(key: string): Promise<T | undefined> {
    try {
      const redis = await this.ensureRedis();
      const raw = await redis.get(key);
      if (raw === null) return undefined;
      return JSON.parse(raw) as T;
    } catch {
      // Mode dégradé : Redis down → on ignore le cache
      return undefined;
    }
  }

  /**
   * Stocke une valeur dans le cache avec TTL.
   * Silencieux si Redis est down.
   */
  async set(key: string, value: unknown, ttlSeconds: number = DEFAULT_TTL_SECONDS): Promise<void> {
    try {
      const redis = await this.ensureRedis();
      const serialized = JSON.stringify(value);
      await redis.set(key, serialized, ttlSeconds);
    } catch {
      // Mode dégradé silencieux
    }
  }

  /**
   * Supprime une clé précise du cache.
   */
  async del(key: string): Promise<void> {
    try {
      const redis = await this.ensureRedis();
      await redis.del(key);
    } catch {
      // Silencieux
    }
  }

  /**
   * Invalide toutes les entrées de cache pour une ressource donnée d'un tenant.
   * Exemple : `invalidateResource('default_tenant', 'nodes')`
   *   → supprime toutes les clés `kontex:cache:default_tenant:nodes:*`
   *
   * Retourne le nombre de clés supprimées.
   */
  async invalidateResource(tenantId: string, resource: string): Promise<number> {
    try {
      const redis = await this.ensureRedis();
      const pattern = this.buildResourcePattern(tenantId, resource);
      const deleted = await redis.deleteByPattern(pattern);
      if (deleted > 0) {
        console.log(
          `[KontEx::Cache] Invalidé ${deleted} clé(s) pour tenant=${tenantId} resource=${resource}`,
        );
      }
      return deleted;
    } catch {
      return 0;
    }
  }

  /**
   * Invalide plusieurs ressources d'un coup pour un tenant.
   */
  async invalidateResources(tenantId: string, resources: string[]): Promise<number> {
    let total = 0;
    for (const resource of resources) {
      total += await this.invalidateResource(tenantId, resource);
    }
    return total;
  }

  /**
   * Vérifie si Redis est joignable.
   */
  async isHealthy(): Promise<boolean> {
    try {
      const redis = await this.ensureRedis();
      return redis.ping();
    } catch {
      return false;
    }
  }
}

// Singleton
export const cacheService = new CacheService();
