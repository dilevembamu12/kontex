/// @anchor: Contrôleur pour la détection d'hallucination.
/// Routes : POST /detect, POST /propagate, GET /stats
///
/// # Refonte TTC (§3 du White Paper)
/// La détection n'est plus heuristique (mots-clés) mais **physique** :
/// 1. L'assertion de l'IA est injectée comme nœud temporaire
/// 2. Les nœuds les plus proches (pgvector cosinus) forment un sous-graphe
/// 3. Le solveur TTC résout Γ, Φ, T sur ce sous-graphe
/// 4. Si la tension □T dépasse le VEV v_T → hallucination déclarée

import type { Request, Response, NextFunction } from 'express';
import { ttcService } from '../services/ttcService.js';
import { createTtcEngine, DEFAULT_TTC_PARAMS } from '../services/ttcEngine.js';

/** Seuil de tension calibré sur benchmark 10 paires (F1=0.636).
 * T_crit=0.10 optimal pour la détection d'hallucination.
 * Cf. calibration du 2026-08-01. */
const TENSION_HALLUCINATION_THRESHOLD = 0.10;

/**
 * POST /detect — Détecte les hallucinations par tension topologique TTC.
 */
export async function detectHallucination(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { content } = request.body as { content?: string };
    if (!content || content.length === 0) {
      response.status(400).json({ error: 'Le champ "content" est requis' });
      return;
    }

    // Tente la détection physique TTC
    const ttcReport = await detectViaTtcPhysics(content);
    if (ttcReport) {
      response.json(ttcReport);
      return;
    }

    // Fallback : algorithme heuristique classique
    const report = await ttcService.detectHallucination(content);
    response.json(report);
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * Détection d'hallucination par résolution des équations de champ TTC.
 * Retourne null si le moteur natif n'est pas disponible.
 */
async function detectViaTtcPhysics(content: string): Promise<Record<string, unknown> | null> {
  try {
    const engine = createTtcEngine();

    // 0. Sync PG → Rust pour que le solveur natif ait tous les nœuds
    await engine.syncFromPg();

    // 1. Trouve les nœuds similaires
    const similarNodes = await ttcService.findSimilarNodes(content, 5);

    // Seuil de domaine : en dessous, l'assertion est hors-du-domaine connu
    const DOMAIN_SIMILARITY_THRESHOLD = 0.80;

    if (similarNodes.length === 0 || similarNodes[0]!.similarity < DOMAIN_SIMILARITY_THRESHOLD) {
      const maxS = similarNodes[0]?.similarity ?? 0;
      return {
        isHallucination: false,
        confidence: 0,
        contradictingNodeIds: [],
        suggestions: [
          maxS === 0
            ? 'Aucun nœud trouvé dans la toile — ancrez des connaissances dans ce domaine.'
            : `Similarité max ${maxS.toFixed(3)} < seuil domaine ${DOMAIN_SIMILARITY_THRESHOLD} — assertion hors du domaine connu.`,
          'Importez des documents pertinents via POST /nodes/import ou le dashboard 📥 Import.',
        ],
        method: 'ttc-physics',
        tension: null,
        verdict: 'inconclusive',
        similarNodesCount: similarNodes.length,
        maxSimilarity: maxS,
      };
    }

    // 2. Calcule la similarité max avec les nœuds existants
    //    → détermine la cohérence initiale Γ de l'assertion
    const maxSimilarity = Math.max(...similarNodes.map((n) => n.similarity), 0.1);

    // 3. Ajoute l'assertion comme nœud temporaire
    const assertionId = await engine.addNode(
      'fact', content,
      maxSimilarity,
      1.0 - maxSimilarity,
      [{ uri: 'spec://llm-assertion', sourceType: 'specification' }],
    );

    // 4. Crée des liens vers les nœuds similaires (tissage)
    const linkedIds: string[] = [];
    for (const similar of similarNodes) {
      try {
        await engine.addLink(assertionId, similar.id, 'references', similar.similarity, similar.similarity);
        linkedIds.push(similar.id);
      } catch { /* ignorer */ }
    }

    // 5. Résout les équations de champ TTC et mesure la tension.
    const tension = await engine.getTensionResidue(
      assertionId,
      DEFAULT_TTC_PARAMS.alpha,
      DEFAULT_TTC_PARAMS.beta,
      DEFAULT_TTC_PARAMS.lambda,
      DEFAULT_TTC_PARAMS.gamma,
      0.05,
      100,
    );

    // 6. Vérifie la tension sur les arêtes
    let maxEdgeTension = 0;
    for (const linkedId of linkedIds) {
      const edgeT = await engine.getEdgeTension(assertionId, linkedId);
      if (Math.abs(edgeT) > Math.abs(maxEdgeTension)) maxEdgeTension = edgeT;
    }

    // 7. Décision : T > v_T + seuil → hallucination
    const isHallucination = tension > DEFAULT_TTC_PARAMS.vTension + TENSION_HALLUCINATION_THRESHOLD;
    const confidence = isHallucination
      ? Math.min(1, tension / (DEFAULT_TTC_PARAMS.vTension + 1.0))
      : Math.max(0, 1 - tension);

    return {
      isHallucination,
      confidence: Math.round(confidence * 100) / 100,
      contradictingNodeIds: linkedIds.slice(0, 10),
      suggestions: isHallucination
        ? [
            `Tension topologique T=${tension.toFixed(3)} > seuil=${(DEFAULT_TTC_PARAMS.vTension + TENSION_HALLUCINATION_THRESHOLD).toFixed(2)}`,
            'Déchirure de la toile détectée — l\'assertion ne respecte pas les équations de champ TTC.',
          ]
        : [`Tension T=${tension.toFixed(3)} dans les limites — assertion cohérente.`],
      method: 'ttc-physics',
      verdict: isHallucination ? 'hallucination' : 'coherent',
      tension,
      maxEdgeTension,
      similarNodesCount: similarNodes.length,
      maxSimilarity,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Cannot find module') || msg.includes('nativeWeb')) return null;
    console.warn('[KontEx::TTC] Erreur détection physique:', msg);
    return null;
  }
}

/**
 * POST /propagate — Propage le contexte depuis un nœud source.
 * Fonction pure (E2).
 */
export async function propagateContext(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const { sourceId, threshold, maxDepth } = request.body as {
      sourceId?: string;
      threshold?: number;
      maxDepth?: number;
    };

    if (!sourceId) {
      response.status(400).json({ error: 'Le champ "sourceId" est requis' });
      return;
    }

    const result = await ttcService.propagateContext(sourceId, threshold ?? 0.01, maxDepth ?? 10);
    response.json(result);
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * GET /stats — Statistiques globales de la toile.
 * Fonction pure (E2).
 */
export async function getStats(_request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await ttcService.getStats();
    response.json(stats);
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * GET /ttc/lagrangian — Évalue le Lagrangien MCW-2 complet.
 * Retourne L_W = Σ_i [−½|∇Γ|² − ½Γ²|∇Φ|² − ½|∇T|² − U(Γ,T)].
 * Utile pour suivre la convergence (dL_W/dt < 0) et détecter
 * les instabilités numériques (L_W qui remonte → η trop grand).
 */
export async function getLagrangian(_request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const engine = await createTtcEngine();
    const lw = await engine.computeLagrangian();
    response.json({ lagrangian: lw, note: 'L_W < 0 attendu. dL_W/dt < 0 → relaxation. L_W qui remonte → instabilité.' });
  } catch (error: unknown) {
    next(error);
  }
}

/**
 * GET /benchmark — Exécute le benchmark TTC sur 10 paires contradictoires.
 */
export async function runBenchmark(_request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const pairs = [
      { coh: 'Python: len() retourne un entier int', hall: 'Python: len() retourne un float', id: '01', label: 'Python len()' },
      { coh: 'React: useState retourne un tableau de 2 elements state et setState', hall: 'React: useState retourne un tableau de 3 elements', id: '02', label: 'React useState' },
      { coh: 'TypeScript: les types sont effaces a la compilation', hall: 'TypeScript: les types sont conserves et evalues au runtime', id: '03', label: 'TypeScript types' },
      { coh: 'Express 5 supporte les route handlers async sans try catch', hall: 'Express 5 ne supporte pas lasync et necessite des blocs try catch', id: '04', label: 'Express 5' },
      { coh: 'pgvector est une extension PostgreSQL pour le stockage vectoriel', hall: 'pgvector est un framework pour entrainer des modeles de Machine Learning', id: '05', label: 'pgvector' },
      { coh: 'Next.js 14 utilise le App Router par defaut', hall: 'Next.js 14 impose le Pages Router exclusivement', id: '06', label: 'Next.js' },
      { coh: 'Graphiti: le group_id isole les donnees entre clients', hall: 'Graphiti: le group_id fusionne les donnees de tous les clients', id: '07', label: 'Graphiti' },
      { coh: 'JavaScript: loperateur === verifie la valeur et le type', hall: 'JavaScript: loperateur === convertit les types avant verification', id: '08', label: 'JS ===' },
      { coh: 'Rust: le Borrow Checker garantit la securite memoire a la compilation', hall: 'Rust: le Garbage Collector nettoie la memoire a lexecution', id: '09', label: 'Rust' },
      { coh: 'KontEx B2B2B: isolation par cle composite Business_ID Client_ID', hall: 'KontEx: tous les locataires partagent une cle unique globale', id: '10', label: 'KontEx' },
    ];

    let pass = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const p of pairs) {
      // Appelle le pipeline TTC complet (pas le fallback heuristique)
      const rCoh = await detectViaTtcPhysics(p.coh);
      const rHall = await detectViaTtcPhysics(p.hall);
      
      const tCoh = (rCoh as Record<string, unknown>)?.tension as number ?? 1;
      const tHall = (rHall as Record<string, unknown>)?.tension as number ?? 1;
      const discrim = tHall > tCoh;
      if (discrim) pass++;
      results.push({ id: p.id, label: p.label, tCoherent: Math.round(tCoh * 10000) / 10000, tHallucination: Math.round(tHall * 10000) / 10000, gap: Math.round((tHall - tCoh) * 10000) / 10000, discrim });
    }

    response.json({
      score: pass,
      total: pairs.length,
      percentage: Math.round((pass / pairs.length) * 100),
      tCrit: 0.10,
      params: { alpha: 0.01, beta: 0.3, lambda: 0.001, gamma: 0.1 },
      results,
    });
  } catch (error: unknown) {
    next(error);
  }
}
