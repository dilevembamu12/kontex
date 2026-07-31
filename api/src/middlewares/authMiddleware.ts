/// @anchor: Authentification B2B2B — PROJECT_CONTEXT.md §4.1 Multi-tenant
/// Middleware de validation de clé API par header `X-API-Key`.
///
/// # Mode développement
/// Si `NODE_ENV=development` et `KONTEX_API_KEYS` non définie,
/// toutes les requêtes sont acceptées avec un warning.
///
/// # Mode production
/// La variable `KONTEX_API_KEYS` contient une liste de clés séparées par des virgules.
/// Chaque clé est associée à un tenant : `key1:tenantA,key2:tenantB`.
/// Format simple : `key1,key2` → tenant = 'default_tenant'.
///
/// # Headers
/// - `X-API-Key: <clé>` — requis en production
/// - `x-tenant-id` — automatiquement défini à partir de la clé

import type { Request, Response, NextFunction } from 'express';
import { environment } from '../config/environment.js';

/**
 * Map des clés API → tenant ID.
 * Chargée depuis KONTEX_API_KEYS au démarrage.
 */
interface ApiKeyEntry {
  key: string;
  tenantId: string;
}

let apiKeys: ApiKeyEntry[] | null = null;

/**
 * Charge les clés API depuis la variable d'environnement.
 * Format : `key1:tenantA,key2:tenantB` ou `key1,key2` (tenant = default_tenant).
 */
function loadApiKeys(): ApiKeyEntry[] {
  if (apiKeys !== null) return apiKeys;

  const raw = process.env['KONTEX_API_KEYS'];
  if (!raw || raw.length === 0) {
    apiKeys = [];
    return apiKeys;
  }

  apiKeys = raw.split(',').map((entry) => {
    const trimmed = entry.trim();
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0) {
      return {
        key: trimmed.slice(0, colonIndex),
        tenantId: trimmed.slice(colonIndex + 1),
      };
    }
    return { key: trimmed, tenantId: 'default_tenant' };
  });

  console.log(`[KontEx::Auth] ${apiKeys.length} clé(s) API chargée(s)`);
  return apiKeys;
}

/**
 * Valide une clé API et retourne le tenant associé, ou `null` si invalide.
 */
function validateApiKey(key: string): { tenantId: string } | null {
  const keys = loadApiKeys();
  const entry = keys.find((e) => e.key === key);
  if (entry) {
    return { tenantId: entry.tenantId };
  }
  return null;
}

/**
 * Middleware d'authentification par clé API.
 *
 * - En développement sans clés configurées : accepte tout (mode ouvert)
 * - En production : rejette les requêtes sans clé valide (401)
 * - Injecte `x-tenant-id` dans les headers si absent
 */
export function apiKeyAuth(request: Request, response: Response, next: NextFunction): void {
  // Routes publiques (healthcheck)
  const publicPaths = ['/health'];
  if (publicPaths.includes(request.path)) {
    next();
    return;
  }

  const apiKey = request.headers['x-api-key'];
  const rawKey = Array.isArray(apiKey) ? apiKey[0] : apiKey;

  // Mode développement ouvert
  const keys = loadApiKeys();
  if (environment.NODE_ENV === 'development' && keys.length === 0) {
    // Injecte un tenant par défaut
    if (!request.headers['x-tenant-id']) {
      request.headers['x-tenant-id'] = 'default_tenant';
    }
    next();
    return;
  }

  // Mode authentifié
  if (typeof rawKey !== 'string' || rawKey.length === 0) {
    response.status(401).json({
      error: 'Unauthorized',
      message: 'Header X-API-Key requis. Obtenez une clé sur https://kontex.dev/keys',
    });
    return;
  }

  const result = validateApiKey(rawKey);
  if (!result) {
    response.status(403).json({
      error: 'Forbidden',
      message: 'Clé API invalide',
    });
    return;
  }

  // Injecte le tenant ID dans les headers pour le cache et les repositories
  if (!request.headers['x-tenant-id']) {
    request.headers['x-tenant-id'] = result.tenantId;
  }

  next();
}
