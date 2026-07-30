/// @anchor: Principe A — Ancrage TTC
/// @anchor: PROJECT_CONTEXT.md §2.2 — Structure de la Toile
/// WebWeaver : construction programmatique de la toile contextuelle.
///
/// # Rôle
/// Permet de tisser des nœuds et des liens pour construire
/// une toile contextuelle côté client avant envoi à l'API.

import { randomUUID } from 'node:crypto';
import type { Anchor, ContextLink, ContextNode, NodeKind } from './types.js';
import { AnchorProvider } from './anchor.js';

/**
 * Erreur de tissage de toile.
 */
export class WeaveError extends Error {
  constructor(message: string) {
    super(`[KontEx::Weaver] ${message}`);
    this.name = 'WeaveError';
  }
}

/**
 * Constructeur de nœud — interface fluide pour créer des nœuds.
 */
export class NodeBuilder {
  private readonly kind: NodeKind;
  private readonly content: string;
  private readonly anchors: Anchor[] = [];
  private weightValue = 0.5;
  private ambiguityValue = 0.5;
  private metadataItems: Set<string> = new Set();

  constructor(kind: NodeKind, content: string) {
    this.kind = kind;
    this.content = content;
  }

  /** Ajoute une ancre (Principe A). */
  withAnchor(anchor: Anchor): this {
    this.anchors.push(anchor);
    return this;
  }

  /** Ajoute plusieurs ancres. */
  withAnchors(anchors: readonly Anchor[]): this {
    this.anchors.push(...anchors);
    return this;
  }

  /** Définit le poids ∈ [0, 1]. */
  withWeight(weight: number): this {
    if (weight < 0 || weight > 1) {
      throw new WeaveError(`Poids invalide ${weight} — doit être ∈ [0, 1]`);
    }
    this.weightValue = weight;
    return this;
  }

  /** Définit l'ambiguïté ∈ [0, 1]. */
  withAmbiguity(ambiguity: number): this {
    if (ambiguity < 0 || ambiguity > 1) {
      throw new WeaveError(`Ambiguïté invalide ${ambiguity} — doit être ∈ [0, 1]`);
    }
    this.ambiguityValue = ambiguity;
    return this;
  }

  /** Ajoute une métadonnée. */
  withMetadata(tag: string): this {
    this.metadataItems.add(tag);
    return this;
  }

  /** Construit le nœud. */
  build(): ContextNode {
    // Validation Principe A
    if (this.anchors.length === 0) {
      throw new WeaveError(
        `Violation Principe A : le nœud "${this.content.slice(0, 50)}" n'a aucune ancre`,
      );
    }

    return {
      id: randomUUID(),
      kind: this.kind,
      content: this.content,
      weight: this.weightValue,
      ambiguity: this.ambiguityValue,
      anchors: [...this.anchors],
      metadata: this.metadataItems,
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * Tisseur de toile — construit et gère un graphe contextuel en mémoire.
 *
 * # Usage
 * ```typescript
 * const weaver = new WebWeaver();
 * const node = new NodeBuilder('fact', 'Le ciel est bleu')
 *   .withAnchor({ uri: 'spec://optics', sourceType: 'specification' })
 *   .build();
 * weaver.addNode(node);
 * ```
 */
export class WebWeaver {
  private readonly nodes: Map<string, ContextNode> = new Map();
  private readonly links: Map<string, ContextLink> = new Map();
  private readonly anchorProvider: AnchorProvider;

  constructor() {
    this.anchorProvider = new AnchorProvider();
  }

  /**
   * Ajoute un nœud à la toile.
   * @side-effect: modifie la map interne.
   *
   * @throws WeaveError si le nœud viole le Principe A
   */
  addNode(node: ContextNode): void {
    const verification = this.anchorProvider.verify(node.anchors);
    if (!verification.isAnchored) {
      throw new WeaveError(
        `Nœud ${node.id} rejeté : Principe A non satisfait (${verification.sourceCount} sources valides)`,
      );
    }
    this.nodes.set(node.id, node);
  }

  /**
   * Ajoute un lien entre deux nœuds.
   * @side-effect: modifie la map interne.
   *
   * @throws WeaveError si un des nœuds n'existe pas
   */
  addLink(link: ContextLink): void {
    if (!this.nodes.has(link.sourceId)) {
      throw new WeaveError(`Nœud source ${link.sourceId} introuvable`);
    }
    if (!this.nodes.has(link.targetId)) {
      throw new WeaveError(`Nœud cible ${link.targetId} introuvable`);
    }
    this.links.set(link.id, link);
  }

  /**
   * Récupère un nœud par ID.
   * Fonction pure (E2).
   */
  getNode(id: string): ContextNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Retourne tous les liens sortants d'un nœud.
   * Fonction pure (E2).
   */
  getOutgoingLinks(nodeId: string): ContextLink[] {
    const result: ContextLink[] = [];
    for (const link of this.links.values()) {
      if (link.sourceId === nodeId) {
        result.push(link);
      }
    }
    return result;
  }

  /**
   * Retourne tous les liens de contradiction.
   * Fonction pure (E2).
   */
  getContradictions(): ContextLink[] {
    const result: ContextLink[] = [];
    for (const link of this.links.values()) {
      if (link.relation === 'contradicts') {
        result.push(link);
      }
    }
    return result;
  }

  /**
   * Calcule la force de propagation entre deux nœuds.
   * P(n_i, n_j) = w_{ij} × relevance
   * Fonction pure (E2).
   */
  computePropagationForce(sourceId: string, targetId: string): number {
    for (const link of this.links.values()) {
      if (link.sourceId === sourceId && link.targetId === targetId) {
        return link.weight * link.relevanceScore;
      }
    }
    return 0;
  }

  /**
   * Nombre de nœuds dans la toile.
   * Fonction pure (E2).
   */
  get nodeCount(): number {
    return this.nodes.size;
  }

  /**
   * Nombre de liens dans la toile.
   * Fonction pure (E2).
   */
  get linkCount(): number {
    return this.links.size;
  }

  /**
   * Tous les nœuds (itération).
   */
  getAllNodes(): ContextNode[] {
    return [...this.nodes.values()];
  }
}
