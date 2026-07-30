/// @anchor: TypeScript typings pour le module natif @kontex/ttc-engine
/// Généré par napi-rs — correspond à src/bridge.rs

/** Type de nœud dans la toile contextuelle. */
export type NodeKind = 'fact' | 'rule' | 'code' | 'documentation';

/** Ancre — source vérifiable (Principe A). */
export interface JsAnchor {
  uri: string;
  sourceType: string;
  description?: string;
}

/** Nœud de la Toile Cosmologique. */
export interface JsNode {
  id: string;
  kind: string;
  content: string;
  weight: number;
  ambiguity: number;
  anchors: JsAnchor[];
  metadata: string[];
  createdAt: string;
  updatedAt: string;
}

/** Vérification d'ancrage (Principe A). */
export interface JsAnchorVerification {
  isAnchored: boolean;
  strength: number;
  sourceCount: number;
  missingCategories: string[];
}

/** Rapport de contradiction (Principe C). */
export interface JsContradictionReport {
  isContradiction: boolean;
  confidence: number;
  contradictions: string[];
  suggestedResolution: string | null;
}

/** Nœud atteint par la propagation (Principe P). */
export interface JsReachedNode {
  nodeId: string;
  score: number;
}

/** Résultat de propagation (Principe P). */
export interface JsPropagationResult {
  sourceId: string;
  reachedCount: number;
  maxDepth: number;
  nodes: JsReachedNode[];
}

/** Statistiques globales de la toile. */
export interface JsWebStats {
  nodeCount: number;
  linkCount: number;
  anchoredCount: number;
  anchoringRate: number;
  contradictionCount: number;
  globalEntropy: number;
}

/**
 * Toile contextuelle TTC — wrapper JS du moteur Rust.
 *
 * # Usage
 * ```typescript
 * import { JsWeb } from '@kontex/ttc-engine';
 * const web = new JsWeb();
 * const id = web.addNode('fact', 'La Terre est ronde', 0.9, 0.05, [
 *   { uri: 'spec://nasa', sourceType: 'specification' },
 * ]);
 * const report = web.detectContradiction('La Terre est plate');
 * ```
 */
export declare class JsWeb {
  constructor();

  /** Ajoute un nœud ancré (Principe A). Retourne l'UUID. */
  addNode(
    kind: NodeKind,
    content: string,
    weight: number,
    ambiguity: number,
    anchors: JsAnchor[],
  ): string;

  /** Récupère un nœud par ID. */
  getNode(id: string): JsNode | null;

  /** Liste tous les nœuds. */
  listNodes(): JsNode[];

  /** Ajoute un lien pondéré entre deux nœuds. */
  addLink(
    sourceId: string,
    targetId: string,
    relation: string,
    weight: number,
    relevanceScore: number,
  ): string;

  /** Vérifie l'ancrage d'un nœud (Principe A). */
  verifyAnchoring(nodeId: string): JsAnchorVerification;

  /** Détecte si un texte contredit la toile (Principe C). */
  detectContradiction(content: string): JsContradictionReport;

  /** Propage le contexte depuis un nœud (Principe P). */
  propagateContext(
    sourceId: string,
    threshold: number,
    maxDepth: number,
  ): JsPropagationResult;

  /** Résout une contradiction entre deux nœuds (Principe C). */
  resolveContradiction(nodeA: string, nodeB: string): string;

  /** Minimise l'entropie de la toile (Principe E_min). */
  minimizeEntropy(maxIterations: number): number;

  /** Retourne les statistiques globales. */
  getStats(): JsWebStats;
}

declare const nativeModule: { JsWeb: typeof JsWeb };
export default nativeModule;
