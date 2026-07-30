/// @anchor: Contrôleur pour les liens de la toile TTC.
/// Routes : POST /links, GET /links

import type { Request, Response, NextFunction } from 'express';
import { ttcService } from '../services/ttcService.js';

/**
 * POST /links — Ajoute un lien entre deux nœuds.
 * @side-effect: modifie le store TTC en mémoire.
 */
export async function createLink(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const link = ttcService.addLink(request.body);
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
    const links = ttcService.listLinks();
    response.json({ links, total: links.length });
  } catch (error: unknown) {
    next(error);
  }
}
