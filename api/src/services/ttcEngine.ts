/// @anchor: Bridge Rust ↔ Node.js — Utilise le module natif napi-rs si disponible.
/// Sinon, fallback sur l'implémentation TypeScript in-memory.

import { createRequire } from 'node:module';
import { ttcService as fallbackService } from './ttcService.js';

// Types communs
type AnchorInput = { uri: string; sourceType: string };
type ReachedNode = { nodeId: string; score: number };
type VerifResult = { isAnchored: boolean; strength: number; sourceCount: number; missingCategories: string[] };
type ContradictionResult = { isContradiction: boolean; confidence: number; contradictions: string[]; suggestedResolution: string | null };
type PropagResult = { sourceId: string; reachedCount: number; maxDepth: number; nodes: ReachedNode[] };
type StatsResult = { nodeCount: number; linkCount: number; anchoredCount: number; anchoringRate: number; contradictionCount: number; globalEntropy: number };

/// Paramètres du Lagrangien MCW-2 (6 constantes, TTC v1.1)
export interface TtcParams {
  alpha: number;   // auto-couplage de Γ
  beta: number;    // masse de T
  lambda: number;  // couplage T-Γ
  gamma: number;   // couplage Φ–T (MCW-2) : la tension sourcée par ∇Φ
  vGamma: number;  // VEV de cohérence
  vTension: number; // VEV de tension
}

/// État des champs TTC pour un nœud après résolution
export interface NodeFields {
  nodeId: string;
  gamma: number;   // Cohérence Γ
  phi: number;     // Phase Φ
  tension: number; // Tension T
}

/// Résultat du solveur de champ TTC
export interface SolveResult {
  iterations: number;
  converged: boolean;
  nodeFields: NodeFields[];
}

export const DEFAULT_TTC_PARAMS: TtcParams = {
  alpha: 0.01,    // Higgs Γ — réduit
  beta: 0.3,      // Masse T — stabilité numérique
  lambda: 0.001,  // Couplage Γ–T — calibré benchmark 10 paires
  gamma: 0.1,     // Couplage Φ–T (MCW-2) — calibré
  vGamma: 1.0,    // VEV cohérence normalisé
  vTension: 0.0,
};

export interface TtcEngine {
  addNode(kind: string, content: string, weight: number, ambiguity: number, anchors: AnchorInput[]): Promise<string>;
  getNode(id: string): Promise<Record<string, unknown> | undefined>;
  listNodes(): Promise<Record<string, unknown>[]>;
  addLink(sourceId: string, targetId: string, relation: string, weight: number, relevanceScore: number): Promise<string>;
  verifyAnchoring(nodeId: string): Promise<VerifResult>;
  detectContradiction(content: string): Promise<ContradictionResult>;
  propagateContext(sourceId: string, threshold?: number, maxDepth?: number): Promise<PropagResult>;
  resolveContradiction(nodeA: string, nodeB: string): Promise<string>;
  minimizeEntropy(maxIterations?: number): Promise<number>;
  getStats(): Promise<StatsResult>;

  // === Nouvelles méthodes TTC (solveur de champ physique) ===
  /** Résout les équations de champ Γ, Φ, T sur toute la toile */
  solveFieldEquations(params: TtcParams, learningRate: number, iterations: number): Promise<SolveResult>;
  /** Retourne la tension topologique T avec paramètres MCW-2 */
  getTensionResidue(nodeId: string, alpha?: number, beta?: number, lambda?: number, gamma?: number, lr?: number, iter?: number): Promise<number>;
  /** Retourne l'état complet des champs pour tous les nœuds */
  getFieldState(): Promise<NodeFields[]>;
  /** Calcule le résidu de tension sur une arête */
  getEdgeTension(sourceId: string, targetId: string): Promise<number>;
  /** Évalue le Lagrangien MCW-2 complet (L_W) — suivi de convergence */
  computeLagrangian(): Promise<number>;
  /** Synchronise les nœuds/liens PG vers le moteur natif Rust */
  syncFromPg(): Promise<number>;
}

// Module natif (chargé paresseusement)
let nativeWeb: Record<string, unknown> | null = null;
let nativeLoadAttempted = false;

