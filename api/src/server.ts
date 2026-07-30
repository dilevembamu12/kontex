/// @anchor: Express — https://expressjs.com/en/5x/api.html
/// @anchor: PROJECT_CONTEXT.md §3.1 — API Gateway TypeScript
/// Point d'entrée principal de l'API KontEx.
/// Principe TTC E3 : gestion d'erreur explicite au démarrage.
/// Principe TTC C2 : respecte l'arborescence api/src/.

import express, { type Express } from 'express';
import cors from 'cors';
import { environment } from './config/environment.js';
import { requestLogger, globalErrorHandler } from './middlewares/index.js';
import { healthRouter } from './routes/index.js';

/**
 * Construit et configure l'application Express.
 * Fonction pure (E2) — pas d'effet de bord autre que la création d'objets.
 */
function buildExpressApplication(): Express {
  const application: Express = express();

  // --- Middlewares globaux (ordre important) ---

  // CORS — configuré depuis les variables d'environnement
  application.use(cors({
    origin: environment.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }));

  // Parsing JSON — limite de taille pour sécurité
  application.use(express.json({ limit: '1mb' }));

  // Logging HTTP structuré
  application.use(requestLogger);

  // --- Routes ---

  // Route de diagnostic /health
  application.use(healthRouter);

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
