/// @anchor: API Gateway — PROJECT_CONTEXT.md §3.1
/// ContextClient : client HTTP typé pour l'API KontEx.
///
/// # Principes TTC
/// - A1 : chaque appel est ancré sur l'API Gateway
/// - E3 : gestion d'erreur explicite, jamais de catch vide
/// - P3 : retry avec backoff exponentiel

import type { HealthReport } from './types.js';

/**
 * Configuration du client KontEx.
 */
export interface ClientConfiguration {
  /** URL de base de l'API Gateway */
  readonly baseUrl: string;
  /** Timeout en millisecondes (défaut : 5000) */
  readonly timeout: number;
  /** Nombre maximal de tentatives (défaut : 3) */
  readonly maxRetries: number;
  /** Délai initial entre les tentatives en ms (défaut : 300) */
  readonly retryDelay: number;
}

const DEFAULT_CONFIGURATION: ClientConfiguration = {
  baseUrl: 'http://localhost:3000',
  timeout: 5000,
  maxRetries: 3,
  retryDelay: 300,
} as const;

/**
 * Erreur spécifique au client KontEx.
 */
export class KontExClientError extends Error {
  public readonly statusCode: number;
  public readonly endpoint: string;

  constructor(message: string, statusCode: number, endpoint: string) {
    super(`[KontEx::Client] ${message}`);
    this.name = 'KontExClientError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }
}

/**
 * Client HTTP pour l'API Gateway KontEx.
 *
 * # Usage
 * ```typescript
 * const client = new ContextClient({ baseUrl: 'http://localhost:3000' });
 * const health = await client.getHealth();
 * ```
 */
export class ContextClient {
  private readonly configuration: ClientConfiguration;

  constructor(configuration?: Partial<ClientConfiguration>) {
    this.configuration = { ...DEFAULT_CONFIGURATION, ...configuration };
  }

  /**
   * Effectue une requête GET avec retry automatique.
   * @side-effect: appelle l'API Gateway via HTTP.
   */
  private async fetchWithRetry<TResponse>(endpoint: string): Promise<TResponse> {
    const { baseUrl, timeout, maxRetries, retryDelay } = this.configuration;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': `KontEx-SDK/${'0.1.0-alpha'}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new KontExClientError(
            `Échec HTTP ${response.status} sur ${endpoint}`,
            response.status,
            endpoint,
          );
        }

        const data: unknown = await response.json();
        return data as TResponse;
      } catch (error: unknown) {
        lastError = error;

        // Ne retente pas sur une erreur d'abort (timeout)
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new KontExClientError(
            `Timeout après ${timeout}ms sur ${endpoint}`,
            408,
            endpoint,
          );
        }

        // Dernière tentative : propager l'erreur
        if (attempt === maxRetries - 1) {
          break;
        }

        // Backoff exponentiel : delay * 2^attempt
        const delay = retryDelay * Math.pow(2, attempt);
        await this.sleep(delay);
      }
    }

    // Si on arrive ici, toutes les tentatives ont échoué
    if (lastError instanceof KontExClientError) {
      throw lastError;
    }
    throw new KontExClientError(
      `Échec après ${maxRetries} tentatives sur ${endpoint}`,
      0,
      endpoint,
    );
  }

  /**
   * GET /health — Vérifie l'état de santé de l'API.
   * @side-effect: appel HTTP à l'API Gateway.
   */
  async getHealth(): Promise<HealthReport> {
    return this.fetchWithRetry<HealthReport>('/health');
  }

  /**
   * Vérifie si l'API Gateway est accessible.
   * @side-effect: appel HTTP.
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.getHealth();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Pause asynchrone pour le backoff.
   * Fonction pure (E2).
   */
  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
