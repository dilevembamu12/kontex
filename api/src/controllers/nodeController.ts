/// @anchor: Contrôleur pour les nœuds de la toile TTC.
/// Routes : POST /nodes, GET /nodes, GET /nodes/:id, POST /nodes/:id/verify

import type { Request, Response, NextFunction } from 'express';
import { ttcService } from '../services/ttcService.js';
import { cacheService } from '../services/cacheService.js';
import type { AnchorInput } from '../services/ttcService.js';

/**
 * DELETE /nodes/:id — Supprime un nœud et tous ses liens.
 */
export async function deleteNode(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = request.params;
    const result = await ttcService.deleteNode(id);
    const tenantId = extractTenantId(request);
    cacheService.invalidateResources(tenantId, ['nodes', 'stats', 'links']).catch(() => {});
    response.json({ deleted: result.nodeDeleted, linksRemoved: result.linksDeleted });
  } catch (error: unknown) {
    next(error);
  }
}

/** Extrait le tenant ID du header (cohérent avec cacheMiddleware). */
function extractTenantId(request: Request): string {
  const headerValue = request.headers['x-tenant-id'];
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof raw === 'string' && raw.length > 0) {
    return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default_tenant';
  }
  return 'default_tenant';
}

/**
 * Extrait les mots-clés significatifs d'un texte.
 * Filtre les stop words français/anglais et les tokens courts.
 */
