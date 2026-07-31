/// @anchor: Middleware de cache Express — intercepte les GET pour servir depuis Redis.
/// Ajoute le header `X-KontEx-Cache: HIT | MISS` pour le debugging.
///
/// # Fonctionnement
/// 1. Intercepte `res.json()` pour capturer la réponse
/// 2. Vérifie le cache Redis avant d'exécuter le handler
/// 3. Si HIT → renvoie directement la réponse cachée
/// 4. Si MISS → exécute le handler, puis écrit dans Redis
///
/// # Tenant isolation
/// Extrait `x-tenant-id` des headers (fallback: 'default_tenant').

import type { Request, Response, NextFunction } from 'express';
import { cacheService } from '../services/cacheService.js';

/**
 * Options de configuration du middleware de cache.
 */
export interface CacheMiddlewareOptions {
  /** Nom de la ressource pour le cache (ex: 'nodes', 'links', 'stats') */
  resource: string;
  /** TTL en secondes (défaut: 300) */
  ttlSeconds?: number;
  /** Fonction optionnelle pour extraire un identifiant unique de la requête */
  identifierFn?: (req: Request) => string;
}

/**
 * Extrait le tenant ID depuis le header `x-tenant-id`.
 * Fallback : 'default_tenant'.
 */
function extractTenantId(request: Request): string {
  const headerValue = request.headers['x-tenant-id'];
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof raw === 'string' && raw.length > 0) {
    // Nettoie : alphanum + tirets + underscores uniquement
    return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default_tenant';
  }
  return 'default_tenant';
}

/**
 * Extrait un identifiant par défaut depuis l'URL.
 * Exemple : GET /nodes/abc123 → identifiant = 'abc123'
 *           GET /nodes      → identifiant = 'list'
 *           GET /stats      → identifiant = 'summary'
 */
function defaultIdentifier(request: Request): string {
  // Utilise le paramètre :id si présent
  const idParam = request.params['id'];
  if (typeof idParam === 'string' && idParam.length > 0) {
    return idParam;
  }
  // Sinon, utilise le path nettoyé
  const path = request.path.replace(/^\/+|\/+$/g, '').replace(/\//g, ':');
  return path || 'root';
}

/**
 * Crée un middleware de cache Express pour les routes GET.
 *
 * @example
 * // Cache GET /nodes et GET /nodes/:id avec TTL 300s
 * router.get('/nodes', cacheMiddleware({ resource: 'nodes' }), listNodes);
 * router.get('/nodes/:id', cacheMiddleware({ resource: 'nodes' }), getNode);
 */
export function cacheMiddleware(options: CacheMiddlewareOptions) {
  const { resource, ttlSeconds = 300, identifierFn } = options;

  return async function cacheHandler(request: Request, response: Response, next: NextFunction): Promise<void> {
    // Ne cache que les GET
    if (request.method !== 'GET') {
      next();
      return;
    }

    const tenantId = extractTenantId(request);
    const identifier = identifierFn ? identifierFn(request) : defaultIdentifier(request);
    const cacheKey = cacheService.buildKey(tenantId, resource, identifier);

    try {
      // 1. Vérifier le cache
      const cached = await cacheService.get<{ body: unknown; statusCode: number }>(cacheKey);
      if (cached !== undefined) {
        response.setHeader('X-KontEx-Cache', 'HIT');
        response.status(cached.statusCode).json(cached.body);
        return;
      }

      // 2. MISS — intercepter res.json pour écrire dans le cache
      response.setHeader('X-KontEx-Cache', 'MISS');

      const originalJson = response.json.bind(response);
      response.json = function (body: unknown) {
        // Restaurer la méthode originale
        response.json = originalJson;

        // Écrire dans le cache en arrière-plan (ne bloque pas la réponse)
        cacheService.set(cacheKey, {
          body,
          statusCode: response.statusCode,
        }, ttlSeconds).catch(() => {
          // Silencieux — le cache est un bonus, pas une nécessité
        });

        // Envoyer la réponse normalement
        return originalJson(body);
      } as typeof response.json;

      next();
    } catch {
      // Redis down → mode dégradé, on passe au handler normal
      response.setHeader('X-KontEx-Cache', 'BYPASS');
      next();
    }
  };
}
