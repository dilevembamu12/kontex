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

/** Seuil de tension au-delà duquel une hallucination est déclarée */
const TENSION_HALLUCINATION_THRESHOLD = 0.95;

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
    //    Γ initial = maxSimilarity (cohérent si proche d'un fait ancré)
    //    T initial = 1 - maxSimilarity (tension si éloigné des faits)
    const assertionId = await engine.addNode(
      'fact', content,
      maxSimilarity,           // weight = cohérence Γ
      1.0 - maxSimilarity,     // ambiguity = tension initiale
      [{ uri: 'spec://llm-assertion', sourceType: 'specification' }],
    );

    // 3. Crée des liens vers les nœuds similaires (tissage)
    const linkedIds: string[] = [];
    for (const similar of similarNodes) {
      try {
        await engine.addLink(assertionId, similar.id, 'references', similar.similarity, similar.similarity);
        linkedIds.push(similar.id);
      } catch { /* ignorer */ }
    }

    // 4. Résout les équations de champ TTC
    const solveResult = await engine.solveFieldEquations(DEFAULT_TTC_PARAMS, 0.1, 30);

    // 5. Mesure la tension au nœud de l'assertion
    const tension = await engine.getTensionResidue(assertionId);

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
      solveIterations: solveResult.iterations,
      solveConverged: solveResult.converged,
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
