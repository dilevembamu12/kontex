'use client';
import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { api, type HealthReport } from '@/lib/api';

export default function HealthPage() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try { const h = await api.getHealth(); if (!cancelled) { setHealth(h); setError(null); } }
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur'); }
    }
    load();
    const i = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(i); };
  }, []);

  if (error) return <div className="p-8 text-red-400">⚠️ API inaccessible : {error}</div>;
  if (!health) return <div className="p-8 text-gray-400">Chargement...</div>;

  const h = health;

  return (
    <div className="space-y-8">
      <div><h2 className="text-2xl font-bold text-gray-100">💚 Santé du système</h2><p className="text-gray-500 mt-1">État des services KontEx</p></div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">Statut global</p>
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge status={h.status} />
            <span className="text-sm text-gray-500">v{h.version}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Uptime</p>
          <p className="text-2xl font-bold text-gray-100">{Math.floor(h.uptime / 60)}m {h.uptime % 60}s</p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">🔧 Composants ({h.components.length})</h3>
        <div className="space-y-2">
          {h.components.map(c => (
            <div key={c.component} className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <StatusBadge status={c.status} />
              <div className="flex-1"><p className="font-medium text-gray-200 font-mono text-sm">{c.component}</p><p className="text-xs text-gray-500">{c.message}</p></div>
              <div className="text-right"><p className="text-sm text-gray-300">{c.latencyMs}ms</p><p className="text-xs text-gray-600">latence</p></div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">📋 GET /health (JSON brut)</h3>
        <pre className="bg-gray-950 rounded-lg p-4 text-xs text-green-400 overflow-auto max-h-64">{JSON.stringify(h, null, 2)}</pre>
      </div>
    </div>
  );
}
