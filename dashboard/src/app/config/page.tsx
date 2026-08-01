'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** Type pour la config LLM côté frontend */
interface EmbeddingConfig {
  provider: string;
  apiUrl?: string;
  apiKey?: string;
  model: string;
  dimensions: number;
  enabled: boolean;
}

interface AnalysisConfig {
  provider: string;
  apiUrl?: string;
  apiKey?: string;
  model: string;
  enabled: boolean;
}

interface LlmConfig {
  embedding: EmbeddingConfig;
  analysis: AnalysisConfig;
  detectionPrompt?: string;
}

const PROVIDERS = [
  { value: 'none', label: '🔒 Aucun (fallback hash)' },
  { value: 'openai', label: '🤖 OpenAI' },
  { value: 'gemini', label: '💎 Gemini (Google)' },
  { value: 'ollama', label: '🦙 Ollama (local)' },
  { value: 'anthropic', label: '🔮 Anthropic' },
] as const;

export default function ConfigPage() {
  const [config, setConfig] = useState<LlmConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const data = await api.getLlmConfig();
      setConfig(data);
    } catch (e) {
      setMessage('⚠️ API inaccessible');
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    if (!config) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.updateLlmConfig(config);
      setMessage('✅ Configuration sauvegardée.');
    } catch (e) {
      setMessage('❌ Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    if (!config?.embedding) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.testLlmConnection({
        provider: config.embedding.provider,
        apiUrl: config.embedding.apiUrl,
        apiKey: config.embedding.apiKey,
        model: config.embedding.model,
      });
      setTestResult(result);
    } catch (e) {
      setTestResult({ success: false, error: 'Erreur réseau' });
    } finally {
      setTesting(false);
    }
  }

  function updateEmbedding(field: keyof EmbeddingConfig, value: string | number | boolean) {
    if (!config) return;
    setConfig({
      ...config,
      embedding: { ...config.embedding, [field]: value },
    });
  }

  function updateAnalysis(field: keyof AnalysisConfig, value: string | number | boolean) {
    if (!config) return;
    setConfig({
      ...config,
      analysis: { ...config.analysis, [field]: value },
    });
  }

  if (loading) return <div className="text-muted">Chargement...</div>;
  if (!config) return <div className="alert alert-danger">API inaccessible</div>;

  return (<>
    <div className="d-flex align-items-center justify-content-between mb-4">
      <div><h4 className="mb-1">⚙️ Configuration des LLMs</h4>
        <p className="text-muted mb-0">Configurez les fournisseurs d&apos;embedding et d&apos;analyse utilisés par le moteur TTC.</p></div>
    </div>

    {/* Message */}
    {message && (
      <div className={`alert ${message.startsWith('✅') ? 'alert-success' : 'alert-danger'}`}>{message}</div>
    )}

    {/* Section Embedding */}
    <div className="card mb-4">
      <div className="card-header">
        <h5 className="card-title mb-0">🧬 Fournisseur d&apos;Embedding</h5>
        <p className="card-text text-muted small mt-1 mb-0">
          Génére les vecteurs sémantiques stockés dans pgvector. Utilisé pour initialiser Γ (cohérence) et w_ij (poids des liens).
        </p>
      </div>
      <div className="card-body">

        {/* Provider */}
        <Field label="Fournisseur">
          <select className="form-select"
            value={config.embedding.provider}
            onChange={(e) => updateEmbedding('provider', e.target.value)}>
            {PROVIDERS.filter(p => p.value !== 'anthropic').map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </Field>

        {config.embedding.provider !== 'none' && (
          <>
            <Field label="Clé API">
              <input type="password" className="form-control font-monospace"
                value={config.embedding.apiKey || ''}
                onChange={(e) => updateEmbedding('apiKey', e.target.value)}
                placeholder={config.embedding.provider === 'openai' ? 'sk-...' : config.embedding.provider === 'gemini' ? 'AIza...' : '(optionnel pour Ollama)'} />
            </Field>

            {(config.embedding.provider === 'ollama' || config.embedding.provider === 'gemini') && (
              <Field label={config.embedding.provider === 'gemini' ? 'URL API Gemini (optionnel)' : "URL de l'API Ollama"}>
                <input type="text" className="form-control font-monospace"
                  value={config.embedding.apiUrl || (config.embedding.provider === 'gemini' ? 'https://generativelanguage.googleapis.com' : 'http://localhost:11434')}
                  onChange={(e) => updateEmbedding('apiUrl', e.target.value)} />
              </Field>
            )}

            <Field label="Modèle">
              <input type="text" className="form-control"
                value={config.embedding.model}
                onChange={(e) => updateEmbedding('model', e.target.value)} />
            </Field>

            <Field label="Dimensions">
              <input type="number" className="form-control"
                value={config.embedding.dimensions}
                onChange={(e) => updateEmbedding('dimensions', parseInt(e.target.value) || 1536)} />
            </Field>

            <div className="form-check mb-3">
              <input className="form-check-input" type="checkbox"
                checked={config.embedding.enabled}
                onChange={(e) => updateEmbedding('enabled', e.target.checked)} />
              <label className="form-check-label">Activer ce fournisseur</label>
            </div>

            {/* Bouton Test */}
            <button onClick={testConnection} disabled={testing} className="btn btn-info">
              {testing ? <><span className="spinner-border spinner-border-sm me-1"></span>Test en cours...</> : '🔌 Tester la connexion'}
            </button>

            {/* Résultat du test */}
            {testResult && (
              <div className={`alert ${testResult.success ? 'alert-success' : 'alert-danger'} mt-3`}>
                {testResult.success
                  ? `✅ Connexion réussie — ${testResult.latencyMs}ms, ${testResult.sampleDimensions || '?'} dimensions`
                  : `❌ Échec : ${testResult.error || 'Erreur inconnue'}`}
              </div>
            )}
          </>
        )}
      </div>
    </div>

    {/* Section Analyse */}
    <div className="card mb-4">
      <div className="card-header">
        <h5 className="card-title mb-0">🧠 LLM d&apos;Analyse</h5>
        <p className="card-text text-muted small mt-1 mb-0">
          Modèle utilisé pour la détection avancée d&apos;hallucination et la résolution de contradictions (Principe C).
        </p>
      </div>
      <div className="card-body">

        <Field label="Fournisseur">
          <select className="form-select"
            value={config.analysis.provider}
            onChange={(e) => updateAnalysis('provider', e.target.value)}>
            {PROVIDERS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </Field>

        {config.analysis.provider !== 'none' && (
          <>
            <Field label="Clé API">
              <input type="password" className="form-control font-monospace"
                value={config.analysis.apiKey || ''}
                onChange={(e) => updateAnalysis('apiKey', e.target.value)}
                placeholder="sk-..." />
            </Field>

            <Field label="Modèle">
              <input type="text" className="form-control"
                value={config.analysis.model}
                onChange={(e) => updateAnalysis('model', e.target.value)} />
            </Field>

            <div className="form-check mb-3">
              <input className="form-check-input" type="checkbox"
                checked={config.analysis.enabled}
                onChange={(e) => updateAnalysis('enabled', e.target.checked)} />
              <label className="form-check-label">Activer ce fournisseur</label>
            </div>
          </>
        )}

        <Field label="Prompt de détection">
          <textarea className="form-control font-monospace small"
            value={config.detectionPrompt || ''}
            onChange={(e) => setConfig({ ...config, detectionPrompt: e.target.value })}
            rows={4} />
        </Field>
      </div>
    </div>

    {/* Bouton Sauvegarder */}
    <button onClick={saveConfig} disabled={saving} className="btn btn-purple btn-lg">
      {saving ? <><span className="spinner-border spinner-border-sm me-1"></span>Sauvegarde...</> : '💾 Sauvegarder la configuration'}
    </button>
  </>);
}

/** Composant champ de formulaire */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="form-label text-muted">{label}</label>
      {children}
    </div>
  );
}
