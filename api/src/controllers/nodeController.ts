/// @anchor: Contrôleur pour les nœuds de la toile TTC.
/// Routes : POST /nodes, GET /nodes, GET /nodes/:id, POST /nodes/:id/verify

import type { Request, Response, NextFunction } from 'express';
import { ttcService } from '../services/ttcService.js';
import { cacheService } from '../services/cacheService.js';
import type { AnchorInput } from '../services/ttcService.js';

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

    const created: Array<{ id: string; section: string; kind: string }> = [];
    const errors: string[] = [];

    for (const section of sections) {
      try {
        const node = await ttcService.addNode({
          kind: section.kind,
          content: `[${section.section}] ${section.content.slice(0, 2000)}`,
          weight: 0.7,
          ambiguity: 0.3,
          anchors: [
            { uri: `${uri}#${encodeURIComponent(section.section)}`, sourceType: srcType as AnchorInput['sourceType'] },
            { uri, sourceType: srcType as AnchorInput['sourceType'] },
          ],
          metadata: { source: uri, section: section.section, importedAt: new Date().toISOString() },
        });
        created.push({ id: node.id, section: section.section, kind: section.kind });
      } catch (err) {
        errors.push(`${section.section}: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      }
    }

    // Invalide le cache
    const tenantId = extractTenantId(request);
    cacheService.invalidateResources(tenantId, ['nodes', 'stats']).catch(() => {});

    response.status(201).json({
      imported: created.length,
      total: sections.length,
      nodes: created,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    next(error);
  }
}
