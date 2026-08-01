/// @anchor: Routes pour les liens et la détection TTC.

import { Router } from 'express';
import { createLink, listLinks } from '../controllers/linkController.js';
import { detectHallucination, propagateContext, getStats, getLagrangian, runBenchmark } from '../controllers/detectController.js';
import { cacheMiddleware } from '../middlewares/cacheMiddleware.js';

const ttcRouter: Router = Router();

// POST /links — Créer un lien (pas de cache, invalidation dans le contrôleur)
ttcRouter.post('/links', createLink);

// GET /links — Lister tous les liens (cache 300s)
ttcRouter.get('/links', cacheMiddleware({ resource: 'links', ttlSeconds: 300 }), listLinks);

// POST /detect — Détecter une hallucination (lecture seule, pas de cache)
ttcRouter.post('/detect', detectHallucination);

// POST /propagate — Propager le contexte (lecture seule, pas de cache)
ttcRouter.post('/propagate', propagateContext);

// GET /stats — Statistiques globales (cache 120s)
ttcRouter.get('/stats', cacheMiddleware({ resource: 'stats', ttlSeconds: 120 }), getStats);

// GET /ttc/lagrangian — Lagrangien MCW-2 (pas de cache, calcul physique)
ttcRouter.get('/ttc/lagrangian', getLagrangian);

// GET /benchmark — Exécute le benchmark TTC 10 paires (pas de cache)
ttcRouter.get('/benchmark', runBenchmark);

export { ttcRouter };