function extractKeywords(text: string): Set<string> {
  const STOP_WORDS = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'à', 'au', 'aux',
    'et', 'ou', 'en', 'sur', 'dans', 'par', 'pour', 'avec', 'sans', 'ce',
    'cette', 'ces', 'est', 'sont', 'être', 'avoir', 'fait', 'faire',
    'the', 'a', 'an', 'is', 'are', 'be', 'to', 'of', 'in', 'for', 'on',
    'with', 'and', 'or', 'it', 'as', 'at', 'by', 'from', 'this', 'that',
    'pas', 'plus', 'très', 'tout', 'tous', 'toute', 'toutes', 'leur',
    'leurs', 'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos',
    'qui', 'que', 'quoi', 'dont', 'où', 'comment', 'quand',
  ]);

  const tokens = text
    .toLowerCase()
    .replace(/[#*_`\[\](){}|\\><~]/g, ' ')  // retire la ponctuation markdown
    .replace(/[.,;:!?]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOP_WORDS.has(t));

  return new Set(tokens);
}

/**
 * Calcule le coefficient de Jaccard entre deux ensembles de mots-clés.
 * Retourne une valeur entre 0 (aucun mot commun) et 1 (identiques).
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

/**
 * POST /nodes — Ajoute un nœud à la toile.
 * @side-effect: modifie le store TTC + invalide le cache nodes et stats.
 */
export async function createNode(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const node = await ttcService.addNode(request.body);
    // Invalide le cache pour ce tenant (en arrière-plan, ne bloque pas la réponse)
    const tenantId = extractTenantId(request);
    cacheService.invalidateResources(tenantId, ['nodes', 'stats']).catch(() => {});
    response.status(201).json(node);
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * GET /nodes — Liste tous les nœuds.
 * Fonction pure (E2) — lecture seule.
 */
export async function listNodes(_request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const nodes = await ttcService.listNodes();
    response.json({ nodes, total: nodes.length });
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * GET /nodes/:id — Récupère un nœud par ID.
 * Fonction pure (E2).
 */
export async function getNode(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const id = request.params['id'] as string | undefined;
    if (!id) {
      response.status(400).json({ error: 'ID requis' });
      return;
    }

    const node = await ttcService.getNode(id);
    if (!node) {
      response.status(404).json({ error: `Nœud ${id} introuvable` });
      return;
    }

    response.json(node);
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * POST /nodes/:id/verify — Vérifie l'ancrage d'un nœud (Principe A).
 * Fonction pure (E2).
 */
export async function verifyNode(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const id = request.params['id'] as string | undefined;
    if (!id) {
      response.status(400).json({ error: 'ID requis' });
      return;
    }

    const verification = await ttcService.verifyAnchoring(id);
    response.json(verification);
  } catch (error: unknown) {
    next(error);
  }
}

// ============================================================
// Import de fichiers Markdown
// ============================================================

/**
 * Parse un contenu markdown en sections ancrables.
 * Chaque titre ## devient un nœud fact/rule/documentation.
 */
function parseMarkdownSections(
  markdown: string,
  _sourceUri: string,
): Array<{ kind: 'fact' | 'rule' | 'documentation'; content: string; section: string }> {
  const sections: Array<{ kind: 'fact' | 'rule' | 'documentation'; content: string; section: string }> = [];
  const lines = markdown.split('\n');

  let currentSection = 'Introduction';
  let currentContent: string[] = [];
  let currentKind: 'fact' | 'rule' | 'documentation' = 'documentation';

  for (const line of lines) {
    // Détecte les titres de section
    if (line.startsWith('## ')) {
      // Sauvegarde la section précédente
      if (currentContent.length > 0) {
        const content = currentContent.join('\n').trim();
        if (content.length > 20) {
          sections.push({ kind: currentKind, content, section: currentSection });
        }
      }
      currentSection = line.replace(/^##\s+/, '').trim();
      currentContent = [];
      // Détermine le type selon le contenu du titre
      const lower = currentSection.toLowerCase();
      if (lower.includes('règle') || lower.includes('rule') || lower.includes('loi')) {
        currentKind = 'rule';
      } else if (lower.includes('code') || lower.includes('implémentation') || lower.includes('api')) {
        currentKind = 'fact';
      } else {
        currentKind = 'documentation';
      }
    } else if (line.startsWith('# ')) {
      currentSection = line.replace(/^#\s+/, '').trim();
      currentContent = [];
      currentKind = 'documentation';
    } else {
      currentContent.push(line);
    }
  }

  // Dernière section
  if (currentContent.length > 0) {
    const content = currentContent.join('\n').trim();
    if (content.length > 20) {
      sections.push({ kind: currentKind, content, section: currentSection });
    }
  }

  return sections;
}

/**
 * POST /nodes/import — Importe un fichier Markdown en nœuds ancrés.
 *
 * Body: { markdown: string, sourceUri?: string, sourceType?: string }
 *
 * Chaque section ## devient un nœud ancré à la source.
 */
export async function importMarkdown(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { markdown, sourceUri, sourceType } = request.body as {
      markdown?: string;
      sourceUri?: string;
      sourceType?: string;
    };

    if (!markdown || markdown.length === 0) {
      response.status(400).json({ error: 'Le champ "markdown" est requis.' });
      return;
    }

    const uri = sourceUri || `file://imported/${Date.now()}.md`;
    const srcType = (sourceType || 'specification') as 'official_documentation' | 'specification' | 'code_repository' | 'peer_review';

    const sections = parseMarkdownSections(markdown, uri);
    if (sections.length === 0) {
      response.status(400).json({ error: 'Aucune section trouvée dans le markdown.' });
      return;
    }

    const created: Array<{ id: string; section: string; kind: string; content: string }> = [];
    const errors: string[] = [];

    for (const section of sections) {
      try {
        const nodeContent = `[${section.section}] ${section.content.slice(0, 2000)}`;
        const node = await ttcService.addNode({
          kind: section.kind,
          content: nodeContent,
          weight: 0.7,
          ambiguity: 0.3,
          anchors: [
            { uri: `${uri}#${encodeURIComponent(section.section)}`, sourceType: srcType as AnchorInput['sourceType'] },
            { uri, sourceType: srcType as AnchorInput['sourceType'] },
          ],
          metadata: { source: uri, section: section.section, importedAt: new Date().toISOString() },
        });
        created.push({ id: node.id, section: section.section, kind: section.kind, content: nodeContent });
      } catch (err) {
        errors.push(`${section.section}: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      }
    }

    // === TISSAGE AUTOMATIQUE ===
    // Crée des liens entre sections similaires via similarité de mots-clés (Jaccard)
    let linksCreated = 0;
    const LINK_THRESHOLD = 0.12; // seuil de similarité Jaccard (12% de mots en commun)
    const MAX_LINKS = 200;       // éviter l'explosion combinatoire

    if (created.length >= 2) {
      const nodeKeywords: Map<string, Set<string>> = new Map();
      for (const n of created) {
        nodeKeywords.set(n.id, extractKeywords(n.content));
      }

      const pairs: Array<{ source: string; target: string; score: number }> = [];
      for (let i = 0; i < created.length; i++) {
        for (let j = i + 1; j < created.length; j++) {
          const ki = nodeKeywords.get(created[i].id)!;
          const kj = nodeKeywords.get(created[j].id)!;
          const sim = jaccardSimilarity(ki, kj);
          if (sim >= LINK_THRESHOLD) {
            pairs.push({ source: created[i].id, target: created[j].id, score: sim });
          }
        }
      }

      // Trier par similarité décroissante et limiter
      pairs.sort((a, b) => b.score - a.score);
      const topPairs = pairs.slice(0, MAX_LINKS);

      for (const pair of topPairs) {
        try {
          await ttcService.addLink({
            sourceId: pair.source,
            targetId: pair.target,
            relation: 'references',
            weight: Math.min(pair.score * 5, 3.0),
            relevanceScore: pair.score,
          });
          linksCreated++;
        } catch {
          // ignore les liens en double ou invalides
        }
      }
    }

    // Invalide le cache
    const tenantId = extractTenantId(request);
    cacheService.invalidateResources(tenantId, ['nodes', 'stats']).catch(() => {});

    response.status(201).json({
      imported: created.length,
      total: sections.length,
      nodes: created.map(n => ({ id: n.id, section: n.section, kind: n.kind })),
      linksCreated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * POST /nodes/weave — Tisse des liens entre tous les nœuds existants
 * via similarité de mots-clés (Jaccard). Utilitaire pour rétro-activement
 * lier les nœuds importés sans tissage initial.
 */
export async function weaveAllNodes(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const allNodes = await ttcService.listNodes();
    if (allNodes.length < 2) {
      response.json({ linksCreated: 0, message: 'Pas assez de nœuds (min. 2 requis).' });
      return;
    }

    // Extraire les mots-clés de chaque nœud
    const nodeKeywords: Map<string, Set<string>> = new Map();
    for (const node of allNodes) {
      nodeKeywords.set(node.id, extractKeywords(node.content));
    }

    const LINK_THRESHOLD = 0.12;
    const MAX_LINKS = 500;

    const pairs: Array<{ source: string; target: string; score: number }> = [];
    const ids = allNodes.map(n => n.id);

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const ki = nodeKeywords.get(ids[i])!;
        const kj = nodeKeywords.get(ids[j])!;
        if (ki.size === 0 || kj.size === 0) continue;
        const sim = jaccardSimilarity(ki, kj);
        if (sim >= LINK_THRESHOLD) {
          pairs.push({ source: ids[i], target: ids[j], score: sim });
        }
      }
    }

    pairs.sort((a, b) => b.score - a.score);
    const topPairs = pairs.slice(0, MAX_LINKS);

    let linksCreated = 0;
    for (const pair of topPairs) {
      try {
        await ttcService.addLink({
          sourceId: pair.source,
          targetId: pair.target,
          relation: 'references',
          weight: Math.min(pair.score * 5, 3.0),
          relevanceScore: pair.score,
        });
        linksCreated++;
      } catch {
        // ignore duplicates
      }
    }

    // Invalide le cache
    const tenantId = extractTenantId(request);
    cacheService.invalidateResources(tenantId, ['nodes', 'stats']).catch(() => {});

    response.json({
      linksCreated,
      totalNodes: allNodes.length,
      threshold: LINK_THRESHOLD,
      message: `${linksCreated} liens créés entre ${allNodes.length} nœuds (seuil Jaccard: ${LINK_THRESHOLD}).`,
    });
  } catch (error: unknown) {
    next(error);
  }
}
