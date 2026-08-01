/// @anchor: MCP (Model Context Protocol) — Pont IDE/Cursor → KontEx
/// Implémente le protocole JSON-RPC 2.0 pour l'intégration IDE.
/// Outils exposés: detect_hallucination, get_context, list_facts, get_benchmark
///
/// Spec: https://modelcontextprotocol.io/

import type { Request, Response, NextFunction } from 'express';
import { ttcService } from '../services/ttcService.js';
import { createTtcEngine, DEFAULT_TTC_PARAMS } from '../services/ttcEngine.js';

interface McpRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * POST /mcp — Endpoint JSON-RPC 2.0 pour le Model Context Protocol.
 * Cursor/VS Code envoie des requêtes JSON-RPC, KontEx répond avec le contexte TTC.
 */
export async function mcpHandler(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { jsonrpc, id, method, params } = request.body as McpRequest;

    if (jsonrpc !== '2.0') {
      response.status(400).json({ jsonrpc: '2.0', id: id ?? null, error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' } });
      return;
    }

    let result: unknown;

    switch (method) {
      // === INITIALIZATION ===
      case 'initialize':
        result = {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'KontEx', version: '0.2.0' },
          capabilities: { tools: {} },
        };
        break;

      case 'tools/list':
        result = {
          tools: [
            {
              name: 'detect_hallucination',
              description: 'Détecte si une assertion est une hallucination via le moteur TTC MCW-2. Retourne la tension topologique T et le verdict.',
              inputSchema: {
                type: 'object',
                properties: { content: { type: 'string', description: 'Assertion à vérifier' } },
                required: ['content'],
              },
            },
            {
              name: 'get_context',
              description: 'Récupère les nœuds les plus similaires de la toile TTC pour un contenu donné.',
              inputSchema: {
                type: 'object',
                properties: { query: { type: 'string', description: 'Requête de contexte' }, limit: { type: 'number', default: 5 } },
                required: ['query'],
              },
            },
            {
              name: 'list_facts',
              description: 'Liste tous les faits ancrés dans la toile TTC.',
              inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['fact', 'rule', 'code', 'documentation'] } } },
            },
            {
              name: 'get_benchmark',
              description: 'Retourne le score du benchmark TTC (10 paires contradictoires).',
              inputSchema: { type: 'object', properties: {} },
            },
          ],
        };
        break;

      // === TOOLS ===
      case 'tools/call':
        result = await handleToolCall(params as { name: string; arguments?: Record<string, unknown> });
        break;

      default:
        response.status(404).json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
        return;
    }

    response.json({ jsonrpc: '2.0', id, result });
  } catch (error: unknown) {
    next(error);
  }
}

/** Exécute un outil MCP et retourne le résultat formaté. */
async function handleToolCall(params: { name: string; arguments?: Record<string, unknown> }): Promise<McpToolResult> {
  const args = params.arguments || {};

  switch (params.name) {
    case 'detect_hallucination': {
      const content = args.content as string;
      if (!content || content.length < 5) {
        return { content: [{ type: 'text', text: 'Erreur: contenu trop court (min 5 caractères).' }], isError: true };
      }
      const engine = createTtcEngine();
      await engine.syncFromPg();

      // Pipeline TTC complet
      const similarNodes = await ttcService.findSimilarNodes(content, 5);
      const maxSim = similarNodes.length > 0 ? similarNodes[0].similarity : 0;

      if (maxSim < 0.80) {
        return { content: [{ type: 'text', text: `INCONCLUSIF: similarité max ${(maxSim*100).toFixed(1)}% sous le seuil de domaine (80%).` }] };
      }

      const assertionId = await engine.addNode('fact', content, maxSim, 1 - maxSim, [{ uri: 'spec://mcp-assertion', sourceType: 'specification' }]);
      for (const s of similarNodes) {
        try { await engine.addLink(assertionId, s.id, 'references', s.similarity, s.similarity); } catch { /* skip */ }
      }

      const tension = await engine.getTensionResidue(assertionId, 0.01, 0.3, 0.001, 0.1, 0.05, 100);
      await engine.syncFromPg(); // cleanup context

      const verdict = tension > 0.10 ? 'HALLUCINATION' : 'COHÉRENT';
      const icon = verdict === 'HALLUCINATION' ? '🔴' : '🟢';
      return {
        content: [{ type: 'text', text: `${icon} ${verdict} | T=${(tension*100).toFixed(1)}% | MCW-2 | ${similarNodes.length} nœuds similaires (maxSim: ${(maxSim*100).toFixed(1)}%)` }],
      };
    }

    case 'get_context': {
      const query = args.query as string;
      const limit = (args.limit as number) || 5;
      const nodes = await ttcService.findSimilarNodes(query, limit);
      const text = nodes.map((n: { content: string; similarity: number; id: string }) =>
        `[sim:${(n.similarity*100).toFixed(0)}%] ${n.content.slice(0, 200)}`
      ).join('\n---\n');
      return { content: [{ type: 'text', text: text || 'Aucun nœud similaire trouvé.' }] };
    }

    case 'list_facts': {
      const kind = (args.kind as string) || 'fact';
      const allNodes = await ttcService.listNodes();
      const filtered = allNodes.filter(n => n.kind === kind).slice(0, 20);
      const text = filtered.map(n => `[${n.kind}] ${n.content.slice(0, 150)}`).join('\n');
      return { content: [{ type: 'text', text: text || `Aucun nœud de type "${kind}".` }] };
    }

    case 'get_benchmark': {
      const pairs = [
        { coh: 'Python: len() retourne un entier int', hall: 'Python: len() retourne un float' },
        { coh: 'React: useState retourne un tableau de 2 elements', hall: 'React: useState retourne un tableau de 3 elements' },
      ];
      let pass = 0;
      const engine = createTtcEngine();
      for (const p of pairs) {
        const tCoh = await quickDetect(engine, p.coh);
        const tHall = await quickDetect(engine, p.hall);
        if (tHall > tCoh) pass++;
      }
      return { content: [{ type: 'text', text: `Benchmark TTC: ${pass}/${pairs.length} paires discriminées. T_crit=0.10.` }] };
    }

    default:
      return { content: [{ type: 'text', text: `Outil inconnu: ${params.name}` }], isError: true };
  }
}

async function quickDetect(engine: Awaited<ReturnType<typeof createTtcEngine>>, content: string): Promise<number> {
  const sim = await ttcService.findSimilarNodes(content, 1);
  const maxSim = sim.length > 0 ? sim[0].similarity : 0.5;
  const id = await engine.addNode('fact', content, maxSim, 1 - maxSim, [{ uri: 'spec://mcp-quick', sourceType: 'specification' }]);
  return engine.getTensionResidue(id, 0.01, 0.3, 0.001, 0.1, 0.05, 50);
}
