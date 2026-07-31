/// @anchor: Routes de configuration des LLMs

import { Router } from 'express';
import {
  getLlmConfiguration,
  updateLlmConfiguration,
  testLlmConnection,
  getDefaultConfiguration,
} from '../controllers/configController.js';

const configRouter: Router = Router();

// GET /config/llm — Configuration actuelle
configRouter.get('/config/llm', getLlmConfiguration);

// PUT /config/llm — Mettre à jour la configuration
configRouter.put('/config/llm', updateLlmConfiguration);

// POST /config/llm/test — Tester la connexion
configRouter.post('/config/llm/test', testLlmConnection);

// GET /config/llm/defaults — Valeurs par défaut
configRouter.get('/config/llm/defaults', getDefaultConfiguration);

export { configRouter };
