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

  return (
    <div className="space-y-6 p-8 max-w-5xl">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-purple-400">📥 Importer du Markdown</h1>
        <p className="text-gray-500 mt-1">
          Collez ou déposez un fichier Markdown. Chaque section <code className="text-purple-300">## Titre</code> deviendra un nœud ancré dans la toile TTC.
        </p>
      </div>

      {/* Zone de drop / textarea */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 transition ${
          dragOver
            ? 'border-purple-500 bg-purple-900/20'
            : 'border-gray-700 bg-gray-900/50 hover:border-gray-600'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <textarea
          value={markdown}
          onChange={(e) => setMarkdown(e.target.value)}
          placeholder={`# Mon Document

## Introduction

Collez votre markdown ici, ou déposez un fichier .md...

## Règle 1

Les sections avec "Règle" ou "Rule" dans le titre deviennent des nœuds de type **rule**.

## Code API

Les sections avec "Code" ou "API" deviennent des **fact**.
Les autres sections deviennent de la **documentation**.`}
          rows={16}
          className="w-full bg-transparent text-gray-200 font-mono text-sm resize-y outline-none placeholder-gray-600"
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition"
            >
              📁 Choisir un fichier
            </button>
            <span className="text-xs text-gray-600">ou déposez un .md ici</span>
          </div>
          <span className="text-xs text-gray-600">
            {markdown.length.toLocaleString()} caractères
          </span>
        </div>
      </div>

      {/* Options d'ancrage */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm text-gray-400">URI Source</label>
          <input
            type="text"
            value={sourceUri}
            onChange={(e) => setSourceUri(e.target.value)}
            placeholder="file://docs/mon-document.md"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-200 font-mono text-sm"
          />
          <p className="text-xs text-gray-600">L'URI qui servira d'ancre. Auto-détecté si vous chargez un fichier.</p>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-gray-400">Type de source</label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-200"
          >
            <option value="specification">📋 Spécification</option>
            <option value="official_documentation">📚 Documentation officielle</option>
            <option value="code_repository">📦 Dépôt de code</option>
            <option value="peer_review">👥 Revue par les pairs</option>
            <option value="other">📝 Autre</option>
          </select>
          <p className="text-xs text-gray-600">Détermine la force d'ancrage (Principe A).</p>
        </div>
      </div>

      {/* Bouton d'import */}
      <button
        onClick={handleImport}
        disabled={loading || !markdown.trim()}
        className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-xl font-semibold text-lg transition"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⏳</span> Import en cours...
          </span>
        ) : (
          '🪐 Importer dans la Toile TTC'
        )}
      </button>

      {/* Erreur */}
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Résultat */}
      {result && (
        <div className="space-y-4">
          <div className="p-4 bg-green-900/30 border border-green-800 rounded-lg">
            <p className="text-green-400 font-semibold text-lg">
              ✅ {result.imported} / {result.total} sections importées
            </p>
            {result.errors && result.errors.length > 0 && (
              <p className="text-yellow-400 text-sm mt-1">
                ⚠️ {result.errors.length} erreur(s)
              </p>
            )}
          </div>

          {/* Liste des nœuds créés */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 text-sm text-gray-400 font-medium">
              Nœuds créés
            </div>
            <div className="divide-y divide-gray-800 max-h-80 overflow-y-auto">
              {result.nodes.map((node) => (
                <div key={node.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-800/50 transition">
                  <span className="text-lg">{kindIcon(node.kind)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-200 text-sm truncate">{node.section}</p>
                    <p className="text-gray-500 text-xs">{node.kind}</p>
                  </div>
                  <code className="text-gray-600 text-xs">{node.id.slice(0, 8)}...</code>
                </div>
              ))}
            </div>
          </div>

          {/* Actions post-import */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setMarkdown('');
                setResult(null);
                setError(null);
              }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
            >
              📝 Nouvel import
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  result.nodes.map((n) => `- [${n.kind}] ${n.section} (${n.id})`).join('\n')
                );
              }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
            >
              📋 Copier la liste
            </button>
          </div>
        </div>
      )}

      {/* Guide rapide */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-2">
        <h3 className="text-sm font-semibold text-gray-400">📖 Format attendu</h3>
        <pre className="text-xs text-gray-500 font-mono bg-gray-950/50 p-3 rounded-lg">
{`## Introduction
→ Nœud de type "documentation"

## Règle 1
→ Nœud de type "rule" (contient "Règle" ou "Rule")

## Implémentation API
→ Nœud de type "fact" (contient "Code" ou "API" ou "Implémentation")

## Conclusion
→ Nœud de type "documentation"`}
        </pre>
        <p className="text-xs text-gray-600 mt-2">
          Chaque nœud est automatiquement ancré au fichier source (Principe A). Les embeddings Gemini sont générés au prochain backfill.
        </p>
      </div>
    </div>
  );
}
