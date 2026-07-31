/// @anchor: Service de diagnostic — vérifie l'état des dépendances (PostgreSQL, Redis)
/// Principe TTC A1 : chaque vérification est ancrée sur une connexion réelle.
/// Principe TTC E2 : fonctions pures de construction de réponse.

import { getRedis } from '../config/redis.js';

/**
 * Représente l'état de santé d'un composant de l'infrastructure.
 */
export interface ComponentHealth {
  readonly component: string;
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly latencyMs: number;
  readonly message: string;
}

/**
 * Vérifie la santé de la base de données PostgreSQL.
 * Effectue un vrai SELECT 1 si DATABASE_URL est définie.
 */
async function checkPostgresHealth(): Promise<ComponentHealth> {
  const start = Date.now();

  try {
    // Vérification réelle via le pool pg si configuré
    if (process.env['DATABASE_URL']) {
      const pg = await import('pg');
      const { Pool } = pg.default as typeof import('pg');
      const pool = new Pool({
        connectionString: process.env['DATABASE_URL'],
        connectionTimeoutMillis: 3000,
        max: 1,
      });
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      await pool.end();
      const latencyMs = Date.now() - start;
      return {
        component: 'postgres',
        status: 'healthy',
        latencyMs,
        message: `PostgreSQL connecté — ${latencyMs}ms`,
      };
    }
  } catch (error: unknown) {
    const latencyMs = Date.now() - start;
    const msg = error instanceof Error ? error.message : 'Erreur inconnue';
    return {
      component: 'postgres',
      status: 'unhealthy',
      latencyMs,
      message: `PostgreSQL injoignable : ${msg}`,
    };
  }

  // Pas de DATABASE_URL → mode mémoire (dégradé mais fonctionnel)
  const latencyMs = Date.now() - start;
  return {
    component: 'postgres',
    status: 'degraded',
    latencyMs,
    message: 'PostgreSQL non configuré — stockage in-memory actif',
  };
}

/**
 * Vérifie la santé de Redis via PING réel.
 */
async function checkRedisHealth(): Promise<ComponentHealth> {
  const start = Date.now();

  try {
    const redis = await getRedis();
    const isAlive = await redis.ping();
    const latencyMs = Date.now() - start;

    return {
      component: 'redis',
      status: isAlive ? 'healthy' : 'unhealthy',
      latencyMs,
      message: isAlive
        ? `Redis connecté — ${latencyMs}ms`
        : 'Redis ne répond pas au PING',
    };
  } catch (error: unknown) {
    const latencyMs = Date.now() - start;
    const msg = error instanceof Error ? error.message : 'Erreur inconnue';
    return {
      component: 'redis',
      status: 'degraded',
      latencyMs,
      message: `Redis en mode dégradé : ${msg}`,
    };
  }
}

/**
 * Vérifie la santé de Graphiti (moteur TTC Rust).
 */
async function checkGraphitiHealth(): Promise<ComponentHealth> {
  const start = Date.now();

  try {
    // Tentative de chargement du module natif Rust
    const engine = await import('./ttcEngine.js');
    const stats = await engine.getStats();
    const latencyMs = Date.now() - start;

    return {
      component: 'graphiti-ttc',
      status: 'healthy',
      latencyMs,
      message: stats
        ? `Moteur TTC actif — ${(stats as Record<string, unknown>)['nodeCount'] ?? '?'} nœuds — ${latencyMs}ms`
        : `Moteur TTC actif — ${latencyMs}ms`,
    };
  } catch {
    const latencyMs = Date.now() - start;
    return {
      component: 'graphiti-ttc',
      status: 'degraded',
      latencyMs,
      message: 'Moteur TTC en mode fallback TypeScript (module natif non chargé)',
    };
  }
}

/**
 * Construit la réponse de santé globale.
 * Seuls PostgreSQL et Redis sont considérés comme critiques.
 * Graphiti en fallback TypeScript est acceptable (status = healthy si PG+Redis OK).
 */
function buildHealthResponse(
  components: readonly ComponentHealth[],
  uptimeSeconds: number,
): {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly timestamp: string;
  readonly uptime: number;
  readonly version: string;
  readonly components: readonly ComponentHealth[];
} {
  // Composants critiques : PostgreSQL + Redis
  const criticalComponents = components.filter(
    (c) => c.component === 'postgres' || c.component === 'redis',
  );
  const hasCriticalUnhealthy = criticalComponents.some((c) => c.status === 'unhealthy');
  const hasCriticalDegraded = criticalComponents.some((c) => c.status === 'degraded');

  return {
    status: hasCriticalUnhealthy ? 'unhealthy' : hasCriticalDegraded ? 'degraded' : 'healthy',
    timestamp: new Date().toISOString(),
    uptime: uptimeSeconds,
    version: '0.1.0-alpha',
    components,
  };
}

/**
 * Exécute tous les checks de santé et retourne le rapport agrégé.
 * @side-effect: appelle les services externes (simulés en Phase 0).
 */
export async function getHealthReport(uptimeSeconds: number) {
  const components = await Promise.all([
    checkPostgresHealth(),
    checkRedisHealth(),
    checkGraphitiHealth(),
  ]);

  return buildHealthResponse(components, uptimeSeconds);
}
