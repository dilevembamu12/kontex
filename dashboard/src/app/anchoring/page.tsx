'use client';
import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { api, type KontExNode, type AnchorVerification } from '@/lib/api';

export default function AnchoringPage() {
  const [nodes, setNodes] = useState<KontExNode[]>([]);
  const [verifications, setVerifications] = useState<Map<string, AnchorVerification>>(new Map());
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const n = await api.getNodes();
      setNodes(n.nodes);
      const results = new Map<string, AnchorVerification>();
      await Promise.all(n.nodes.map(async (node) => {
        try { results.set(node.id, await api.verifyNode(node.id)); } catch { /* skip */ }
      }));
      setVerifications(results);
      setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
  }

  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, []);

  const anchoredCount = [...verifications.values()].filter(v => v.isAnchored).length;
  const rate = nodes.length > 0 ? (anchoredCount / nodes.length * 100).toFixed(1) : '0';
  const avgStrength = verifications.size > 0
    ? ([...verifications.values()].reduce((s, v) => s + v.strength, 0) / verifications.size).toFixed(2)
    : '0';

  if (error) return <div className="p-8 text-red-400">⚠️ {error}</div>;

  return (
    <div className="space-y-8">
      <div><h2 className="text-2xl font-bold text-gray-100">⚓ Vérification d'ancrage</h2><p className="text-gray-500 mt-1">Principe A — Chaque fait doit être relié à au moins une source vérifiable</p></div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AnchorMetric label="Taux d'ancrage" value={`${rate}%`} color="green" />
        <AnchorMetric label="Nœuds ancrés" value={`${anchoredCount}/${nodes.length}`} color="purple" />
        <AnchorMetric label="Force moyenne" value={avgStrength} color="blue" />
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">📋 Résultats ({nodes.length} nœuds)</h3>
        {nodes.length === 0 ? <p className="text-gray-500 text-sm">Aucun nœud. Allez dans &quot;Toile TTC&quot; pour en ajouter.</p> : (
          <div className="space-y-2">
            {nodes.map(node => {
              const v = verifications.get(node.id);
              return (
                <div key={node.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 text-sm">
                  <span className="text-xs font-mono text-gray-500 w-10 truncate">{node.id.slice(0, 8)}</span>
                  <span className="flex-1 text-gray-200 truncate">{node.content.slice(0, 60)}</span>
                  {v ? (
                    <>
                      <span className="text-xs text-gray-500">⚓{v.sourceCount} 💪{(v.strength * 100).toFixed(0)}%</span>
                      <StatusBadge status={v.isAnchored ? 'healthy' : 'unhealthy'} />
                      {v.missingCategories.length > 0 && <span className="text-xs text-yellow-400">{v.missingCategories.join(', ')}</span>}
                    </>
                  ) : (
                    <span className="text-xs text-gray-600">vérification...</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">📐 Formule TTC — Principe A</h3>
        <div className="bg-gray-950 rounded-lg p-4 font-mono text-sm text-purple-300">
          <p>A(f) ⟹ ∃s ∈ Sources : lien(f, s)</p>
          <p className="text-xs text-gray-500 mt-2">« Chaque fait (f) implique l'existence d'au moins une source (s) à laquelle il est relié. »</p>
        </div>
      </div>
    </div>
  );
}

function AnchorMetric({ label, value, color }: { readonly label: string; readonly value: string; readonly color: 'green' | 'purple' | 'blue' }) {
  const borders: Record<string, string> = { green: 'border-green-500/30', purple: 'border-purple-500/30', blue: 'border-blue-500/30' };
  return <div className={`bg-gray-900 rounded-xl border ${borders[color]} p-4 text-center`}><p className="text-2xl font-bold text-gray-100">{value}</p><p className="text-xs text-gray-500">{label}</p></div>;
}
