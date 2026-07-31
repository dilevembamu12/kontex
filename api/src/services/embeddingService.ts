/// @anchor: pgvector — https://github.com/pgvector/pgvector
/// Service de génération d'embeddings vectoriels pour la toile TTC.
///
/// # Stratégie
/// - Mode production : OpenAI text-embedding-3-small (1536 dims) ou modèle local
/// - Mode fallback : Pseudo-embedding déterministe par hachage de n-grammes
///
/// Le fallback produit un vecteur 1536-dim stable pour un texte donné,
/// permettant la recherche cosinus sans dépendance externe.
/// Les vrais embeddings peuvent être injectés en remplaçant `generateEmbedding`.
///
/// # Mapping TTC
/// - Γ (Cohérence) initial = cosine_similarity(assertion, anchored_fact)
/// - w_{ij} (Poids du lien) = cosine_similarity(node_i, node_j)

import { createHash } from 'node:crypto';

/** Dimension des embeddings (OpenAI text-embedding-3-small = 1536) */
export const EMBEDDING_DIM = 1536;

/**
 * Interface du générateur d'embeddings.
 */
export interface EmbeddingGenerator {
  /** Génère un embedding pour un texte donné */
  embed(text: string): Promise<Float32Array>;
  /** Dimension de sortie */
  readonly dim: number;
}

/**
 * Générateur fallback : pseudo-embedding déterministe par hachage de n-grammes.
 *
 * Algorithme :
 * 1. Tokenise le texte en n-grammes (n=1,2,3)
 * 2. Hache chaque n-gramme avec SHA256 → index dans [0, dim-1]
 * 3. Accumule les activations pondérées par TF (term frequency)
 * 4. Normalise L2 le vecteur final
 *
 * Ce n'est pas sémantique (pas de synonymes), mais c'est :
 * - Déterministe (même texte → même vecteur)
 * - Rapide (pas d'appel API)
 * - Suffisant pour la similarité cosinus basée sur le vocabulaire
 */
export class HashEmbeddingGenerator implements EmbeddingGenerator {
  readonly dim: number;

  constructor(dim: number = EMBEDDING_DIM) {
    this.dim = dim;
  }

  async embed(text: string): Promise<Float32Array> {
    const vector = new Float32Array(this.dim);
    const lower = text.toLowerCase();

    // 1. Tokenise en unigrams, bigrams, trigrams
    const tokens = this.tokenize(lower);

    // 2. Compte les fréquences
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) ?? 0) + 1);
    }

    // 3. Projette chaque token dans le vecteur via hachage
    for (const [token, freq] of tf) {
      const hash = createHash('sha256').update(token).digest();
      // Utilise les 4 premiers bytes du hash comme index de base
      const baseIdx = hash.readUInt32BE(0) % this.dim;
      // Étale l'activation sur 3 positions voisines (smoothing)
      const weight = Math.log(1 + freq); // TF pondéré par log
      for (let offset = -1; offset <= 1; offset++) {
        const idx = ((baseIdx + offset + this.dim) % this.dim);
        vector[idx] = (vector[idx] ?? 0) + weight * (1.0 - Math.abs(offset) * 0.3);
      }
    }

    // 4. Normalisation L2
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + (v ?? 0) * (v ?? 0), 0));
    if (norm > 0) {
      for (let i = 0; i < this.dim; i++) {
        vector[i] = (vector[i] ?? 0) / norm;
      }
    }

    return vector;
  }

  /**
   * Tokenise en unigrams, bigrams, trigrams.
   */
  private tokenize(text: string): string[] {
    // Nettoie : garde alphanum + espaces
    const cleaned = text.replace(/[^a-zà-ÿ0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = cleaned.split(' ').filter((w) => w.length >= 2);

    const tokens: string[] = [];

    // Unigrams
    for (const w of words) {
      tokens.push(w);
    }

    // Bigrams
    for (let i = 0; i < words.length - 1; i++) {
      tokens.push(`${words[i]}_${words[i + 1]}`);
    }

    // Trigrams
    for (let i = 0; i < words.length - 2; i++) {
      tokens.push(`${words[i]}_${words[i + 1]}_${words[i + 2]}`);
    }

    return tokens;
  }
}

/**
 * Calcule la similarité cosinus entre deux vecteurs.
 *
 * cos(θ) = (a · b) / (||a|| · ||b||)
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Dimensions incompatibles : ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dot / denominator;
}

/**
 * Convertit un Float32Array en chaîne pgvector (format '[0.1,0.2,...]').
 */
export function toPgVector(vector: Float32Array): string {
  const values = Array.from(vector)
    .map((v) => Number.isFinite(v) ? v.toFixed(6) : '0')
    .join(',');
  return `[${values}]`;
}

/**
 * Parse une chaîne pgvector en Float32Array.
 */
export function fromPgVector(pgString: string, dim: number): Float32Array {
  const cleaned = pgString.replace(/[\[\]]/g, '');
  const values = cleaned.split(',').map(Number);
  const vec = new Float32Array(dim);
  for (let i = 0; i < Math.min(values.length, dim); i++) {
    vec[i] = values[i] ?? 0;
  }
  return vec;
}

// ============================================================
// Générateurs d'embeddings natifs (OpenAI, Gemini, Ollama)
// ============================================================

/**
 * Générateur d'embeddings via l'API Gemini (Google).
 *
 * Modèles supportés :
 * - text-embedding-004 (768 dimensions)
 * - embedding-001 (768 dimensions)
 *
 * API : https://ai.google.dev/gemini-api/docs/embeddings
 */
export class GeminiEmbeddingGenerator implements EmbeddingGenerator {
  readonly dim: number;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(options: { apiKey: string; model?: string; dim?: number }) {
    this.apiKey = options.apiKey;
    this.model = options.model || 'text-embedding-004';
    this.dim = options.dim || 768;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  async embed(text: string): Promise<Float32Array> {
    const url = `${this.baseUrl}/${this.model}:embedContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini embedding error ${response.status}: ${body.slice(0, 300)}`);
    }

    const json = await response.json() as {
      embedding?: { values?: number[] };
    };

    const values = json.embedding?.values;
    if (!values || values.length === 0) {
      throw new Error('Gemini embedding response empty');
    }

    const vec = new Float32Array(this.dim);
    for (let i = 0; i < Math.min(values.length, this.dim); i++) {
      vec[i] = values[i] ?? 0;
    }

    // Normalisation L2 (Gemini ne normalise pas toujours)
    const norm = Math.sqrt(vec.reduce((s, v) => s + (v ?? 0) * (v ?? 0), 0));
    if (norm > 0) {
      for (let i = 0; i < this.dim; i++) {
        vec[i] = (vec[i] ?? 0) / norm;
      }
    }

    return vec;
  }
}

