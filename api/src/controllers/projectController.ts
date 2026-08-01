/// @anchor: Contrôleur de projets — Création, ingestion, export .cursorrules
/// Endpoints: POST /projects, GET /projects, GET /projects/:id/export-rules

import type { Request, Response, NextFunction } from 'express';
import { ttcService } from '../services/ttcService.js';
import { cacheService } from '../services/cacheService.js';
import { parseSourceFile, type ParsedFile } from '../services/codeParser.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

interface ProjectInput {
  name: string;
  tenantId: string;
  stack: { back: string; front: string };
  antiPatterns: string[];
  repoUrl?: string;
}

/**
 * POST /projects — Crée un nouveau projet KontEx.
 * Génère les nœuds TTC, les règles d'ancrage, et le bouclier anti-hallucination.
 */
export async function createProject(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { name, tenantId, stack, antiPatterns, repoUrl } = request.body as ProjectInput;

    if (!name || name.trim().length === 0) {
      response.status(400).json({ error: 'Le nom du projet est requis.' });
      return;
    }

    const projectId = `proj_${Date.now().toString(36)}`;
    let nodesCreated = 0;
    let linksCreated = 0;
    const createdIds: string[] = [];

    // 1. Nœud racine du projet
    const rootNode = await ttcService.addNode({
      kind: 'fact',
      content: `[Projet: ${name}] Stack: ${stack.back} + ${stack.front}. Tenant: ${tenantId || 'default'}.`,
      weight: 1.0,
      ambiguity: 0.01,
      anchors: [{ uri: `spec://project/${projectId}`, sourceType: 'specification' as const }],
      metadata: { projectId, tenantId: tenantId || 'default', stackBack: stack.back, stackFront: stack.front },
    });
    createdIds.push(rootNode.id);
    nodesCreated++;

    // 2. Règles du bouclier anti-hallucination
    for (const pattern of antiPatterns) {
      if (pattern.trim().length < 10) continue;
      const ruleNode = await ttcService.addNode({
        kind: 'rule',
        content: `[Regle Anti-Hallucination — ${name}] ${pattern.trim()}`,
        weight: 0.99,
        ambiguity: 0.01,
        anchors: [{ uri: `spec://project/${projectId}/rules`, sourceType: 'specification' as const }],
        metadata: { projectId, type: 'anti-hallucination' },
      });
      createdIds.push(ruleNode.id);
      nodesCreated++;

      // Lier la règle au nœud racine
      await ttcService.addLink({
        sourceId: ruleNode.id,
        targetId: rootNode.id,
        relation: 'refines',
        weight: 0.9,
        relevanceScore: 0.9,
      });
      linksCreated++;
    }

    // 3. Faits de stack technique
    const stackFacts: Record<string, string[]> = {
      laravel: [
        'Laravel: les FormRequests valident les donnees avant d atteindre le controleur.',
        'Laravel: Eloquent est l ORM officiel. Toujours utiliser les Model Eloquent.',
        'Laravel: les migrations definissent le schema de la base de donnees.',
        'Laravel: les routes sont definies dans routes/web.php et routes/api.php.',
      ],
      node: [
        'Express: les middlewares interceptent les requetes avant les controleurs.',
        'Express: toujours utiliser ApiResponse pour wrapper les reponses.',
        'Node.js: les modules sont importes via require() ou import.',
      ],
      react: [
        'React: useState retourne exactement [state, setState].',
        'React: les composants doivent etre des fonctions pures.',
        'React: utiliser le App Router de Next.js pour le routage.',
      ],
      vue: [
        'Vue.js: les composants utilisent la Composition API.',
        'Vue.js: le routage est gere par vue-router.',
      ],
    };

    const backFacts = stackFacts[stack.back] || [];
    const frontFacts = stackFacts[stack.front] || [];

    for (const fact of [...backFacts, ...frontFacts]) {
      const factNode = await ttcService.addNode({
        kind: 'fact',
        content: `[${stack.back}/${stack.front}] ${fact}`,
        weight: 0.95,
        ambiguity: 0.05,
        anchors: [{ uri: `spec://stack/${stack.back}+${stack.front}`, sourceType: 'official_documentation' as const }],
        metadata: { projectId, type: 'stack-fact' },
      });
      createdIds.push(factNode.id);
      nodesCreated++;

      await ttcService.addLink({
        sourceId: factNode.id,
        targetId: rootNode.id,
        relation: 'exemplifies',
        weight: 0.7,
        relevanceScore: 0.7,
      });
      linksCreated++;
    }

    // 4. Ingestion GitHub (si fourni)
    let gitCloneStatus: string | null = null;
    if (repoUrl && repoUrl.startsWith('http')) {
      try {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kontex-'));
        execSync(`git clone --depth 1 "${repoUrl}" "${tmpDir}"`, { timeout: 30000 });
        const files = getAllFiles(tmpDir, ['.git', 'node_modules', 'vendor', '.env']);
        const relevantFiles = files.filter(f =>
          /\.(php|js|ts|jsx|tsx|vue|css|html|json|md|yml|yaml|env\.example)$/i.test(f) && !f.includes('lock')
        );

        // Créer un nœud par fichier pertinent (limité à 50)
        for (const file of relevantFiles.slice(0, 50)) {
          try {
            const rawContent = fs.readFileSync(file, 'utf-8');
            const relPath = path.relative(tmpDir, file);
            const parsed = parseSourceFile(relPath, rawContent);

            // Construire un résumé intelligent du fichier
            const summary = buildFileSummary(parsed);
            if (!summary) continue;

            const fileNode = await ttcService.addNode({
              kind: 'code',
              content: `[Fichier: ${relPath}] ${summary}`,
              weight: 0.7,
              ambiguity: 0.3,
              anchors: [{ uri: `file://${repoUrl}/${relPath}`, sourceType: 'code_repository' as const }],
              metadata: { projectId, repoUrl, filePath: relPath, type: 'ingested-file', language: parsed.language },
            });
            createdIds.push(fileNode.id);
            nodesCreated++;

            await ttcService.addLink({
              sourceId: fileNode.id,
              targetId: rootNode.id,
              relation: 'references',
              weight: 0.5,
              relevanceScore: 0.5,
            });
            linksCreated++;

            // Créer des nœuds pour les classes et fonctions importantes
            for (const cls of parsed.classes) {
              const clsNode = await ttcService.addNode({
                kind: 'code',
                content: `[Classe: ${cls.name}] ${relPath}${cls.extends ? ` extends ${cls.extends}` : ''}. Méthodes: ${cls.methods.slice(0, 5).join(', ')}.`,
                weight: 0.8,
                ambiguity: 0.2,
                anchors: [{ uri: `file://${repoUrl}/${relPath}#class-${cls.name}`, sourceType: 'code_repository' as const }],
                metadata: { projectId, filePath: relPath, className: cls.name, type: 'class' },
              });
              createdIds.push(clsNode.id); nodesCreated++;
              await ttcService.addLink({ sourceId: clsNode.id, targetId: fileNode.id, relation: 'refines', weight: 0.8, relevanceScore: 0.8 });
              linksCreated++;
            }

            for (const func of parsed.functions.slice(0, 10)) {
              if (func.name.length < 3) continue;
              const funcNode = await ttcService.addNode({
                kind: 'code',
                content: `[Fonction: ${func.name}] ${relPath}. ${func.exported ? 'Exportée.' : ''} ${func.async ? 'Async.' : ''}`,
                weight: 0.7,
                ambiguity: 0.3,
                anchors: [{ uri: `file://${repoUrl}/${relPath}#func-${func.name}`, sourceType: 'code_repository' as const }],
                metadata: { projectId, filePath: relPath, functionName: func.name, type: 'function' },
              });
              createdIds.push(funcNode.id); nodesCreated++;
              await ttcService.addLink({ sourceId: funcNode.id, targetId: fileNode.id, relation: 'refines', weight: 0.6, relevanceScore: 0.6 });
              linksCreated++;
            }

            // Créer des nœuds pour les modèles Laravel
            for (const model of parsed.models) {
              const relText = model.relationships.map(r => `${r.type}→${r.target}`).join(', ');
              const modelNode = await ttcService.addNode({
                kind: 'code',
                content: `[Modèle Eloquent: ${model.name}] Table: ${model.table || '?'}. Relations: ${relText || 'aucune'}. Fillable: ${model.fillable.slice(0, 5).join(', ')}.`,
                weight: 0.85,
                ambiguity: 0.15,
                anchors: [{ uri: `file://${repoUrl}/${relPath}#model-${model.name}`, sourceType: 'code_repository' as const }],
                metadata: { projectId, filePath: relPath, modelName: model.name, type: 'eloquent-model' },
              });
              createdIds.push(modelNode.id); nodesCreated++;
              await ttcService.addLink({ sourceId: modelNode.id, targetId: fileNode.id, relation: 'refines', weight: 0.9, relevanceScore: 0.9 });
              linksCreated++;
            }

            // Créer des nœuds pour les routes Laravel
            for (const route of parsed.routes.slice(0, 20)) {
              const routeNode = await ttcService.addNode({
                kind: 'code',
                content: `[Route: ${route.method} ${route.path}] → ${route.handler}`,
                weight: 0.75,
                ambiguity: 0.25,
                anchors: [{ uri: `file://${repoUrl}/${relPath}#route`, sourceType: 'code_repository' as const }],
                metadata: { projectId, filePath: relPath, routeMethod: route.method, routePath: route.path, type: 'route' },
              });
              createdIds.push(routeNode.id); nodesCreated++;
              await ttcService.addLink({ sourceId: routeNode.id, targetId: fileNode.id, relation: 'refines', weight: 0.7, relevanceScore: 0.7 });
              linksCreated++;
            }
          } catch { /* skip unreadable files */ }
        }
        fs.rmSync(tmpDir, { recursive: true, force: true });
        gitCloneStatus = `${relevantFiles.length} fichiers analyses, ${Math.min(relevantFiles.length, 50)} nœuds crees`;
      } catch (e) {
        gitCloneStatus = `Echec clonage: ${e instanceof Error ? e.message : 'inconnu'}`;
      }
    }

    // 5. Tissage automatique des nouveaux nœuds
    try {
      await ttcService.weaveAllNodes?.();
    } catch { /* weave peut ne pas exister ou echouer */ }

    // Invalide le cache
    cacheService.invalidateResources(tenantId || 'default', ['nodes', 'stats', 'projects']).catch(() => {});

    response.status(201).json({
      projectId,
      name,
      tenantId: tenantId || 'default',
      nodesCreated,
      linksCreated,
      gitCloneStatus,
      stack: { back: stack.back, front: stack.front },
      antiPatternsCount: antiPatterns.length,
      nodeIds: createdIds.slice(0, 10),
      message: `Projet "${name}" créé avec ${nodesCreated} nœuds et ${linksCreated} liens. La toile TTC est prête.`,
    });
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * GET /projects — Liste tous les projets.
 */
export async function listProjects(_request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const allNodes = await ttcService.listNodes();
    const projects = allNodes
      .filter(n => n.metadata?.projectId)
      .reduce((acc: Map<string, { id: string; name: string; nodes: number }>, n) => {
        const pid = n.metadata!.projectId!;
        if (!acc.has(pid)) {
          acc.set(pid, { id: pid, name: n.content.replace(/^\[Projet:\s*/, '').replace(/\].*/, ''), nodes: 0 });
        }
        acc.get(pid)!.nodes++;
        return acc;
      }, new Map());
    response.json({ projects: [...projects.values()], total: projects.size });
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * GET /projects/:id/export-rules — Génère et télécharge le fichier .cursorrules.
 */
export async function exportCursorRules(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = request.params;
    const allNodes = await ttcService.listNodes();
    const projectNodes = allNodes.filter(n => n.metadata?.projectId === id);

    if (projectNodes.length === 0) {
      response.status(404).json({ error: 'Projet non trouvé.' });
      return;
    }

    const rootNode = projectNodes.find(n => n.kind === 'fact' && n.content.startsWith('[Projet:'));
    const ruleNodes = projectNodes.filter(n => n.kind === 'rule');
    const factNodes = projectNodes.filter(n => n.kind === 'fact' && !n.content.startsWith('[Projet:'));

    const projectName = rootNode?.content.replace(/^\[Projet:\s*/, '').replace(/\].*/, '') || 'Mon Projet';
    const tenantId = rootNode?.metadata?.tenantId || 'default';

    const rules = [
      `# KontEx .cursorrules — Genere le ${new Date().toISOString().split('T')[0]}`,
      `# Projet: ${projectName}`,
      `# Tenant: ${tenantId}`,
      `# Moteur: TTC v1.1 / MCW-2`,
      '',
      '# === Bouclier Anti-Hallucination ===',
      ...ruleNodes.map(r => `# ${r.content.replace(/^\[Regle Anti-Hallucination[^\]]*\]\s*/, '')}`),
      '',
      '# === Faits Ancrés ===',
      ...factNodes.map(f => `# ${f.content.replace(/^\[[^\]]*\]\s*/, '').slice(0, 120)}`),
      '',
      '# === Instructions Cursor ===',
      '# 1. Avant de generer du code, verifier la similarite avec la toile TTC',
      '# 2. Si T > 0.10, NE PAS generer — demander clarification',
      '# 3. Toujours ancrer le code genere dans une source documentaire',
      '# 4. Endpoint MCP: http://localhost:3001/detect',
    ].join('\n');

    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename=".cursorrules"`);
    response.send(rules);
  } catch (error: unknown) {
    next(error);
  }
}

/** Construit un résumé intelligent d'un fichier parsé. */
function buildFileSummary(parsed: ParsedFile): string {
  const parts: string[] = [];
  if (parsed.classes.length > 0) parts.push(`${parsed.classes.length} classe(s): ${parsed.classes.map(c => c.name).join(', ')}`);
  if (parsed.functions.length > 0) parts.push(`${parsed.functions.length} fonction(s): ${parsed.functions.slice(0, 5).map(f => f.name).join(', ')}`);
  if (parsed.models.length > 0) parts.push(`Modèle(s): ${parsed.models.map(m => m.name).join(', ')}`);
  if (parsed.routes.length > 0) parts.push(`${parsed.routes.length} route(s)`);
  if (parsed.imports.length > 0) parts.push(`${parsed.imports.length} dépendance(s)`);
  return parts.length > 0 ? parts.join(' | ') : `${parsed.language}: ${parsed.path}`;
}

/** Récupère récursivement tous les fichiers d'un dossier. */
function getAllFiles(dir: string, exclude: string[]): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (exclude.some(e => entry.name === e || entry.name.startsWith('.'))) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...getAllFiles(full, exclude));
      } else {
        results.push(full);
      }
    }
  } catch { /* permission errors */ }
  return results;
}
