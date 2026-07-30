/// @anchor: Contrôleur pour la détection d'hallucination.
/// Routes : POST /detect, POST /propagate, GET /stats

import type { Request, Response, NextFunction } from 'express';
import { ttcService } from '../services/ttcService.js';

/**
 * POST /detect — Analyse une réponse LLM et détecte les hallucinations.
 * Fonction pure (E2) — lecture seule de la toile.
 */
export async function detectHallucination(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { content } = request.body as { content?: string };
    if (!content || content.length === 0) {
      response.status(400).json({ error: 'Le champ "content" est requis' });
      return;
    }

    const report = ttcService.detectHallucination(content);
    response.json(report);
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * POST /propagate — Propage le contexte depuis un nœud source.
 * Fonction pure (E2).
 */
export async function propagateContext(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { sourceId, threshold, maxDepth } = request.body as {
      sourceId?: string;
      threshold?: number;
      maxDepth?: number;
    };

    if (!sourceId) {
      response.status(400).json({ error: 'Le champ "sourceId" est requis' });
      return;
    }

    const result = ttcService.propagateContext(sourceId, threshold ?? 0.01, maxDepth ?? 10);
    response.json(result);
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * GET /stats — Statistiques globales de la toile.
 * Fonction pure (E2).
 */
export async function getStats(_request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const stats = ttcService.getStats();
    response.json(stats);
  } catch (error: unknown) {
    next(error);
  }
}
