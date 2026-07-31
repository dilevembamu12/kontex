/// @anchor: Rate Limiting B2B2B — Limite de requêtes par clé API / IP.
/// Implémentation sliding window in-memory (sans dépendance Redis).
///
/// # Limites par défaut
/// - 100 requêtes / minute par clé API (identifiée par X-API-Key)
/// - 20 requêtes / minute par IP (si pas de clé)
///
/// # Headers de réponse
/// - `X-RateLimit-Limit` : limite totale
/// - `X-RateLimit-Remaining` : requêtes restantes
/// - `X-RateLimit-Reset` : timestamp Unix de réinitialisation

import type { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number; // timestamp Unix en ms
}

interface RateLimitOptions {
  /** Nombre max de requêtes dans la fenêtre */
  maxRequests: number;
  /** Durée de la fenêtre en secondes */
  windowSeconds: number;
  /** Préfixe de clé pour les logs */
  label?: string;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  maxRequests: 100,
  windowSeconds: 60,
};

// Store in-memory (en production : remplacer par Redis)
const store = new Map<string, RateLimitEntry>();

// Nettoyage périodique des entrées expirées (toutes les 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
  // Permet au processus de s'arrêter proprement
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    (cleanupTimer as NodeJS.Timeout).unref();
  }
}

/**
 * Extrait l'identifiant du client pour le rate limiting.
 * Priorité : X-API-Key > IP
 */
function getClientIdentifier(request: Request): string {
  const apiKey = request.headers['x-api-key'];
  const rawKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;
  if (typeof rawKey === 'string' && rawKey.length > 0) {
    return `key:${rawKey.slice(0, 16)}`;
  }
  const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';
  return `ip:${ip}`;
}

/**
 * Crée un middleware de rate limiting.
 *
 * @example
 * // Limite stricte pour les mutations
 * app.post('/nodes', rateLimiter({ maxRequests: 30, windowSeconds: 60 }), createNode);
 *
 * @example
 * // Limite large pour les lectures
 * app.get('/nodes', rateLimiter({ maxRequests: 200, windowSeconds: 60 }), listNodes);
 */
export function rateLimiter(options: Partial<RateLimitOptions> = {}) {
  const config: RateLimitOptions = { ...DEFAULT_OPTIONS, ...options };
  startCleanup();

  return function rateLimitHandler(request: Request, response: Response, next: NextFunction): void {
    const clientId = getClientIdentifier(request);
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;

    let entry = store.get(clientId);

    // Nouvelle fenêtre si expirée ou absente
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(clientId, entry);
    }

    entry.count++;

    const remaining = Math.max(0, config.maxRequests - entry.count);
    const resetUnix = Math.ceil(entry.resetAt / 1000);

    // Headers standard RFC — utilise response.setHeader directement
    response.setHeader('X-RateLimit-Limit', String(config.maxRequests));
    response.setHeader('X-RateLimit-Remaining', String(remaining));
    response.setHeader('X-RateLimit-Reset', String(resetUnix));

    if (entry.count > config.maxRequests) {
      const label = config.label ? ` [${config.label}]` : '';
      response.status(429).json({
        error: 'Too Many Requests',
        message: `Limite de ${config.maxRequests} requêtes par ${config.windowSeconds}s atteinte${label}. Réessayez dans ${Math.ceil((entry.resetAt - now) / 1000)}s.`,
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
      return;
    }

    next();
  };
}
