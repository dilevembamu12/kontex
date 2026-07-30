/// @anchor: Page Dashboard — Vue d'ensemble avec données réelles de l'API.

'use client';
import { useEffect, useState } from 'react';
import { MetricCard } from '@/components/MetricCard';
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
      <div className="space-y-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
          <p className="text-red-400 font-medium">⚠️ API Gateway inaccessible</p>
          <p className="text-red-400/70 text-sm mt-1">{error}</p>
          <p className="text-gray-500 text-sm mt-3">Vérifier que l'API tourne sur <code className="bg-gray-800 px-1 rounded">localhost:3000</code></p>
        </div>
      </div>
    );
  }

  const s = stats;
  const h = health;
  const entropyOk = (s?.globalEntropy ?? 1) < 0.3;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Vue d'ensemble</h2>
          <p className="text-gray-500 mt-1">État global du système KontEx — Théorie de la Toile Cosmologique (TTC)</p>
        </div>
        {h && <span className="text-xs text-gray-600">🟢 API v{h.version} — uptime {Math.floor(h.uptime / 60)}m</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Nœuds" value={s ? s.nodeCount.toLocaleString() : '...'} description="Faits, règles, code, documentation" trend={s && s.nodeCount > 0 ? 'up' : 'stable'} color="purple" />
        <MetricCard title="Liens" value={s ? s.linkCount.toLocaleString() : '...'} description="Relations pondérées" trend="stable" color="blue" />
        <MetricCard title="Ancrage" value={s ? `${(s.anchoringRate * 100).toFixed(1)}%` : '...'} description={`${s?.anchoredCount ?? 0}/${s?.nodeCount ?? 0} nœuds ancrés`} trend={s && s.anchoringRate > 0.9 ? 'up' : 'down'} color="green" />
        <MetricCard title="Entropie" value={s ? s.globalEntropy.toFixed(3) : '...'} description={entropyOk ? 'Ambiguïté sous contrôle' : '⚠️ Entropie élevée'} trend={entropyOk ? 'down' : 'up'} color={entropyOk ? 'green' : 'yellow'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">🧬 Principes TTC</h3>
          <div className="space-y-3">
            <PrincipleRow label="Ancrage (A)" formula="A(f) ⟹ ∃s ∈ Sources" status={s && s.anchoringRate > 0.9 ? 'ok' : 'warn'} detail={s ? `${(s.anchoringRate * 100).toFixed(1)}% ancrés` : '...'} />
            <PrincipleRow label="Cohérence (C)" formula="¬(n₁ ⊕ n₂) ∨ résolu" status={s && s.contradictionCount === 0 ? 'ok' : 'warn'} detail={s ? `${s.contradictionCount} contradiction(s)` : '...'} />
            <PrincipleRow label="Propagation (P)" formula="P = wᵢⱼ · relevance" status="ok" detail={s ? `${s.linkCount} liens actifs` : '...'} />
            <PrincipleRow label="Entropie Min (Eₘᵢₙ)" formula="min Σ ambiguity(n)" status={entropyOk ? 'ok' : 'warn'} detail={s ? `Entropie : ${s.globalEntropy.toFixed(3)}` : '...'} />
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">🏗️ Infrastructure</h3>
          <div className="space-y-3">
            {h ? h.components.map(c => (
              <ServiceRow key={c.component} name={c.component} endpoint={`${c.latencyMs}ms`} status={c.status} />
            )) : (
              <>
                <ServiceRow name="API Gateway" endpoint="..." status="healthy" />
                <ServiceRow name="PostgreSQL + pgvector" endpoint="..." status="healthy" />
                <ServiceRow name="Redis" endpoint="..." status="healthy" />
                <ServiceRow name="Graphiti TTC Engine" endpoint="..." status="healthy" />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">⚡ Actions rapides</h3>
        <div className="flex gap-3 flex-wrap">
          <a href="/web" className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors">🕸️ Explorer la toile</a>
          <a href="/anchoring" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">⚓ Vérifier l'ancrage</a>
          <a href="/health" className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors">💚 Voir l'état de santé</a>
        </div>
      </div>
    </div>
  );
}

function PrincipleRow({ label, formula, status, detail }: { readonly label: string; readonly formula: string; readonly status: 'ok' | 'warn' | 'error'; readonly detail: string }) {
  const colors: Record<string, string> = { ok: 'text-green-400', warn: 'text-yellow-400', error: 'text-red-400' };
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
      <div><span className="font-medium text-gray-200">{label}</span><span className="text-xs text-gray-500 ml-2">{formula}</span></div>
      <span className={`text-sm ${colors[status]}`}>{detail}</span>
    </div>
  );
}

function ServiceRow({ name, endpoint, status }: { readonly name: string; readonly endpoint: string; readonly status: 'healthy' | 'degraded' | 'unhealthy' }) {
  const dots: Record<string, string> = { healthy: '🟢', degraded: '🟡', unhealthy: '🔴' };
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
      <div><span className="font-medium text-gray-200">{name}</span><span className="text-xs text-gray-500 ml-2">{endpoint}</span></div>
      <span className="text-sm">{dots[status]} {status}</span>
    </div>
  );
}
