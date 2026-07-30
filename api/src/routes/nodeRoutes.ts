/// @anchor: Routes pour les nœuds de la toile TTC.

import { Router } from 'express';
import { createNode, listNodes, getNode, verifyNode } from '../controllers/nodeController.js';

const nodeRouter: Router = Router();

// POST /nodes — Créer un nœud
nodeRouter.post('/nodes', createNode);
// GET /nodes — Lister tous les nœuds
nodeRouter.get('/nodes', listNodes);
// GET /nodes/:id — Récupérer un nœud
nodeRouter.get('/nodes/:id', getNode);
// POST /nodes/:id/verify — Vérifier l'ancrage
nodeRouter.post('/nodes/:id/verify', verifyNode);

export { nodeRouter };
