/// @anchor: Page Toile TTC — Visualisation de la toile contextuelle.
/// Affiche les nœuds, liens et contradictions.

import { StatusBadge } from '@/components/StatusBadge';

const MOCK_NODES = [
  { id: 'a1', kind: 'fact' as const, content: 'La Terre est ronde', weight: 0.95, ambiguity: 0.02, anchors: 3 },
  { id: 'a2', kind: 'fact' as const, content: 'Le soleil est une étoile', weight: 0.90, ambiguity: 0.03, anchors: 5 },
  { id: 'b1', kind: 'rule' as const, content: 'Toute fonction doit être pure', weight: 0.85, ambiguity: 0.10, anchors: 2 },
  { id: 'c1', kind: 'code' as const, content: 'async function fetchData() { ... }', weight: 0.75, ambiguity: 0.15, anchors: 1 },
  { id: 'd1', kind: 'documentation' as const, content: 'API Reference — Node.js v22', weight: 0.80, ambiguity: 0.05, anchors: 4 },
];

const MOCK_LINKS = [
  { source: 'a1', target: 'd1', relation: 'references' as const, weight: 0.9 },
  { source: 'b1', target: 'c1', relation: 'refines' as const, weight: 0.7 },
  { source: 'a1', target: 'a2', relation: 'references' as const, weight: 0.6 },
];

const KIND_COLORS: Record<string, string> = {
  fact: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  rule: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  code: 'bg-green-500/20 text-green-300 border-green-500/30',
  documentation: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

const RELATION_LABELS: Record<string, string> = {
  depends_on: 'Dépend de',
  contradicts: 'Contredit',
  refines: 'Raffine',
  exemplifies: 'Exemplifie',
  references: 'Référence',
};

export default function WebPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">🕸️ Toile TTC</h2>
        <p className="text-gray-500 mt-1">
          Visualisation et gestion des nœuds et liens de la Toile Cosmologique
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatBox label="Nœuds" value={MOCK_NODES.length} />
        <StatBox label="Liens" value={MOCK_LINKS.length} />
        <StatBox label="Contradictions" value={0} />
      </div>

      {/* Nœuds */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">🔵 Nœuds</h3>
        <div className="space-y-2">
          {MOCK_NODES.map((node) => (
            <div key={node.id} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${KIND_COLORS[node.kind]}`}>
                {node.kind}
              </span>
              <span className="flex-1 text-sm text-gray-200 font-mono">{node.content}</span>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span>⚓ {node.anchors}</span>
                <span>⚖️ {node.weight.toFixed(2)}</span>
                <span>🔮 {node.ambiguity.toFixed(2)}</span>
                <StatusBadge status={node.ambiguity < 0.3 ? 'healthy' : 'degraded'} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Liens */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">🔗 Liens</h3>
        <div className="space-y-2">
          {MOCK_LINKS.map((link, i) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <span className="text-sm font-mono text-purple-400">{link.source}</span>
              <span className="text-xs text-gray-500">
                ──{RELATION_LABELS[link.relation] ?? link.relation} ({link.weight.toFixed(2)})──▶
              </span>
              <span className="text-sm font-mono text-blue-400">{link.target}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
      <p className="text-2xl font-bold text-gray-100">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
