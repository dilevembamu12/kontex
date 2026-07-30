/// @anchor: Page Dashboard — Vue d'ensemble des métriques TTC.

import { MetricCard } from '@/components/MetricCard';

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Vue d'ensemble</h2>
        <p className="text-gray-500 mt-1">État global du système KontEx — Théorie de la Toile Cosmologique (TTC)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Nœuds" value="12 847" description="Faits, règles, code, documentation" trend="up" color="purple" />
        <MetricCard title="Liens" value="31 492" description="Relations pondérées" trend="up" color="blue" />
        <MetricCard title="Ancrage" value="97.3%" description="Nœuds vérifiés (Principe A)" trend="stable" color="green" />
        <MetricCard title="Entropie" value="0.23" description="Ambiguïté moyenne — cible < 0.30" trend="down" color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">🧬 Principes TTC</h3>
          <div className="space-y-3">
            <PrincipleRow label="Ancrage (A)" formula="A(f) ⟹ ∃s ∈ Sources" status="ok" detail="97.3% ancrés" />
            <PrincipleRow label="Cohérence (C)" formula="¬(n₁ ⊕ n₂) ∨ résolu" status="ok" detail="3 contradictions résolues" />
            <PrincipleRow label="Propagation (P)" formula="P = wᵢⱼ · relevance" status="ok" detail="Score moyen : 0.72" />
            <PrincipleRow label="Entropie Min (Eₘᵢₙ)" formula="min Σ ambiguity(n)" status="ok" detail="Entropie : 0.23" />
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">🏗️ Infrastructure</h3>
          <div className="space-y-3">
            <ServiceRow name="API Gateway" endpoint=":3000" status="healthy" />
            <ServiceRow name="PostgreSQL + pgvector" endpoint=":5432" status="healthy" />
            <ServiceRow name="Redis" endpoint=":6379" status="healthy" />
            <ServiceRow name="Graphiti TTC Engine" endpoint="Rust/WASM" status="healthy" />
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
