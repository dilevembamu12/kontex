/// @anchor: Service de configuration des fournisseurs LLM
/// Gère les clés API, modèles d'embedding, et paramètres des LLMs utilisés par KontEx.
///
/// # Stockage
/// Table `settings` en PostgreSQL (clé/valeur JSONB) avec fallback fichier .env

import { environment } from '../config/environment.js';

/** Configuration d'un fournisseur d'embedding */
export interface EmbeddingProviderConfig {
  /** Type de fournisseur */
  provider: 'openai' | 'ollama' | 'gemini' | 'local' | 'none';
  /** URL de l'API (pour Ollama/Gemini-compatible) */
  apiUrl?: string;
  /** Clé API */
  apiKey?: string;
  /** Nom du modèle */
  model: string;
  /** Dimension des embeddings */
  dimensions: number;
  /** Activé ? */
  enabled: boolean;
}

/** Configuration d'un fournisseur LLM (analyse, détection) */
export interface LlmProviderConfig {
  provider: 'openai' | 'ollama' | 'anthropic' | 'gemini' | 'none';
  apiUrl?: string;
  apiKey?: string;
  model: string;
  enabled: boolean;
}

/** Configuration globale des LLMs */
export interface LlmConfig {
  embedding: EmbeddingProviderConfig;
  analysis: LlmProviderConfig;
  /** Prompt système pour la détection d'hallucination */
  detectionPrompt?: string;
}

/** Configuration par défaut */
export const DEFAULT_LLM_CONFIG: LlmConfig = {
  embedding: {
    provider: 'none',
    model: 'text-embedding-3-small',
    dimensions: 1536,
    enabled: false,
  },
  analysis: {
    provider: 'none',
    model: 'gpt-4o-mini',
    enabled: false,
  },
  detectionPrompt: `Tu es un détecteur d'hallucination basé sur la Théorie de la Toile Cosmologique (TTC).
Analyse l'assertion suivante par rapport aux faits ancrés fournis.
Réponds UNIQUEMENT avec un JSON : {"isHallucination":bool,"confidence":float,"reason":"..."}`,
};

// Cache mémoire
let cachedConfig: LlmConfig | null = null;

/**
 * Charge la configuration LLM depuis la base PostgreSQL ou les variables d'env.
 */
export async function getLlmConfig(): Promise<LlmConfig> {
  if (cachedConfig) return cachedConfig;

  // 1. Tente PostgreSQL
  try {
    const pg = await import('pg');
    const { Pool } = pg.default as typeof import('pg');
    const pool = new Pool({
      connectionString: environment.DATABASE_URL,
      connectionTimeoutMillis: 2000,
      max: 1,
    });
    const result = await pool.query(
      "SELECT value FROM settings WHERE key = 'llm_config'",
    );
    await pool.end();

    if (result.rows.length > 0) {
      const stored = result.rows[0] as { value: unknown };
      cachedConfig = { ...DEFAULT_LLM_CONFIG, ...(stored.value as Partial<LlmConfig>) };
      return cachedConfig;
    }
  } catch {
    // PG indisponible → fallback env
  }

  // 2. Fallback : construit depuis les variables d'environnement
  cachedConfig = buildConfigFromEnv();
  return cachedConfig;
}

/**
 * Sauvegarde la configuration LLM.
 * Stocke tout, y compris la clé API (le dashboard est protégé par auth).
 */
export async function saveLlmConfig(config: LlmConfig): Promise<void> {
  try {
    const pg = await import('pg');
    const { Pool } = pg.default as typeof import('pg');
    const pool = new Pool({
      connectionString: environment.DATABASE_URL,
      connectionTimeoutMillis: 2000,
      max: 1,
    });

    // Crée la table settings si nécessaire
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ('llm_config', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(config)],
    );
    await pool.end();

    // Met à jour le cache
    cachedConfig = { ...config };
    console.log('[KontEx::Config] Configuration LLM sauvegardée :', config.embedding.provider);
  } catch (err) {
    console.warn('[KontEx::Config] Sauvegarde PostgreSQL échouée:', err);
  }
}

/**
 * Teste la connexion à un fournisseur d'embedding.
 */
