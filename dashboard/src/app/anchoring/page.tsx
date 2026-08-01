'use client';
import { useEffect, useState } from 'react';
import { api, type KontExNode, type AnchorVerification } from '@/lib/api';

export default function AnchoringPage() {
  const [nodes, setNodes] = useState<KontExNode[]>([]);
  const [verifications, setVerifications] = useState<Map<string, AnchorVerification>>(new Map());
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const n = await api.getNodes(); setNodes(n.nodes);
      const results = new Map<string, AnchorVerification>();
      await Promise.all(n.nodes.map(async (node) => { try { results.set(node.id, await api.verifyNode(node.id)); } catch { /* skip */ } }));
      setVerifications(results); setError(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
  }
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, []);

  const anchoredCount = [...verifications.values()].filter(v => v.isAnchored).length;
  const rate = nodes.length > 0 ? (anchoredCount / nodes.length * 100).toFixed(1) : '0';
  const avgStrength = verifications.size > 0 ? ([...verifications.values()].reduce((s, v) => s + v.strength, 0) / verifications.size).toFixed(2) : '0';

  if (error) return <div className="alert alert-danger">⚠️ {error}</div>;

  return (<>
    <div className="d-flex align-items-center justify-content-between mb-4">
      <div><h4 className="mb-1">⚓ Vérification d&apos;ancrage</h4><p className="text-muted mb-0">Principe A — Chaque fait doit être relié à au moins une source vérifiable</p></div>
    </div>

    <div className="row g-3 mb-4">
      <div className="col-md-4"><div className="card"><div className="card-body text-center"><p className="text-muted mb-1">Taux d&apos;ancrage</p><h3 className="text-success mb-0">{rate}%</h3></div></div></div>
      <div className="col-md-4"><div className="card"><div className="card-body text-center"><p className="text-muted mb-1">Nœuds ancrés</p><h3 className="text-purple mb-0">{anchoredCount}/{nodes.length}</h3></div></div></div>
      <div className="col-md-4"><div className="card"><div className="card-body text-center"><p className="text-muted mb-1">Force moyenne</p><h3 className="text-info mb-0">{avgStrength}</h3></div></div></div>
    </div>

    <div className="card">
      <div className="card-header"><h5 className="card-title mb-0">📋 Résultats ({nodes.length} nœuds)</h5></div>
      <div className="list-group list-group-flush">
        {nodes.length === 0 ? <div className="list-group-item text-muted">Aucun nœud.</div> : nodes.map(node => {
          const v = verifications.get(node.id);
          return (<div key={node.id} className="list-group-item d-flex align-items-center gap-3">
            <code className="small text-muted">{node.id.slice(0,8)}</code>
            <span className="flex-fill text-truncate">{node.content.slice(0,70)}</span>
            {v ? (<>
              <span className="badge bg-soft-info text-info">⚓{v.sourceCount} 💪{(v.strength*100).toFixed(0)}%</span>
              <span className={`badge bg-soft-${v.isAnchored?'success':'danger'} text-${v.isAnchored?'success':'danger'}`}>{v.isAnchored?'Ancré':'Non ancré'}</span>
              {v.missingCategories.length > 0 && <span className="badge bg-soft-warning text-warning">{v.missingCategories.join(',')}</span>}
            </>) : <span className="badge bg-soft-secondary text-secondary">Vérification...</span>}
          </div>);
        })}
      </div>
    </div>

    <div className="card mt-4">
      <div className="card-header"><h5 className="card-title mb-0">📐 Formule TTC — Principe A</h5></div>
      <div className="card-body">
        <pre className="bg-dark text-purple rounded p-3 mb-0 small"><code>A(f) ⟹ ∃s ∈ Sources : lien(f, s)</code></pre>
        <p className="text-muted small mt-2 mb-0">« Chaque fait (f) implique l&apos;existence d&apos;au moins une source (s) à laquelle il est relié. »</p>
      </div>
    </div>
  </>);
}
