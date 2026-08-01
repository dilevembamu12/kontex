'use client';
import { useEffect, useState } from 'react';
import { api, type HealthReport } from '@/lib/api';

export default function HealthPage() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    async function load() {
      try { const h = await api.getHealth(); if (!c) { setHealth(h); setError(null); } }
      catch (e) { if (!c) setError(e instanceof Error ? e.message : 'Erreur'); }
    }
    load();
    const i = setInterval(load, 10000);
    return () => { c = true; clearInterval(i); };
  }, []);

  if (error) return <div className="alert alert-danger">⚠️ {error}</div>;
  if (!health) return <div className="text-muted">Chargement...</div>;
  const h = health;

  return (<>
    <div className="d-flex align-items-center justify-content-between mb-4">
      <div><h4 className="mb-1">💚 Santé du système</h4><p className="text-muted mb-0">État des services KontEx</p></div>
    </div>

    <div className="card mb-4">
      <div className="card-body d-flex align-items-center justify-content-between">
        <div>
          <p className="text-muted mb-1">Statut global</p>
          <span className={`badge fs-6 bg-soft-${h.status === 'healthy' ? 'success' : h.status === 'degraded' ? 'warning' : 'danger'} text-${h.status === 'healthy' ? 'success' : h.status === 'degraded' ? 'warning' : 'danger'}`}>{h.status}</span>
          <span className="text-muted small ms-2">v{h.version}</span>
        </div>
        <div className="text-end">
          <p className="text-muted small mb-0">Uptime</p>
          <h4 className="mb-0">{Math.floor(h.uptime / 60)}m {h.uptime % 60}s</h4>
        </div>
      </div>
    </div>

    <div className="card mb-4">
      <div className="card-header"><h5 className="card-title mb-0">🔧 Composants ({h.components.length})</h5></div>
      <div className="list-group list-group-flush">
        {h.components.map(c => (
          <div key={c.component} className="list-group-item d-flex align-items-center gap-3">
            <span className={`badge bg-soft-${c.status === 'healthy' ? 'success' : c.status === 'degraded' ? 'warning' : 'danger'} text-${c.status === 'healthy' ? 'success' : c.status === 'degraded' ? 'warning' : 'danger'}`}>●</span>
            <div className="flex-fill"><span className="fw-medium font-monospace small">{c.component}</span><br/><span className="text-muted small">{c.message}</span></div>
            <span className="text-muted small text-end">{c.latencyMs}ms</span>
          </div>
        ))}
      </div>
    </div>

    <div className="card">
      <div className="card-header"><h5 className="card-title mb-0">📋 GET /health (JSON)</h5></div>
      <div className="card-body"><pre className="bg-dark text-success rounded p-3 small overflow-auto" style={{maxHeight:300}}>{JSON.stringify(h, null, 2)}</pre></div>
    </div>
  </>);
}
