/// @anchor: Contrôleur pour les nœuds de la toile TTC.
/// Routes : POST /nodes, GET /nodes, GET /nodes/:id, POST /nodes/:id/verify

import type { Request, Response, NextFunction } from 'express';
import { ttcService } from '../services/ttcService.js';

/**
 * POST /nodes — Ajoute un nœud à la toile.
 * @side-effect: modifie le store TTC en mémoire.
 */
export async function createNode(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const node = ttcService.addNode(request.body);
    response.status(201).json(node);
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * GET /nodes — Liste tous les nœuds.
 * Fonction pure (E2) — lecture seule.
 */
export async function listNodes(_request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const nodes = ttcService.listNodes();
    response.json({ nodes, total: nodes.length });
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * GET /nodes/:id — Récupère un nœud par ID.
 * Fonction pure (E2).
 */
export async function getNode(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const id = request.params['id'] as string | undefined;
    if (!id) {
      response.status(400).json({ error: 'ID requis' });
      return;
    }

    const node = ttcService.getNode(id);
    if (!node) {
      response.status(404).json({ error: `Nœud ${id} introuvable` });
      return;
    }

    response.json(node);
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * POST /nodes/:id/verify — Vérifie l'ancrage d'un nœud (Principe A).
 * Fonction pure (E2).
 */
export async function verifyNode(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const id = request.params['id'] as string | undefined;
    if (!id) {
      response.status(400).json({ error: 'ID requis' });
      return;
    }

    const verification = ttcService.verifyAnchoring(id);
    response.json(verification);
  } catch (error: unknown) {
    next(error);
  }
}