/**
 * Générateur d'embeddings via l'API OpenAI.
 */
export class OpenAIEmbeddingGenerator implements EmbeddingGenerator {
  readonly dim: number;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(options: { apiKey: string; model?: string; dim?: number; baseUrl?: string }) {
    this.apiKey = options.apiKey;
    this.model = options.model || 'text-embedding-3-small';
    this.dim = options.dim || 1536;
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1/embeddings';
  }

  async embed(text: string): Promise<Float32Array> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI embedding error ${response.status}: ${body.slice(0, 300)}`);
    }

    const json = await response.json() as { data: Array<{ embedding: number[] }> };
    const values = json.data?.[0]?.embedding;
    if (!values) throw new Error('OpenAI embedding response empty');

    const vec = new Float32Array(this.dim);
    for (let i = 0; i < Math.min(values.length, this.dim); i++) {
      vec[i] = values[i] ?? 0;
    }
    return vec;
  }
}

/**
 * Générateur d'embeddings via Ollama (local).
 */
export class OllamaEmbeddingGenerator implements EmbeddingGenerator {
  readonly dim: number;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(options: { baseUrl?: string; model?: string; dim?: number }) {
    this.baseUrl = options.baseUrl || 'http://localhost:11434';
    this.model = options.model || 'nomic-embed-text';
    this.dim = options.dim || 768;
  }

  async embed(text: string): Promise<Float32Array> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama embedding error ${response.status}: ${body.slice(0, 300)}`);
    }

    const json = await response.json() as { embedding: number[] };
    if (!json.embedding) throw new Error('Ollama embedding response empty');

    const vec = new Float32Array(this.dim);
    for (let i = 0; i < Math.min(json.embedding.length, this.dim); i++) {
      vec[i] = json.embedding[i] ?? 0;
    }
    return vec;
  }
}

// ============================================================
// Factory : sélectionne le générateur selon la config
// ============================================================

let _configuredGenerator: EmbeddingGenerator | null = null;

/**
 * Retourne le générateur d'embeddings configuré.
 * Priorité : config LLM > variables d'env > fallback hash.
 */
export async function getEmbeddingGenerator(): Promise<EmbeddingGenerator> {
  if (_configuredGenerator) return _configuredGenerator;

  try {
    const { getLlmConfig } = await import('./configService.js');
    const config = await getLlmConfig();

    if (config.embedding.enabled) {
      const apiKey = config.embedding.apiKey || '';

      switch (config.embedding.provider) {
        case 'openai':
          if (apiKey) {
            console.log('[KontEx::Embed] OpenAI activé —', config.embedding.model);
            _configuredGenerator = new OpenAIEmbeddingGenerator({
              apiKey,
              model: config.embedding.model,
              dim: config.embedding.dimensions,
              baseUrl: config.embedding.apiUrl || undefined,
            } as { apiKey: string; model?: string; dim?: number; baseUrl?: string });
            return _configuredGenerator;
          }
          break;

        case 'gemini':
          if (apiKey) {
            console.log('[KontEx::Embed] Gemini activé —', config.embedding.model);
            _configuredGenerator = new GeminiEmbeddingGenerator({
              apiKey,
              model: config.embedding.model,
              dim: config.embedding.dimensions,
            });
            return _configuredGenerator;
          }
          break;

        case 'ollama':
          console.log('[KontEx::Embed] Ollama activé —', config.embedding.model);
          _configuredGenerator = new OllamaEmbeddingGenerator({
            baseUrl: config.embedding.apiUrl || undefined,
            model: config.embedding.model,
            dim: config.embedding.dimensions,
          } as { baseUrl?: string; model?: string; dim?: number });
          return _configuredGenerator;
      }
    }
  } catch {
    // Config inaccessible → fallback
  }

  console.log('[KontEx::Embed] Aucun fournisseur configuré — fallback hash activé');
  _configuredGenerator = new HashEmbeddingGenerator(EMBEDDING_DIM);
  return _configuredGenerator;
}

/**
 * Singleton rétrocompatible (pour le code existant).
 * Utilise le fallback hash tant que getEmbeddingGenerator() n'a pas été appelé.
 */
export let embeddingGenerator: EmbeddingGenerator = new HashEmbeddingGenerator(EMBEDDING_DIM);

/**
 * Initialise le générateur d'embeddings depuis la config.
 * À appeler au démarrage de l'API.
 */
export async function initEmbeddingGenerator(): Promise<void> {
  embeddingGenerator = await getEmbeddingGenerator();
}
