/// @anchor: Express — https://expressjs.com/en/5x/api.html
/// @anchor: PROJECT_CONTEXT.md §3.1 — API Gateway TypeScript
/// Point d'entrée principal de l'API KontEx.
/// Principe TTC E3 : gestion d'erreur explicite au démarrage.
/// Principe TTC C2 : respecte l'arborescence api/src/.

import express, { type Express } from 'express';
import cors from 'cors';
import { environment } from './config/environment.js';
import {
  requestLogger,
  globalErrorHandler,
  apiKeyAuth,
  rateLimiter,
} from './middlewares/index.js';
import { healthRouter, nodeRouter, ttcRouter, configRouter } from './routes/index.js';
import { initEmbeddingGenerator } from './services/embeddingService.js';

/**
 * Construit et configure l'application Express.
 * Fonction pure (E2) — pas d'effet de bord autre que la création d'objets.
 */
function buildExpressApplication(): Express {
  const application: Express = express();

  // --- Middlewares globaux (ordre important) ---

  // CORS — permissif en développement, restrictif en production
  const corsOrigin = environment.NODE_ENV === 'production'
    ? environment.CORS_ORIGIN
    : '*';
  application.use(cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Tenant-Id'],
    exposedHeaders: ['X-KontEx-Cache', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: false,
  }));

  // Parsing JSON — limite de taille pour sécurité
  application.use(express.json({ limit: '1mb' }));

  // Logging HTTP structuré
  application.use(requestLogger);

  // Authentification B2B2B par clé API
  application.use(apiKeyAuth);

  // Rate limiting global (100 req/min par client)
  application.use(rateLimiter({ maxRequests: 100, windowSeconds: 60, label: 'global' }));

  // --- Routes ---

  // Route de diagnostic /health
  application.use(healthRouter);

  // Routes TTC — CRUD nœuds, liens, détection
  application.use(nodeRouter);
  application.use(ttcRouter);

  // Routes de configuration
  application.use(configRouter);

  // --- Middleware d'erreur (toujours en dernier) ---
  application.use(globalErrorHandler);

  return application;
}

/**
 * Démarre le serveur HTTP.
 * @side-effect: écoute sur le port configuré et log le démarrage.
 */
async function startServer(): Promise<void> {
  const application = buildExpressApplication();

  const { PORT, NODE_ENV, LOG_LEVEL } = environment;

  // Vérification que le port est disponible
  try {
    application.listen(PORT, () => {
      console.log(
        `[KontEx::API] Démarrage réussi — http://localhost:${PORT} — env: ${NODE_ENV} — log: ${LOG_LEVEL}`,
      );
      console.log(`[KontEx::API] GET /health → http://localhost:${PORT}/health`);

      // Initialise le générateur d'embedding depuis la config LLM
      initEmbeddingGenerator().catch((err: unknown) => {
        console.warn('[KontEx::API] Échec init embedding generator:', err);
      });
    });
  } catch (error: unknown) {
    console.error('[KontEx::API] Échec du démarrage du serveur', error);
    process.exit(1);
  }
}

// Démarrage
startServer().catch((error: unknown) => {
  console.error('[KontEx::API] Erreur fatale au démarrage', error);
  process.exit(1);
});
