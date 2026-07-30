/// @anchor: Page Health — État de santé de l'API et des dépendances.
/// Affiche les résultats du endpoint GET /health.

import { StatusBadge } from '@/components/StatusBadge';

const MOCK_COMPONENTS = [
  { component: 'kontex-api', status: 'healthy' as const, latencyMs: 12, message: 'API Gateway Express 5 opérationnelle' },
  { component: 'postgres', status: 'healthy' as const, latencyMs: 3, message: 'PostgreSQL 17 + pgvector — connecté' },
  { component: 'redis', status: 'healthy' as const, latencyMs: 1, message: 'Redis 7 — cache opérationnel' },
  { component: 'graphiti-ttc', status: 'healthy' as const, latencyMs: 8, message: 'Moteur TTC Rust — compilé et prêt' },
];

const OVERALL_STATUS: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

export default function HealthPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">💚 Santé du système</h2>
        <p className="text-gray-500 mt-1">État des services KontEx et de leurs dépendances</p>
      </div>

      {/* Overall status */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">Statut global</p>
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge status={OVERALL_STATUS} />
            <span className="text-sm text-gray-500">Dernière vérification : {new Date().toLocaleTimeString('fr-FR')}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Uptime</p>
          <p className="text-2xl font-bold text-gray-100">2h 34m</p>
        </div>
      </div>

      {/* Component list */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">🔧 Composants</h3>
        <div className="space-y-2">
          {MOCK_COMPONENTS.map((comp) => (
            <div key={comp.component} className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <StatusBadge status={comp.status} />
              <div className="flex-1">
                <p className="font-medium text-gray-200 font-mono">{comp.component}</p>
                <p className="text-xs text-gray-500">{comp.message}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-300">{comp.latencyMs}ms</p>
                <p className="text-xs text-gray-600">latence</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Health check raw JSON */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">📋 GET /health (simulé)</h3>
        <pre className="bg-gray-950 rounded-lg p-4 text-xs text-green-400 overflow-auto font-mono">
{JSON.stringify({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  uptime: 9240,
  version: '0.1.0-alpha',
  components: MOCK_COMPONENTS,
}, null, 2)}
        </pre>
      </div>
    </div>
  );
}
