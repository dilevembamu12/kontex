'use client';
import { useEffect, useState } from 'react';
import TtcGraph from '@/components/TtcGraph';
import { api, type KontExNode, type KontExLink } from '@/lib/api';

const KIND_BADGES: Record<string, string> = {
  fact: 'bg-soft-purple text-purple',
  rule: 'bg-soft-info text-info',
  code: 'bg-soft-success text-success',
  documentation: 'bg-soft-warning text-warning',
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
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); }
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

  const contradictions = links.filter(l => l.relation === 'contradicts').length;

  if (error) return <div className="alert alert-danger">⚠️ {error}</div>;

  return (<>
    <div className="d-flex align-items-center justify-content-between mb-4">
      <div><h4 className="mb-1">🕸️ Toile TTC</h4><p className="text-muted mb-0">Visualisation et gestion des nœuds et liens</p></div>
    </div>

    {/* Stats */}
    <div className="row g-3 mb-4">
      <div className="col-sm-4"><div className="card"><div className="card-body text-center"><p className="text-muted mb-1">Nœuds</p><h3 className="mb-0">{nodes.length}</h3></div></div></div>
      <div className="col-sm-4"><div className="card"><div className="card-body text-center"><p className="text-muted mb-1">Liens</p><h3 className="mb-0">{links.length}</h3></div></div></div>
      <div className="col-sm-4"><div className="card"><div className="card-body text-center"><p className="text-muted mb-1">Contradictions</p><h3 className={`mb-0 ${contradictions > 0 ? 'text-danger' : 'text-success'}`}>{contradictions}</h3></div></div></div>
    </div>

    {/* Graphe D3.js */}
    <div className="mb-4">
      <TtcGraph nodes={nodes} links={links} />
    </div>

    {/* Ajout rapide */}
    <div className="card mb-4">
      <div className="card-body">
        <div className="input-group">
          <input type="text" className="form-control" value={newContent} onChange={e => setNewContent(e.target.value)}
            placeholder="Ajouter un fait (ex: La Terre est ronde)..." onKeyDown={e => e.key === 'Enter' && handleAddNode()} />
          <button className="btn btn-purple" onClick={handleAddNode} disabled={adding}>
            {adding ? <span className="spinner-border spinner-border-sm me-1"></span> : null}
            {adding ? 'Ajout...' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>

    {/* Nœuds */}
    <div className="card mb-4">
      <div className="card-header d-flex align-items-center justify-content-between">
        <h5 className="card-title mb-0">🔵 Nœuds ({nodes.length})</h5>
        <span className="badge bg-soft-primary text-primary">{nodes.length} total</span>
      </div>
      <div className="list-group list-group-flush">
        {nodes.length === 0 ? <div className="list-group-item text-muted text-center py-3">Aucun nœud. Ajoutez un fait dans le champ ci-dessus.</div>
        : nodes.map(node => (
          <div key={node.id} className="list-group-item d-flex align-items-center gap-2">
            <span className={`badge ${KIND_BADGES[node.kind] ?? 'bg-soft-secondary text-secondary'}`} style={{minWidth:70}}>{node.kind}</span>
            <span className="flex-fill text-truncate small">{node.content}</span>
            <span className="badge bg-soft-secondary text-secondary">⚓{node.anchors.length}</span>
            <span className="badge bg-soft-info text-info">⚖️{node.weight.toFixed(1)}</span>
            <span className="badge bg-soft-warning text-warning">🔮{node.ambiguity.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Liens */}
    <div className="card">
      <div className="card-header d-flex align-items-center justify-content-between">
        <h5 className="card-title mb-0">🔗 Liens ({links.length})</h5>
      </div>
      <div className="list-group list-group-flush">
        {links.length === 0 ? <div className="list-group-item text-muted text-center py-3">Aucun lien.</div>
        : links.map((link, i) => (
          <div key={i} className="list-group-item d-flex align-items-center gap-2 small">
            <code className="text-purple text-truncate" style={{width:90}}>{link.sourceId.slice(0,8)}</code>
            <span className="text-muted">{RELATION_LABELS[link.relation] ?? link.relation} <span className="text-info">({(link.weight * link.relevanceScore).toFixed(2)})</span></span>
            <code className="text-info text-truncate ms-auto" style={{width:90}}>{link.targetId.slice(0,8)}</code>
          </div>
        ))}
      </div>
    </div>
  </>);
}
