/// @anchor: Express Router — https://expressjs.com/en/5x/api.html#router
/// Routes de diagnostic /health.
/// Principe TTC C2 : respecte l'arborescence api/src/routes/ définie dans le milestone.

import { Router } from 'express';
import { getHealth } from '../controllers/healthController.js';

const healthRouter: Router = Router();

// GET /health — Diagnostic de l'API et de ses dépendances
healthRouter.get('/health', getHealth);

export { healthRouter };
