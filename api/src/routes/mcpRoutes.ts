/// @anchor: Routes MCP — Model Context Protocol pour IDE (Cursor/VS Code)

import { Router } from 'express';
import { mcpHandler } from '../controllers/mcpController.js';

const mcpRouter: Router = Router();

// POST /mcp — Endpoint JSON-RPC 2.0 pour Cursor/VS Code
mcpRouter.post('/mcp', mcpHandler);

export { mcpRouter };
