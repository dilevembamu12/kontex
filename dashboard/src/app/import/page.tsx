'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';

interface ImportedNode {
  id: string;
  section: string;
  kind: string;
}

interface ImportResult {
  imported: number;
  total: number;
  nodes: ImportedNode[];
  errors?: string[];
}

export default function ImportPage() {
  const [markdown, setMarkdown] = useState('');
  const [sourceUri, setSourceUri] = useState('');
  const [sourceType, setSourceType] = useState('specification');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    if (!markdown.trim()) {
      setError('Veuillez coller ou charger un fichier Markdown.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.importMarkdown({
        markdown,
        sourceUri: sourceUri || undefined,
        sourceType: sourceType || undefined,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setResult(data as any as ImportResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'import.');
    } finally {
      setLoading(false);
    }
  }

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setMarkdown(content);
      setSourceUri(`file://${file.name}`);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.md') || file.name.endsWith('.markdown'))) {
      handleFileUpload(file);
    }
  }

  const kindIcon = (kind: string) => {
    switch (kind) {
      case 'rule': return '📏';
      case 'fact': return '✅';
      case 'code': return '💻';
      default: return '📄';
    }
  };

  return (<>
    <div className="d-flex align-items-center justify-content-between mb-4">
      <div><h4 className="mb-1">📥 Importer du Markdown</h4>
        <p className="text-muted mb-0">Chaque section <code>## Titre</code> deviendra un nœud ancré dans la toile TTC.</p></div>
    </div>

    {/* Zone drop + textarea */}
    <div className={`card mb-4 ${dragOver ? 'border-purple bg-soft-purple' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}>
      <div className="card-body">
        <textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)}
          placeholder={`# Mon Document\n\n## Introduction\nCollez votre markdown ici, ou déposez un fichier .md...\n\n## Règle 1\nLes sections avec "Règle" ou "Rule" deviennent des **rule**.\n\n## Code API\nLes sections avec "Code" ou "API" deviennent des **fact**.\nLes autres sections deviennent de la **documentation**.`}
          rows={14} className="form-control bg-transparent border-0 font-monospace small" style={{resize:'vertical'}} />
        <div className="d-flex align-items-center justify-content-between mt-3 pt-3 border-top">
          <div className="d-flex align-items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".md,.markdown"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} className="d-none" />
            <button onClick={() => fileInputRef.current?.click()} className="btn btn-sm btn-outline-secondary">📁 Choisir un fichier</button>
            <span className="text-muted small">ou déposez un .md ici</span>
          </div>
          <span className="badge bg-soft-secondary text-secondary">{markdown.length.toLocaleString()} caractères</span>
        </div>
      </div>
    </div>

    {/* Options d'ancrage */}
    <div className="row g-3 mb-4">
      <div className="col-md-6">
        <label className="form-label text-muted">URI Source</label>
        <input type="text" className="form-control font-monospace" value={sourceUri}
          onChange={(e) => setSourceUri(e.target.value)} placeholder="file://docs/mon-document.md" />
        <div className="form-text">L&apos;URI qui servira d&apos;ancre. Auto-détecté si vous chargez un fichier.</div>
      </div>
      <div className="col-md-6">
        <label className="form-label text-muted">Type de source</label>
        <select className="form-select" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
          <option value="specification">📋 Spécification</option>
          <option value="official_documentation">📚 Documentation officielle</option>
          <option value="code_repository">📦 Dépôt de code</option>
          <option value="peer_review">👥 Revue par les pairs</option>
          <option value="other">📝 Autre</option>
        </select>
        <div className="form-text">Détermine la force d&apos;ancrage (Principe A).</div>
      </div>
    </div>

    {/* Bouton Import */}
    <button onClick={handleImport} disabled={loading || !markdown.trim()}
      className="btn btn-purple btn-lg w-100 mb-4">
      {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Import en cours...</> : '🪐 Importer dans la Toile TTC'}
    </button>

    {/* Erreur */}
    {error && <div className="alert alert-danger">{error}</div>}

    {/* Résultat */}
    {result && (<>
      <div className="alert alert-success d-flex align-items-center">
        <span className="me-2">✅</span> {result.imported} / {result.total} sections importées
        {result.errors && result.errors.length > 0 && <span className="badge bg-warning ms-2">⚠️ {result.errors.length} erreur(s)</span>}
      </div>

      <div className="card mb-4">
        <div className="card-header"><h5 className="card-title mb-0">Nœuds créés</h5></div>
        <div className="list-group list-group-flush" style={{maxHeight:320, overflowY:'auto'}}>
          {result.nodes.map((node) => (
            <div key={node.id} className="list-group-item d-flex align-items-center gap-3">
              <span className="fs-5">{kindIcon(node.kind)}</span>
              <div className="flex-fill text-truncate"><span className="d-block small">{node.section}</span><span className="badge bg-soft-secondary text-secondary">{node.kind}</span></div>
              <code className="text-muted small">{node.id.slice(0,8)}...</code>
            </div>
          ))}
        </div>
      </div>

      <div className="d-flex gap-2 mb-4">
        <button onClick={() => { setMarkdown(''); setResult(null); setError(null); }} className="btn btn-outline-secondary">📝 Nouvel import</button>
        <button onClick={() => { navigator.clipboard.writeText(result.nodes.map((n) => `- [${n.kind}] ${n.section} (${n.id})`).join('\n')); }} className="btn btn-outline-secondary">📋 Copier la liste</button>
      </div>
    </>)}

    {/* Guide rapide */}
    <div className="card">
      <div className="card-body">
        <h6 className="text-muted mb-3">📖 Format attendu</h6>
        <pre className="bg-dark text-muted rounded p-3 small mb-2">{`## Introduction\n→ Nœud de type "documentation"\n\n## Règle 1\n→ Nœud de type "rule" (contient "Règle" ou "Rule")\n\n## Implémentation API\n→ Nœud de type "fact" (contient "Code" ou "API")\n\n## Conclusion\n→ Nœud de type "documentation"`}</pre>
        <p className="text-muted small mb-0">Chaque nœud est automatiquement ancré au fichier source (Principe A). Les embeddings Gemini sont générés au prochain backfill.</p>
      </div>
    </div>
  </>);
}
