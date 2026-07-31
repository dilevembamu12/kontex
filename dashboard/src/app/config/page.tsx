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

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>;
  if (!config) return <div className="p-8 text-red-400">API inaccessible</div>;

  return (
    <div className="space-y-8 p-8 max-w-4xl">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-purple-400">⚙️ Configuration des LLMs</h1>
        <p className="text-gray-500 mt-1">
          Configurez les fournisseurs d'embedding et d'analyse utilisés par le moteur TTC.
        </p>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg text-sm ${message.startsWith('✅') ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-red-900/30 text-red-400 border border-red-800'}`}>
          {message}
        </div>
      )}

      {/* Section Embedding */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-cyan-400">🧬 Fournisseur d'Embedding</h2>
        <p className="text-xs text-gray-500">
          Génére les vecteurs sémantiques (1536d) stockés dans pgvector. Utilisé pour initialiser Γ (cohérence) et w_ij (poids des liens).
        </p>

        {/* Provider */}
        <Field label="Fournisseur">
          <select
            value={config.embedding.provider}
            onChange={(e) => updateEmbedding('provider', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-200"
          >
            {PROVIDERS.filter(p => p.value !== 'anthropic').map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </Field>

        {config.embedding.provider !== 'none' && (
          <>
            <Field label="Clé API">
              <input
                type="password"
                value={config.embedding.apiKey || ''}
                onChange={(e) => updateEmbedding('apiKey', e.target.value)}
                placeholder={
                  config.embedding.provider === 'openai' ? 'sk-...' :
                  config.embedding.provider === 'gemini' ? 'AIza...' :
                  '(optionnel pour Ollama)'
                }
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-200 font-mono"
              />
            </Field>

            {(config.embedding.provider === 'ollama' || config.embedding.provider === 'gemini') && (
              <Field label={config.embedding.provider === 'gemini' ? 'URL API Gemini (optionnel)' : "URL de l'API Ollama"}>
                <input
                  type="text"
                  value={config.embedding.apiUrl || (config.embedding.provider === 'gemini' ? 'https://generativelanguage.googleapis.com' : 'http://localhost:11434')}
                  onChange={(e) => updateEmbedding('apiUrl', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-200 font-mono"
                />
              </Field>
            )}

            <Field label="Modèle">
              <input
                type="text"
                value={config.embedding.model}
                onChange={(e) => updateEmbedding('model', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-200"
              />
            </Field>

            <Field label="Dimensions">
              <input
                type="number"
                value={config.embedding.dimensions}
                onChange={(e) => updateEmbedding('dimensions', parseInt(e.target.value) || 1536)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-200"
              />
            </Field>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.embedding.enabled}
                onChange={(e) => updateEmbedding('enabled', e.target.checked)}
                className="w-5 h-5 rounded bg-gray-800 border-gray-700"
              />
              <span className="text-gray-300">Activer ce fournisseur</span>
            </div>

            {/* Bouton Test */}
            <button
              onClick={testConnection}
              disabled={testing}
              className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 rounded-lg text-sm font-medium transition"
            >
              {testing ? '⏳ Test en cours...' : '🔌 Tester la connexion'}
            </button>

            {/* Résultat du test */}
            {testResult && (
              <div className={`p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-red-900/30 text-red-400 border border-red-800'}`}>
                {testResult.success
                  ? `✅ Connexion réussie — ${testResult.latencyMs}ms, ${testResult.sampleDimensions || '?'} dimensions`
                  : `❌ Échec : ${testResult.error || 'Erreur inconnue'}`}
              </div>
            )}
          </>
        )}
      </section>

      {/* Section Analyse */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-yellow-400">🧠 LLM d'Analyse</h2>
        <p className="text-xs text-gray-500">
          Modèle utilisé pour la détection avancée d'hallucination et la résolution de contradictions (Principe C).
        </p>

        <Field label="Fournisseur">
          <select
            value={config.analysis.provider}
            onChange={(e) => updateAnalysis('provider', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-200"
          >
            {PROVIDERS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </Field>

        {config.analysis.provider !== 'none' && (
          <>
            <Field label="Clé API">
              <input
                type="password"
                value={config.analysis.apiKey || ''}
                onChange={(e) => updateAnalysis('apiKey', e.target.value)}
                placeholder="sk-..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-200 font-mono"
              />
            </Field>

            <Field label="Modèle">
              <input
                type="text"
                value={config.analysis.model}
                onChange={(e) => updateAnalysis('model', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-200"
              />
            </Field>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.analysis.enabled}
                onChange={(e) => updateAnalysis('enabled', e.target.checked)}
                className="w-5 h-5 rounded bg-gray-800 border-gray-700"
              />
              <span className="text-gray-300">Activer ce fournisseur</span>
            </div>
          </>
        )}

        <Field label="Prompt de détection">
          <textarea
            value={config.detectionPrompt || ''}
            onChange={(e) => setConfig({ ...config, detectionPrompt: e.target.value })}
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-200 font-mono text-sm"
          />
        </Field>
      </section>

      {/* Bouton Sauvegarder */}
      <div className="flex gap-3">
        <button
          onClick={saveConfig}
          disabled={saving}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg font-semibold transition"
        >
          {saving ? '⏳ Sauvegarde...' : '💾 Sauvegarder la configuration'}
        </button>
      </div>
    </div>
  );
}

/** Composant champ de formulaire */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-gray-400">{label}</label>
      {children}
    </div>
  );
}
