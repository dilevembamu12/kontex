/// @anchor: Express route handler — https://expressjs.com/en/guide/routing.html
/// Contrôleur pour la route GET /health.
/// Principe TTC E2 : le handler est une fonction pure (délégue au service).
/// Principe TTC E3 : gestion d'erreur explicite avec try/catch.

import type { Request, Response, NextFunction } from 'express';
import { getHealthReport } from '../services/healthService.js';

/**
 * Temps de démarrage du serveur pour le calcul d'uptime.
 * Stocké au niveau du module — seule variable mutable autorisée.
 */
const serverStartTime: number = Date.now();

/**
 * GET /health — Retourne l'état de santé de l'API et de ses dépendances.
 * @side-effect: appelle les services de diagnostic (simulés en Phase 0).
 */
export async function getHealth(_request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
    const healthReport = await getHealthReport(uptimeSeconds);

    // Détermine le code HTTP selon l'état global
    const httpStatus = healthReport.status === 'healthy' ? 200 : 503;

    response.status(httpStatus).json(healthReport);
  } catch (error: unknown) {
    // Propagation explicite vers le middleware d'erreur global (E3)
    next(error);
  }
}
