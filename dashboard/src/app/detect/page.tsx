'use client';

import { useState, useRef } from 'react';
import { api } from '@/lib/api';

interface DetectResult {
  isHallucination: boolean;
  confidence: number;
  tension: number;
  verdict: string;
  method: string;
  maxEdgeTension: number;
  similarNodesCount: number;
  maxSimilarity: number;
  contradictingNodeIds: string[];
  suggestions: string[];
}

export default function DetectPage() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DetectResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ content: string; tension: number; verdict: string }>>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function handleDetect() {
    if (!content.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const r = await api.detect(content);
      setResult(r as unknown as DetectResult);
      setHistory(prev => [{ content: content.slice(0, 80), tension: (r as unknown as DetectResult).tension, verdict: (r as unknown as DetectResult).verdict }, ...prev].slice(0, 10));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de détection');
    } finally { setLoading(false); }
  }

  const tensionPercent = result ? Math.round(result.tension * 100) : 0;
  const tensionColor = result
    ? result.verdict === 'hallucination' ? 'danger' : result.verdict === 'coherent' ? 'success' : 'warning'
    : 'secondary';

  return (<>
    <div className="d-flex align-items-center justify-content-between mb-4">
      <div><h4 className="mb-1">🔍 Détection d&apos;Hallucination</h4>
        <p className="text-muted mb-0">Pipeline TTC v1.1 / MCW-2 — Résolution des équations de champ sur le graphe contextuel</p></div>
      <span className="badge bg-soft-purple text-purple">MCW-2 · T<sub>crit</sub>=0.10</span>
    </div>

    <div className="row g-3">
      {/* Zone de saisie */}
      <div className="col-lg-7">
        <div className="card">
          <div className="card-header"><h5 className="card-title mb-0">📝 Assertion à analyser</h5></div>
          <div className="card-body">
            <textarea ref={inputRef} className="form-control font-monospace small" rows={5}
              value={content} onChange={e => setContent(e.target.value)}
              placeholder="Ex: Python: la fonction len() retourne un entier...&#10;Ex: React: useState retourne [state, setState, resetState]..."
              onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleDetect()} />
            <div className="d-flex align-items-center justify-content-between mt-3">
              <span className="text-muted small">Ctrl+Enter pour détecter</span>
              <button className="btn btn-purple btn-lg px-4" onClick={handleDetect} disabled={loading || !content.trim()}>
                {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Résolution TTC...</> : '🪐 Détecter'}
              </button>
            </div>
          </div>
        </div>

        {/* Résultat */}
        {result && (
          <div className="card mt-3">
            <div className={`card-header bg-soft-${tensionColor}`}>
              <h5 className="card-title mb-0 d-flex align-items-center gap-2">
                <span className={`badge bg-${tensionColor} fs-6`}>
                  {result.verdict === 'hallucination' ? '🔴 HALLUCINATION' : result.verdict === 'coherent' ? '🟢 COHÉRENT' : '🟡 INCONCLUSIF'}
                </span>
                <span className="text-muted small">via {result.method}</span>
              </h5>
            </div>
            <div className="card-body">
              <div className="row g-3 mb-3">
                <div className="col-sm-4 text-center">
                  <div className="position-relative d-inline-block">
                    <div className="spinner-grow text-dark" style={{ width: 80, height: 80, position: 'absolute', top: -10, left: -10, opacity: 0.1 }}></div>
                    <span className={`fs-1 fw-bold text-${tensionColor}`}>{tensionPercent}%</span>
                  </div>
                  <p className="text-muted small mb-0 mt-1">Tension T</p>
                </div>
                <div className="col-sm-4 text-center">
                  <span className="fs-1 fw-bold">{result.similarNodesCount}</span>
                  <p className="text-muted small mb-0 mt-1">Nœuds similaires</p>
                </div>
                <div className="col-sm-4 text-center">
                  <span className="fs-1 fw-bold">{(result.maxSimilarity * 100).toFixed(1)}%</span>
                  <p className="text-muted small mb-0 mt-1">Similarité max</p>
                </div>
              </div>

              {/* Barre de tension */}
              <div className="mb-3">
                <div className="d-flex justify-content-between small mb-1">
                  <span className="text-success">0% Cohérent</span>
                  <span className="text-danger">100% Hallucination</span>
                </div>
                <div className="progress" style={{ height: 12 }}>
                  <div className={`progress-bar bg-${tensionColor}`} style={{ width: `${tensionPercent}%` }}
                    role="progressbar" aria-valuenow={tensionPercent} aria-valuemin={0} aria-valuemax={100} />
                </div>
                <div className="d-flex justify-content-between small mt-1">
                  <span>Seuil T<sub>crit</sub> = 0.10</span>
                  <span className={`fw-bold text-${tensionColor}`}>T = {result.tension.toFixed(4)}</span>
                </div>
              </div>

              {/* Suggestions */}
              {result.suggestions.length > 0 && (
                <div className={`alert alert-${tensionColor === 'danger' ? 'danger' : 'success'} mb-0`}>
                  {result.suggestions.map((s, i) => <div key={i}>💡 {s}</div>)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Erreur */}
        {error && <div className="alert alert-danger mt-3">{error}</div>}
      </div>

      {/* Panneau latéral */}
      <div className="col-lg-5">
        {/* Quick tests */}
        <div className="card mb-3">
          <div className="card-header"><h5 className="card-title mb-0">⚡ Tests rapides</h5></div>
          <div className="list-group list-group-flush">
            {[
              { label: '✅ len() → int (cohérent)', text: 'Python: la fonction len() retourne un entier int' },
              { label: '🔴 len() → float (hallucination)', text: 'Python: la fonction len() retourne un float' },
              { label: '✅ useState → 2 éléments (cohérent)', text: 'React: useState retourne un tableau de 2 elements state et setState' },
              { label: '🔴 useState → 4 éléments (hallucination)', text: 'React: useState retourne state, setState, resetState, dispatch' },
              { label: '🔴 types TS au runtime (hallucination)', text: 'TypeScript: les types sont conserves et evalues au runtime' },
            ].map((item, i) => (
              <button key={i} className="list-group-item list-group-item-action text-start small"
                onClick={() => { setContent(item.text); setResult(null); setError(null); inputRef.current?.focus(); }}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Historique */}
        {history.length > 0 && (
          <div className="card">
            <div className="card-header"><h5 className="card-title mb-0">📋 Historique</h5></div>
            <div className="list-group list-group-flush" style={{ maxHeight: 300, overflowY: 'auto' }}>
              {history.map((h, i) => (
                <div key={i} className="list-group-item d-flex align-items-center gap-2 small">
                  <span className={`badge bg-soft-${h.verdict === 'hallucination' ? 'danger' : 'success'} text-${h.verdict === 'hallucination' ? 'danger' : 'success'}`}
                    style={{ minWidth: 90 }}>{h.verdict}</span>
                  <span className="flex-fill text-truncate">{h.content}</span>
                  <span className="text-muted">T={(h.tension * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </>);
}
