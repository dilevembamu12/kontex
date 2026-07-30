/// @anchor: Page Ancrage — Vérification des sources (Principe A).
/// Permet de tester l'ancrage d'assertions et de nœuds.

import { StatusBadge } from '@/components/StatusBadge';

const MOCK_VERIFICATIONS = [
  { nodeId: 'a1', content: 'La Terre est ronde', strength: 0.95, sourceCount: 3, isAnchored: true, missingCategories: [] },
  { nodeId: 'a2', content: 'Le soleil est une étoile', strength: 0.98, sourceCount: 5, isAnchored: true, missingCategories: [] },
  { nodeId: 'b1', content: 'Toute fonction doit être pure', strength: 0.60, sourceCount: 2, isAnchored: true, missingCategories: ['OFFICIAL_SOURCE'] },
  { nodeId: 'c1', content: 'async function fetchData()', strength: 0.30, sourceCount: 1, isAnchored: true, missingCategories: ['OFFICIAL_SOURCE'] },
  { nodeId: 'x1', content: 'Assertion sans preuve', strength: 0.00, sourceCount: 0, isAnchored: false, missingCategories: ['ANY_SOURCE'] },
];

export default function AnchoringPage() {
  const anchoredCount = MOCK_VERIFICATIONS.filter((v) => v.isAnchored).length;
  const rate = ((anchoredCount / MOCK_VERIFICATIONS.length) * 100).toFixed(1);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-100">⚓ Vérification d'ancrage</h2>
        <p className="text-gray-500 mt-1">
          Principe A — Chaque fait doit être relié à au moins une source vérifiable
        </p>
      </div>

      {/* Taux d'ancrage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AnchorMetric label="Taux d'ancrage" value={`${rate}%`} color="green" />
        <AnchorMetric label="Nœuds ancrés" value={`${anchoredCount}/${MOCK_VERIFICATIONS.length}`} color="purple" />
        <AnchorMetric label="Force moyenne" value="0.57" color="blue" />
      </div>

      {/* Vérifications */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">📋 Résultats de vérification</h3>
        <div className="space-y-2">
          {MOCK_VERIFICATIONS.map((v) => (
            <div key={v.nodeId} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
              <span className="text-xs font-mono text-gray-500 w-8">{v.nodeId}</span>
              <span className="flex-1 text-sm text-gray-200 truncate">{v.content}</span>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>⚓ {v.sourceCount} sources</span>
                <span>💪 {(v.strength * 100).toFixed(0)}%</span>
              </div>
              <StatusBadge status={v.isAnchored ? 'healthy' : 'unhealthy'} />
              {v.missingCategories.length > 0 && (
                <span className="text-xs text-yellow-400">
                  {v.missingCategories.join(', ')}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Formula TTC */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">📐 Formule TTC — Principe A</h3>
        <div className="bg-gray-950 rounded-lg p-4 font-mono text-sm text-purple-300">
          <p>A(f) ⟹ ∃s ∈ Sources : lien(f, s)</p>
          <p className="text-xs text-gray-500 mt-2">
            « Chaque fait (f) implique l'existence d'au moins une source (s) à laquelle il est relié. »
          </p>
        </div>
      </div>
    </div>
  );
}

function AnchorMetric({ label, value, color }: {
  readonly label: string;
  readonly value: string;
  readonly color: 'green' | 'purple' | 'blue';
}) {
  const borders: Record<string, string> = {
    green: 'border-green-500/30',
    purple: 'border-purple-500/30',
    blue: 'border-blue-500/30',
  };
  return (
    <div className={`bg-gray-900 rounded-xl border ${borders[color]} p-4 text-center`}>
      <p className="text-2xl font-bold text-gray-100">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