export async function testEmbeddingProvider(config: EmbeddingProviderConfig): Promise<{
  success: boolean;
  latencyMs: number;
  sampleDimensions?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    if (config.provider === 'openai') {
      const apiKey = config.apiKey || process.env['OPENAI_API_KEY'];
      if (!apiKey) throw new Error('Clé API OpenAI manquante');

      const response = await fetch(config.apiUrl || 'https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model || 'text-embedding-3-small',
          input: 'KontEx TTC embedding test',
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${errBody.slice(0, 200)}`);
      }

      const json = await response.json() as { data: Array<{ embedding: number[] }> };
      const dims = json.data[0]?.embedding?.length;
      return {
        success: true as const,
        latencyMs: Date.now() - start,
        ...(dims !== undefined ? { sampleDimensions: dims } : {}),
      };
    }

    if (config.provider === 'ollama') {
      const response = await fetch(`${config.apiUrl || 'http://localhost:11434'}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model || 'nomic-embed-text',
          prompt: 'KontEx TTC embedding test',
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error ${response.status}`);
      }

      const json = await response.json() as { embedding: number[] };
      return {
        success: true,
        latencyMs: Date.now() - start,
        sampleDimensions: json.embedding?.length,
      };
    }

    if (config.provider === 'gemini') {
      const apiKey = config.apiKey || process.env['GEMINI_API_KEY'] || process.env['GOOGLE_API_KEY'];
      if (!apiKey) throw new Error('Clé API Gemini/Google manquante');

      const model = config.model || 'text-embedding-004';
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${model}`,
            content: { parts: [{ text: 'KontEx TTC embedding test' }] },
          }),
        },
      );

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errBody.slice(0, 200)}`);
      }

      const json = await response.json() as { embedding?: { values?: number[] } };
      const dims = json.embedding?.values?.length;
      return {
        success: true as const,
        latencyMs: Date.now() - start,
        ...(dims !== undefined ? { sampleDimensions: dims } : {}),
      };
    }

    return { success: false, latencyMs: 0, error: `Provider "${config.provider}" non supporté` };
  } catch (err) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Erreur inconnue',
    };
  }
}

// ============================================================
// Helpers privés
// ============================================================

function buildConfigFromEnv(): LlmConfig {
  const config = { ...DEFAULT_LLM_CONFIG };

  // OpenAI
  if (process.env['OPENAI_API_KEY']) {
    config.embedding = {
      provider: 'openai',
      apiKey: '', // Injecté par injectEnvApiKeys
      model: process.env['OPENAI_EMBEDDING_MODEL'] || 'text-embedding-3-small',
      dimensions: 1536,
      enabled: true,
    };
    config.analysis = {
      provider: 'openai',
      apiKey: '',
      model: process.env['OPENAI_MODEL'] || 'gpt-4o-mini',
      enabled: true,
    };
  }

  // Gemini / Google AI
  if (process.env['GEMINI_API_KEY'] || process.env['GOOGLE_API_KEY']) {
    config.embedding = {
      provider: 'gemini',
      apiKey: '',
      model: process.env['GEMINI_EMBEDDING_MODEL'] || 'text-embedding-004',
      dimensions: 768,
      enabled: true,
    };
    config.analysis = {
      provider: 'gemini',
      apiKey: '',
      model: process.env['GEMINI_MODEL'] || 'gemini-2.0-flash',
      enabled: true,
    };
  }

  // Ollama
  if (process.env['OLLAMA_URL']) {
    config.embedding = {
      provider: 'ollama',
      apiUrl: process.env['OLLAMA_URL'],
      model: process.env['OLLAMA_EMBEDDING_MODEL'] || 'nomic-embed-text',
      dimensions: 768,
      enabled: true,
    };
  }

  injectEnvApiKeys(config);
  return config;
}

function injectEnvApiKeys(config: LlmConfig): void {
  if (config.embedding.provider === 'openai' && !config.embedding.apiKey) {
    config.embedding.apiKey = process.env['OPENAI_API_KEY'] || '';
  }
  if (config.embedding.provider === 'gemini' && !config.embedding.apiKey) {
    config.embedding.apiKey = process.env['GEMINI_API_KEY'] || process.env['GOOGLE_API_KEY'] || '';
  }
  if (config.analysis.provider === 'openai' && !config.analysis.apiKey) {
    config.analysis.apiKey = process.env['OPENAI_API_KEY'] || '';
  }
  if (config.analysis.provider === 'gemini' && !config.analysis.apiKey) {
    config.analysis.apiKey = process.env['GEMINI_API_KEY'] || process.env['GOOGLE_API_KEY'] || '';
  }
}

/** Supprime les clés API avant stockage en base */
function sanitizeForStorage(config: LlmConfig): Record<string, unknown> {
  const { apiKey: _embKey, ...embRest } = config.embedding;
  const { apiKey: _anaKey, ...anaRest } = config.analysis;
  return {
    embedding: embRest,
    analysis: anaRest,
    detectionPrompt: config.detectionPrompt,
  };
}
