/// @anchor: Contrôleur pour les liens de la toile TTC.
/// Routes : POST /links, GET /links

import type { Request, Response, NextFunction } from 'express';
import { ttcService } from '../services/ttcService.js';
import { cacheService } from '../services/cacheService.js';

/** Extrait le tenant ID du header. */
function extractTenantId(request: Request): string {
  const headerValue = request.headers['x-tenant-id'];
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof raw === 'string' && raw.length > 0) {
    return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default_tenant';
  }
  return 'default_tenant';
}

/**
 * POST /links — Ajoute un lien entre deux nœuds.
 * @side-effect: modifie le store TTC + invalide le cache links et stats.
 */
export async function createLink(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const link = await ttcService.addLink(request.body);
    // Invalide le cache pour ce tenant (en arrière-plan)
    const tenantId = extractTenantId(request);
    cacheService.invalidateResources(tenantId, ['links', 'stats']).catch(() => {});
    response.status(201).json(link);
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * GET /links — Liste tous les liens.
 * Fonction pure (E2).
 */
export async function listLinks(_request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const links = await ttcService.listLinks();
    response.json({ links, total: links.length });
  } catch (error: unknown) {
    next(error);
  }
}
