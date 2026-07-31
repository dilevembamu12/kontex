/// @anchor: Routes pour les nœuds de la toile TTC.

import { Router } from 'express';
import { createNode, listNodes, getNode, verifyNode, importMarkdown } from '../controllers/nodeController.js';
import { cacheMiddleware } from '../middlewares/cacheMiddleware.js';

const nodeRouter: Router = Router();

// POST /nodes — Créer un nœud (pas de cache, invalidation dans le contrôleur)
nodeRouter.post('/nodes', createNode);

// POST /nodes/import — Importer un fichier Markdown en nœuds ancrés
nodeRouter.post('/nodes/import', importMarkdown);

// GET /nodes — Lister tous les nœuds (cache 300s)
nodeRouter.get('/nodes', cacheMiddleware({ resource: 'nodes', ttlSeconds: 300 }), listNodes);

// GET /nodes/:id — Récupérer un nœud (cache 300s)
nodeRouter.get('/nodes/:id', cacheMiddleware({ resource: 'nodes', ttlSeconds: 300 }), getNode);

// POST /nodes/:id/verify — Vérifier l'ancrage (pas de cache, lecture seule)
nodeRouter.post('/nodes/:id/verify', verifyNode);

export { nodeRouter };