function tryLoadNative(): void {
  if (nativeLoadAttempted) return;
  nativeLoadAttempted = true;
  try {
    // createRequire pour charger du CJS depuis un module ESM
    const _require = createRequire(import.meta.url);
    const mod = _require('../../../core/npm/index.js') as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const JsWeb = mod['JsWeb'] as new () => any;
    nativeWeb = new JsWeb() as unknown as Record<string, unknown>;
    console.log('[KontEx::TTC] Module natif Rust chargé ✓');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[KontEx::TTC] Module natif non disponible — fallback TypeScript activé (${msg})`);
  }
}

export function createTtcEngine(): TtcEngine {
  tryLoadNative();

  if (nativeWeb) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const web = nativeWeb as any;

    return {
      async addNode(kind: string, content: string, weight: number, ambiguity: number, anchors: AnchorInput[]): Promise<string> {
        return String(web.addNode(kind, content, weight, ambiguity, anchors));
      },
      async getNode(id: string): Promise<Record<string, unknown> | undefined> {
        const result = web.getNode(id) as Record<string, unknown> | null;
        return result ?? undefined;
      },
      async listNodes(): Promise<Record<string, unknown>[]> {
        return web.listNodes() as Record<string, unknown>[];
      },
      async addLink(sourceId: string, targetId: string, relation: string, weight: number, relevanceScore: number): Promise<string> {
        return String(web.addLink(sourceId, targetId, relation, weight, relevanceScore));
      },
      async verifyAnchoring(nodeId: string): Promise<VerifResult> {
        return web.verifyAnchoring(nodeId) as VerifResult;
      },
      async detectContradiction(content: string): Promise<ContradictionResult> {
        return web.detectContradiction(content) as ContradictionResult;
      },
      async propagateContext(sourceId: string, threshold = 0.01, maxDepth = 10): Promise<PropagResult> {
        return web.propagateContext(sourceId, threshold, maxDepth) as PropagResult;
      },
      async resolveContradiction(nodeA: string, nodeB: string): Promise<string> {
        return String(web.resolveContradiction(nodeA, nodeB));
      },
      async minimizeEntropy(maxIterations = 5): Promise<number> {
        return Number(web.minimizeEntropy(maxIterations));
      },
      async getStats(): Promise<StatsResult> {
        return web.getStats() as StatsResult;
      },

      // === Nouvelles méthodes TTC (solveur de champ physique) ===
      // Si le module natif n'a pas ces méthodes (mock), on utilise le fallback
      async solveFieldEquations(params: TtcParams, learningRate: number, iterations: number): Promise<SolveResult> {
        if (typeof (web as any).solveFieldEquations === 'function') {
          return (web as any).solveFieldEquations(
            { alpha: params.alpha, beta: params.beta, lambda: params.lambda, gamma: params.gamma, vGamma: params.vGamma, vTension: params.vTension },
            learningRate, iterations,
          ) as SolveResult;
        }
        // Fallback simulé
        const nodes = await fallbackService.listNodes();
        return { iterations: 0, converged: false, nodeFields: nodes.map(n => ({ nodeId: n.id, gamma: n.weight, phi: 0, tension: n.ambiguity })) };
      },
      async getTensionResidue(nodeId: string, alpha?: number, beta?: number, lambda?: number, gamma?: number, lr?: number, iter?: number): Promise<number> {
        if (typeof (web as any).getTensionResidue === 'function') {
          return Number((web as any).getTensionResidue(nodeId, alpha, beta, lambda, gamma, lr, iter));
        }
        const node = await fallbackService.getNode(nodeId);
        return node?.ambiguity ?? 0.5;
      },
      async getFieldState(): Promise<NodeFields[]> {
        if (typeof (web as any).getFieldState === 'function') {
          return (web as any).getFieldState() as NodeFields[];
        }
        const nodes = await fallbackService.listNodes();
        return nodes.map(n => ({ nodeId: n.id, gamma: n.weight, phi: 0, tension: n.ambiguity }));
      },
      async getEdgeTension(sourceId: string, targetId: string): Promise<number> {
        if (typeof (web as any).getEdgeTension === 'function') {
          return Number((web as any).getEdgeTension(sourceId, targetId));
        }
        return 0;
      },
      async computeLagrangian(): Promise<number> {
        if (typeof (web as any).computeLagrangian === 'function') {
          return Number((web as any).computeLagrangian());
        }
        const nodes = await fallbackService.listNodes();
        return -nodes.reduce((sum, n) => sum + n.weight * n.weight + n.ambiguity * n.ambiguity, 0);
      },

      // === Sync PG → Rust ===
      async syncFromPg(): Promise<number> {
        if (typeof (web as any).addNodeWithId !== 'function') return 0;
        const nodes = await fallbackService.listNodes();
        const links = await fallbackService.listLinks();
        let count = 0;
        for (const n of nodes) {
          try {
            (web as any).addNodeWithId(n.id, n.kind, n.content, n.weight, n.ambiguity,
              (n.anchors || []).map((a: any) => ({ uri: a.uri || '', sourceType: a.sourceType || 'other' })));
            count++;
          } catch { /* skip duplicates */ }
        }
        for (const l of links) {
          try {
            if (typeof (web as any).addLink === 'function') {
              (web as any).addLink(l.sourceId, l.targetId, l.relation, l.weight, l.relevanceScore);
            }
          } catch { /* skip */ }
        }
        return count;
      },
    };
  }

  // Fallback TypeScript
  return {
    async addNode(kind: string, content: string, weight: number, ambiguity: number, anchors: AnchorInput[]) {
      const node = await fallbackService.addNode({
        kind: kind as 'fact' | 'rule' | 'code' | 'documentation', content, weight, ambiguity,
        anchors: anchors.map((a) => ({
          uri: a.uri,
          sourceType: a.sourceType as 'official_documentation' | 'test_case' | 'specification' | 'code_repository' | 'peer_review' | 'other',
        })),
      });
      return node.id;
    },
    async getNode(id: string) {
      const node = await fallbackService.getNode(id);
      return node as unknown as Record<string, unknown> | undefined;
    },
    async listNodes() {
      const nodes = await fallbackService.listNodes();
      return nodes as unknown as Record<string, unknown>[];
    },
    async addLink(sourceId: string, targetId: string, relation: string, weight: number, relevanceScore: number) {
      const link = await fallbackService.addLink({
        sourceId, targetId,
        relation: relation as 'depends_on' | 'contradicts' | 'refines' | 'exemplifies' | 'references' | 'custom',
        weight, relevanceScore,
      });
      return link.id;
    },
    async verifyAnchoring(nodeId: string) {
      const v = await fallbackService.verifyAnchoring(nodeId);
      return { ...v, missingCategories: [...v.missingCategories] } as VerifResult;
    },
    async detectContradiction(content: string) {
      const r = await fallbackService.detectContradictions(content);
      return { ...r, contradictions: [...r.contradictions] } as ContradictionResult;
    },
    async propagateContext(sourceId: string, threshold = 0.01, maxDepth = 10) {
      const r = await fallbackService.propagateContext(sourceId, threshold, maxDepth);
      return {
        sourceId: r.sourceId, reachedCount: r.reachedCount, maxDepth: r.maxDepth,
        nodes: [...r.reachedNodes.entries()].map(([nodeId, score]) => ({ nodeId, score })),
      } as PropagResult;
    },
    async resolveContradiction(nodeA: string, nodeB: string) {
      return `Résolution: ${nodeA} ↔ ${nodeB} — utiliser POST /detect`;
    },
    async minimizeEntropy() { return 0; },
    async getStats() { return fallbackService.getStats(); },

    // === Fallback TTC (simulé) ===
    async solveFieldEquations(_params: TtcParams, _lr: number, _iter: number): Promise<SolveResult> {
      const nodes = await fallbackService.listNodes();
      return {
        iterations: 0,
        converged: false,
        nodeFields: nodes.map((n) => ({
          nodeId: n.id,
          gamma: n.weight,
          phi: 0,
          tension: n.ambiguity,
        })),
      };
    },
    async getTensionResidue(nodeId: string, _a?: number, _b?: number, _l?: number, _g?: number, _lr?: number, _iter?: number): Promise<number> {
      const node = await fallbackService.getNode(nodeId);
      return node?.ambiguity ?? 0.5;
    },
    async getFieldState(): Promise<NodeFields[]> {
      const nodes = await fallbackService.listNodes();
      return nodes.map((n) => ({
        nodeId: n.id,
        gamma: n.weight,
        phi: 0,
        tension: n.ambiguity,
      }));
    },
    async getEdgeTension(_s: string, _t: string): Promise<number> {
      return 0;
    },
    async computeLagrangian(): Promise<number> {
      // Fallback : L_W approximé à partir des poids et ambiguïtés
      const nodes = await fallbackService.listNodes();
      return -nodes.reduce((sum, n) => sum + n.weight * n.weight + n.ambiguity * n.ambiguity, 0);
    },
    async syncFromPg(): Promise<number> { return 0; },
  };
}

// Singleton engine
const engine: TtcEngine = createTtcEngine();

/**
 * Récupère les statistiques globales de la toile TTC.
 * Utilisé par le healthcheck et GET /stats.
 */
export async function getStats(): Promise<StatsResult> {
  return engine.getStats();
}
