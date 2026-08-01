/// @anchor: Routes pour les projets KontEx — Vibe Coding Wizard

import { Router } from 'express';
import { createProject, listProjects, exportCursorRules } from '../controllers/projectController.js';

const projectRouter: Router = Router();

// POST /projects — Créer un nouveau projet Vibe Coding
projectRouter.post('/projects', createProject);

// GET /projects — Lister tous les projets
projectRouter.get('/projects', listProjects);

// GET /projects/:id/export-rules — Télécharger .cursorrules
projectRouter.get('/projects/:id/export-rules', exportCursorRules);

export { projectRouter };
