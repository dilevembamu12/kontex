'use client';
import { useEffect, useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { api, type KontExNode, type KontExLink } from '@/lib/api';

const KIND_COLORS: Record<string, string> = {
  fact: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  rule: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  code: 'bg-green-500/20 text-green-300 border-green-500/30',
  documentation: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

const RELATION_LABELS: Record<string, string> = {
  depends_on: 'Dépend de', contradicts: 'Contredit', refines: 'Raffine',
  exemplifies: 'Exemplifie', references: 'Référence', custom: 'Personnalisé',
};

export default function WebPage() {
  const [nodes, setNodes] = useState<KontExNode[]>([]);
  const [links, setLinks] = useState<KontExLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newContent, setNewContent] = useState('');
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      const [n, l] = await Promise.all([api.getNodes(), api.getLinks()]);
      setNodes(n.nodes); setLinks(l.links); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    }
  }

  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, []);

  async function handleAddNode() {
    if (!newContent.trim()) return;
    setAdding(true);
    try {
      await api.createNode({ kind: 'fact', content: newContent, anchors: [{ uri: 'dashboard://manual', sourceType: 'other' }] });
      setNewContent('');
      await load();
    } catch (e) { alert(e instanceof Error ? e.message : 'Erreur'); }
    finally { setAdding(false); }
  }

  if (error) return <div className="p-8 text-red-400">⚠️ {error}</div>;

  return (
    <div className="space-y-8">
      <div><h2 className="text-2xl font-bold text-gray-100">🕸️ Toile TTC</h2><p className="text-gray-500 mt-1">Visualisation et gestion des nœuds et liens</p></div>

      <div className="grid grid-cols-3 gap-4">
        <StatBox label="Nœuds" value={nodes.length} />
        <StatBox label="Liens" value={links.length} />
        <StatBox label="Contradictions" value={links.filter(l => l.relation === 'contradicts').length} />
      </div>

      {/* Ajout rapide */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex gap-3">
        <input type="text" value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Ajouter un fait (ex: La Terre est ronde)..." className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500" onKeyDown={e => e.key === 'Enter' && handleAddNode()} />
        <button onClick={handleAddNode} disabled={adding} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors">{adding ? '...' : 'Ajouter'}</button>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">🔵 Nœuds ({nodes.length})</h3>
        {nodes.length === 0 ? <p className="text-gray-500 text-sm">Aucun nœud. Ajoutez un fait ci-dessus.</p> : (
          <div className="space-y-2">
            {nodes.map(node => (
              <div key={node.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${KIND_COLORS[node.kind] ?? 'bg-gray-500/20'}`}>{node.kind}</span>
                <span className="flex-1 text-gray-200 truncate">{node.content}</span>
                <span className="text-xs text-gray-500">⚓{node.anchors.length} ⚖️{node.weight.toFixed(1)} 🔮{node.ambiguity.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">🔗 Liens ({links.length})</h3>
        {links.length === 0 ? <p className="text-gray-500 text-sm">Aucun lien.</p> : (
          <div className="space-y-2">
            {links.map((link, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-gray-800/50 rounded-lg border border-gray-700/50 text-xs">
                <span className="font-mono text-purple-400 w-20 truncate">{link.sourceId.slice(0, 8)}</span>
                <span className="text-gray-500">{RELATION_LABELS[link.relation] ?? link.relation} ({(link.weight * link.relevanceScore).toFixed(2)})</span>
                <span className="font-mono text-blue-400 w-20 truncate">{link.targetId.slice(0, 8)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { readonly label: string; readonly value: number }) {
  return <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center"><p className="text-2xl font-bold text-gray-100">{value}</p><p className="text-xs text-gray-500">{label}</p></div>;
}
