/// @anchor: Middleware de logging HTTP structuré
/// Principe TTC E3 : log explicite de chaque requête entrante.
/// Principe TTC E2 : la fonction de formatage est pure.

import type { Request, Response, NextFunction } from 'express';

/**
 * Formate les informations d'une requête en une ligne de log.
 * Fonction pure (E2).
 */
function formatRequestLog(request: Request): string {
  const timestamp = new Date().toISOString();
  const method = request.method;
  const url = request.originalUrl;
  const ip = request.ip ?? 'unknown';
  return `[${timestamp}] ${method} ${url} — ${ip}`;
}

/**
 * Middleware de logging pour chaque requête entrante.
 * @side-effect: écrit dans stdout (log applicatif).
 */
export function requestLogger(request: Request, _response: Response, next: NextFunction): void {
  console.log(formatRequestLog(request));
  next();
}
