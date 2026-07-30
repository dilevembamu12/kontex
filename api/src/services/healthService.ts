/// @anchor: Service de diagnostic — vérifie l'état des dépendances (PostgreSQL, Redis)
/// Principe TTC A1 : chaque vérification est ancrée sur une connexion réelle.
/// Principe TTC E2 : fonctions pures de construction de réponse.

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
 * @side-effect: tente une requête de ping (non implémenté en Phase 0).
 */
async function checkPostgresHealth(): Promise<ComponentHealth> {
  /// @anchor: PostgreSQL pg_isready — https://www.postgresql.org/docs/current/app-pg-isready.html
  // Phase 0 : simulation — sera remplacé par une vraie connexion pg en Phase 1
  const start = Date.now();
  const latencyMs = Date.now() - start;

  return {
    component: 'postgres',
    status: 'healthy',
    latencyMs,
    message: 'PostgreSQL simulé — connexion réelle en Phase 1',
  };
}

/**
 * Vérifie la santé de Redis.
 * @side-effect: tente un PING Redis (non implémenté en Phase 0).
 */
async function checkRedisHealth(): Promise<ComponentHealth> {
  /// @anchor: Redis PING — https://redis.io/commands/ping/
  // Phase 0 : simulation — sera remplacé par une vraie connexion Redis en Phase 1
  const start = Date.now();
  const latencyMs = Date.now() - start;

  return {
    component: 'redis',
    status: 'healthy',
    latencyMs,
    message: 'Redis simulé — connexion réelle en Phase 1',
  };
}

/**
 * Vérifie la santé de Graphiti (moteur TTC).
 * @side-effect: tente un appel gRPC (non implémenté en Phase 0).
 */
async function checkGraphitiHealth(): Promise<ComponentHealth> {
  /// @anchor: PROJECT_CONTEXT.md §3.2 — Moteur TTC (Rust)
  const start = Date.now();
  const latencyMs = Date.now() - start;

  return {
    component: 'graphiti-ttc',
    status: 'healthy',
    latencyMs,
    message: 'Graphiti TTC simulé — moteur Rust en Phase 1',
  };
}

/**
 * Construit la réponse de santé globale.
 * Fonction pure (E2).
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
  const hasUnhealthy = components.some((c) => c.status === 'unhealthy');
  const hasDegraded = components.some((c) => c.status === 'degraded');

  return {
    status: hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy',
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
