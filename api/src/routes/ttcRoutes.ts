/// @anchor: Routes pour les liens et la détection TTC.

import { Router } from 'express';
import { createLink, listLinks } from '../controllers/linkController.js';
import { detectHallucination, propagateContext, getStats } from '../controllers/detectController.js';
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

// GET /stats — Statistiques globales (cache 120s, invalidation sur mutation)
ttcRouter.get('/stats', cacheMiddleware({ resource: 'stats', ttlSeconds: 120 }), getStats);

export { ttcRouter };
