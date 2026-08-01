/// @anchor: Page Dashboard — Vue d'ensemble Bootstrap 5

'use client';
import { useEffect, useState } from 'react';
import { api, type KontExStats, type HealthReport } from '@/lib/api';

export default function DashboardPage() {
  const [stats, setStats] = useState<KontExStats | null>(null);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [s, h] = await Promise.all([api.getStats(), api.getHealth()]);
        if (!cancelled) { setStats(s); setHealth(h); setError(null); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'API inaccessible');
      }
    }
    load();
    const interval = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (error) {
    return (
      <div className="alert alert-danger d-flex align-items-center">
        <i className="ti ti-alert-triangle me-2"></i>
        <div>
          <strong>API Gateway inaccessible</strong>
          <p className="mb-0 small">{error}</p>
        </div>
      </div>
    );
  }

  const s = stats;
  const h = health;
  const entropyOk = (s?.globalEntropy ?? 1) < 0.3;

  return (
    <>
      {/* Page Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="mb-1">Vue d&apos;ensemble</h4>
          <p className="text-muted mb-0">État global du système KontEx — Théorie de la Toile Cosmologique (TTC)</p>
        </div>
        {h && <span className="badge bg-soft-primary text-primary">🟢 v{h.version} — {Math.floor(h.uptime / 60)}m uptime</span>}
      </div>

      {/* Metric Cards */}
      <div className="row g-3 mb-4">
        <div className="col-xl-3 col-sm-6">
          <div className="card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1">Nœuds</p>
                  <h3 className="mb-0">{s ? s.nodeCount.toLocaleString() : '...'}</h3>
                  <span className="badge bg-soft-purple text-purple mt-2">Faits, règles, code, documentation</span>
                </div>
                <span className="text-purple fs-32 opacity-25">🪐</span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-sm-6">
          <div className="card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1">Liens</p>
                  <h3 className="mb-0">{s ? s.linkCount.toLocaleString() : '...'}</h3>
                  <span className="badge bg-soft-info text-info mt-2">Relations pondérées</span>
                </div>
                <span className="text-info fs-32 opacity-25">🔗</span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-sm-6">
          <div className="card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1">Ancrage</p>
                  <h3 className="mb-0">{s ? `${(s.anchoringRate * 100).toFixed(1)}%` : '...'}</h3>
                  <span className="badge bg-soft-success text-success mt-2">{s?.anchoredCount ?? 0}/{s?.nodeCount ?? 0} nœuds ancrés</span>
                </div>
                <span className="text-success fs-32 opacity-25">⚓</span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-sm-6">
          <div className="card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <p className="text-muted mb-1">Entropie</p>
                  <h3 className="mb-0">{s ? s.globalEntropy.toFixed(3) : '...'}</h3>
                  <span className={`badge mt-2 ${entropyOk ? 'bg-soft-success text-success' : 'bg-soft-warning text-warning'}`}>
                    {entropyOk ? 'Sous contrôle' : '⚠️ Élevée'}
                  </span>
                </div>
                <span className={`fs-32 opacity-25 ${entropyOk ? 'text-success' : 'text-warning'}`}>📊</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TTC Principles + Infrastructure */}
      <div className="row g-3 mb-4">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header"><h5 className="card-title mb-0">🧬 Principes TTC</h5></div>
            <div className="card-body">
              <div className="list-group list-group-flush">
                <PrincipleRow label="Ancrage (A)" formula="A(f) ⟹ ∃s ∈ Sources" status={s && s.anchoringRate > 0.9 ? 'ok' : 'warn'} detail={s ? `${(s.anchoringRate * 100).toFixed(1)}% ancrés` : '...'} />
                <PrincipleRow label="Cohérence (C)" formula="¬(n₁ ⊕ n₂) ∨ résolu" status={s && s.contradictionCount === 0 ? 'ok' : 'warn'} detail={s ? `${s.contradictionCount} contradiction(s)` : '...'} />
                <PrincipleRow label="Propagation (P)" formula="P = wᵢⱼ · relevance" status="ok" detail={s ? `${s.linkCount} liens actifs` : '...'} />
                <PrincipleRow label="Entropie Min (Eₘᵢₙ)" formula="min Σ ambiguity(n)" status={entropyOk ? 'ok' : 'warn'} detail={s ? `Entropie : ${s.globalEntropy.toFixed(3)}` : '...'} />
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header"><h5 className="card-title mb-0">🏗️ Infrastructure</h5></div>
            <div className="card-body">
              <div className="list-group list-group-flush">
                {h ? h.components.map(c => (
                  <ServiceRow key={c.component} name={c.component} latency={`${c.latencyMs}ms`} status={c.status} />
                )) : (
                  <>
                    <ServiceRow name="API Gateway" latency="..." status="healthy" />
                    <ServiceRow name="PostgreSQL + pgvector" latency="..." status="healthy" />
                    <ServiceRow name="Redis" latency="..." status="healthy" />
                    <ServiceRow name="Graphiti TTC Engine" latency="..." status="healthy" />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header"><h5 className="card-title mb-0">⚡ Actions rapides</h5></div>
        <div className="card-body">
          <div className="d-flex gap-2 flex-wrap">
            <a href="/web" className="btn btn-purple"><i className="ti ti-topology-star me-1"></i>Explorer la toile</a>
            <a href="/anchoring" className="btn btn-info"><i className="ti ti-anchor me-1"></i>Vérifier l&apos;ancrage</a>
            <a href="/health" className="btn btn-success"><i className="ti ti-heartbeat me-1"></i>Santé</a>
            <a href="/import" className="btn btn-warning"><i className="ti ti-file-import me-1"></i>Import Markdown</a>
          </div>
        </div>
      </div>
    </>
  );
}

/** Ligne de principe TTC */
function PrincipleRow({ label, formula, status, detail }: { label: string; formula: string; status: 'ok' | 'warn'; detail: string }) {
  return (
    <div className="d-flex align-items-center gap-3 py-2">
      <span className={`badge ${status === 'ok' ? 'bg-soft-success text-success' : 'bg-soft-warning text-warning'}`} style={{ minWidth: 48, textAlign: 'center' }}>
        {status === 'ok' ? '✓' : '⚠'}
      </span>
      <div className="flex-fill">
        <span className="fw-semibold text-white">{label}</span>
        <code className="ms-2 small text-muted">{formula}</code>
      </div>
      <span className="text-muted small">{detail}</span>
    </div>
  );
}

/** Ligne de service infrastructure */
function ServiceRow({ name, latency, status }: { name: string; latency: string; status: string }) {
  const color = status === 'healthy' ? 'success' : status === 'degraded' ? 'warning' : 'danger';
  return (
    <div className="d-flex align-items-center gap-3 py-2">
      <span className={`badge bg-soft-${color} text-${color}`}>●</span>
      <span className="fw-medium text-white flex-fill font-monospace small">{name}</span>
      <span className="text-muted small">{latency}</span>
    </div>
  );
}
