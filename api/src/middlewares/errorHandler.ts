/// @anchor: Express error handling — https://expressjs.com/en/guide/error-handling.html
/// Middleware global de gestion d'erreur.
/// Principe TTC E3 : toute erreur est loggée ET propagée de manière structurée.
/// Principe TTC E1 : nommage explicite — `convertUnknownToError` plutôt que `toErr`.

import type { Request, Response, NextFunction } from 'express';

/**
 * Interface normalisée pour les erreurs exposées au client.
 * Aucune information interne (stack trace, chemins) n'est divulguée.
 */
interface HttpErrorResponse {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly timestamp: string;
}

/**
 * Convertit une valeur inconnue en Error.
 * Fonction pure (E2) — pas d'effet de bord.
 */
function convertUnknownToError(maybeError: unknown): Error {
  if (maybeError instanceof Error) {
    return maybeError;
  }
  if (typeof maybeError === 'string') {
    return new Error(maybeError);
  }
  return new Error(`Erreur inconnue : ${String(maybeError)}`);
}

/**
 * Détermine le code HTTP à partir d'une Error.
 * Fonction pure (E2).
 */
function extractHttpStatus(error: Error): number {
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode;
  }
  if ('status' in error && typeof error.status === 'number') {
    return error.status;
  }
  return 500;
}

/**
 * Middleware Express de gestion globale des erreurs.
 * @side-effect: loggue dans la console (stderr en production).
 */
export function globalErrorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  const safeError = convertUnknownToError(error);
  const status = extractHttpStatus(safeError);

  // Log structuré — jamais de secret dans les logs (.cursorrules sécurité B2B2B)
  if (process.env['NODE_ENV'] === 'production') {
    console.error(`[KontEx::Error] ${status} — ${safeError.message}`);
  } else {
    console.error(`[KontEx::Error] ${status} — ${safeError.message}`, safeError.stack);
  }

  const errorResponse: HttpErrorResponse = {
    status,
    code: `ERR_${status}`,
    message: safeError.message,
    timestamp: new Date().toISOString(),
  };

  response.status(status).json(errorResponse);
}
