/// @anchor: Contrôleur de configuration des LLMs
/// Routes : GET /config/llm, PUT /config/llm, POST /config/llm/test

import type { Request, Response, NextFunction } from 'express';
import {
  getLlmConfig,
  saveLlmConfig,
  testEmbeddingProvider,
  DEFAULT_LLM_CONFIG,
  type LlmConfig,
  type EmbeddingProviderConfig,
} from '../services/configService.js';

/**
 * GET /config/llm — Récupère la configuration LLM actuelle.
 */
export async function getLlmConfiguration(_request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const config = await getLlmConfig();
    // Masque les clés API (affiche les 4 derniers caractères)
    const safe = {
      ...config,
      embedding: {
        ...config.embedding,
        apiKey: config.embedding.apiKey
          ? `••••${config.embedding.apiKey.slice(-4)}`
          : undefined,
      },
      analysis: {
        ...config.analysis,
        apiKey: config.analysis.apiKey
          ? `••••${config.analysis.apiKey.slice(-4)}`
          : undefined,
      },
    };
    response.json(safe);
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * PUT /config/llm — Met à jour la configuration LLM.
 *
 * Body: Partial<LlmConfig>
 * Les clés API sont conservées de l'env si non fournies.
 */
export async function updateLlmConfiguration(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const current = await getLlmConfig();
    const updates = request.body as Partial<LlmConfig>;

    // Fusion : conserve les clés API de l'environnement si non fournies
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merged = {
      embedding: {
        ...current.embedding,
        ...(updates.embedding || {}),
      },
      analysis: {
        ...current.analysis,
        ...(updates.analysis || {}),
      },
      detectionPrompt: updates.detectionPrompt ?? current.detectionPrompt,
    } as any as LlmConfig;

    // Si une nouvelle clé API est fournie, la conserve
    const embKey = updates.embedding?.apiKey;
    if (embKey && !embKey.startsWith('••••')) {
      (merged.embedding as unknown as Record<string, unknown>)['apiKey'] = embKey;
    }
    const anaKey = updates.analysis?.apiKey;
    if (anaKey && !anaKey.startsWith('••••')) {
      (merged.analysis as unknown as Record<string, unknown>)['apiKey'] = anaKey;
    }

    await saveLlmConfig(merged);
    response.json({ success: true, message: 'Configuration LLM sauvegardée.' });
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * POST /config/llm/test — Teste la connexion au fournisseur d'embedding.
 *
 * Body: EmbeddingProviderConfig
 */
export async function testLlmConnection(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { provider, apiUrl, apiKey, model } = request.body as {
      provider?: string;
      apiUrl?: string;
      apiKey?: string;
      model?: string;
    };

    if (!provider) {
      response.status(400).json({ error: 'Le champ "provider" est requis.' });
      return;
    }

    const testConfig = {
      provider: provider as EmbeddingProviderConfig['provider'],
      apiUrl,
      apiKey,
      model: model || 'text-embedding-3-small',
      dimensions: 1536,
      enabled: true,
    } as EmbeddingProviderConfig;

    // Utilise la clé API de l'environnement si non fournie
    if (!testConfig.apiKey) {
      testConfig.apiKey = process.env['OPENAI_API_KEY'] || '';
    }

    const result = await testEmbeddingProvider(testConfig);
    response.json(result);
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * GET /config/llm/defaults — Retourne la configuration par défaut.
 */
export async function getDefaultConfiguration(_request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    response.json(DEFAULT_LLM_CONFIG);
  } catch (error: unknown) {
    next(error);
  }
}
