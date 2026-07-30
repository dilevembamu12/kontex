/// @anchor: Routes pour les liens et la détection TTC.

import { Router } from 'express';
import { createLink, listLinks } from '../controllers/linkController.js';
import { detectHallucination, propagateContext, getStats } from '../controllers/detectController.js';

const ttcRouter: Router = Router();

// POST /links — Créer un lien
ttcRouter.post('/links', createLink);
// GET /links — Lister tous les liens
ttcRouter.get('/links', listLinks);

// POST /detect — Détecter une hallucination
ttcRouter.post('/detect', detectHallucination);
// POST /propagate — Propager le contexte
ttcRouter.post('/propagate', propagateContext);
// GET /stats — Statistiques globales de la toile
ttcRouter.get('/stats', getStats);

export { ttcRouter };
