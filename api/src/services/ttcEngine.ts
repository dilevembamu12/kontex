/// @anchor: Bridge Rust ↔ Node.js — Utilise le module natif napi-rs si disponible.
/// Sinon, fallback sur l'implémentation TypeScript in-memory.

import { ttcService as fallbackService } from './ttcService.js';

// Types communs
type AnchorInput = { uri: string; sourceType: string };
type ReachedNode = { nodeId: string; score: number };
type VerifResult = { isAnchored: boolean; strength: number; sourceCount: number; missingCategories: string[] };
type ContradictionResult = { isContradiction: boolean; confidence: number; contradictions: string[]; suggestedResolution: string | null };
type PropagResult = { sourceId: string; reachedCount: number; maxDepth: number; nodes: ReachedNode[] };
type StatsResult = { nodeCount: number; linkCount: number; anchoredCount: number; anchoringRate: number; contradictionCount: number; globalEntropy: number };

export interface TtcEngine {
  addNode(kind: string, content: string, weight: number, ambiguity: number, anchors: AnchorInput[]): string;
  getNode(id: string): Record<string, unknown> | undefined;
  listNodes(): Record<string, unknown>[];
  addLink(sourceId: string, targetId: string, relation: string, weight: number, relevanceScore: number): string;
  verifyAnchoring(nodeId: string): VerifResult;
  detectContradiction(content: string): ContradictionResult;
  propagateContext(sourceId: string, threshold?: number, maxDepth?: number): PropagResult;
  resolveContradiction(nodeA: string, nodeB: string): string;
  minimizeEntropy(maxIterations?: number): number;
  getStats(): StatsResult;
}

// Module natif (chargé paresseusement)
let nativeWeb: unknown = null;
let nativeLoadAttempted = false;

function tryLoadNative() {
  if (nativeLoadAttempted) return;
  nativeLoadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../../core/npm/index.js');
    nativeWeb = new mod.JsWeb();
    console.log('[KontEx::TTC] Module natif Rust chargé ✓');
  } catch {
    console.log('[KontEx::TTC] Module natif non disponible — fallback TypeScript activé');
  }
}

export function createTtcEngine(): TtcEngine {
  tryLoadNative();

  if (nativeWeb) {
    /// @justify: any utilisé pour le bridge natif — les types exacts sont dans index.d.ts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const web = nativeWeb as any;

    return {
      addNode: (k: string, c: string, w: number, a: number, anchors: AnchorInput[]) =>
        String(web.addNode(k, c, w, a, anchors)),
      getNode: (id: string) => (web.getNode(id) as Record<string, unknown>) ?? undefined,
      listNodes: () => web.listNodes() as Record<string, unknown>[],
      addLink: (s: string, t: string, r: string, w: number, rs: number) =>
        String(web.addLink(s, t, r, w, rs)),
      verifyAnchoring: (id: string) => web.verifyAnchoring(id) as VerifResult,
      detectContradiction: (c: string) => web.detectContradiction(c) as ContradictionResult,
      propagateContext: (s: string, th = 0.01, md = 10) =>
        web.propagateContext(s, th, md) as PropagResult,
      resolveContradiction: (a: string, b: string) => String(web.resolveContradiction(a, b)),
      minimizeEntropy: (n = 5) => Number(web.minimizeEntropy(n)),
      getStats: () => web.getStats() as StatsResult,
    };
  }

  // Fallback TypeScript
  return {
    addNode(kind, content, weight, ambiguity, anchors) {
      const node = fallbackService.addNode({
        kind: kind as 'fact' | 'rule' | 'code' | 'documentation',
        content, weight, ambiguity,
        anchors: anchors.map((a) => ({
          uri: a.uri,
          sourceType: a.sourceType as 'official_documentation' | 'test_case' | 'specification' | 'code_repository' | 'peer_review' | 'other',
        })),
      });
      return node.id;
    },
    getNode(id) { return fallbackService.getNode(id) as unknown as Record<string, unknown> | undefined; },
    listNodes() { return fallbackService.listNodes() as unknown as Record<string, unknown>[]; },
    addLink(sourceId, targetId, relation, weight, relevanceScore) {
      const link = fallbackService.addLink({
        sourceId, targetId,
        relation: relation as 'depends_on' | 'contradicts' | 'refines' | 'exemplifies' | 'references' | 'custom',
        weight, relevanceScore,
      });
      return link.id;
    },
    verifyAnchoring(nodeId) {
      const v = fallbackService.verifyAnchoring(nodeId);
      return { ...v, missingCategories: [...v.missingCategories] };
    },
    detectContradiction(content) {
      const r = fallbackService.detectContradictions(content);
      return { ...r, contradictions: [...r.contradictions] };
    },
    propagateContext(sourceId, threshold = 0.01, maxDepth = 10) {
      const r = fallbackService.propagateContext(sourceId, threshold, maxDepth);
      return {
        sourceId: r.sourceId,
        reachedCount: r.reachedCount,
        maxDepth: r.maxDepth,
        nodes: [...r.reachedNodes.entries()].map(([nodeId, score]) => ({ nodeId, score })),
      };
    },
    resolveContradiction(nodeA, nodeB) {
      return `Résolution: ${nodeA} ↔ ${nodeB} — utiliser POST /detect`;
    },
    minimizeEntropy() { return 0; },
    getStats() { return fallbackService.getStats(); },
  };
}
