/// @anchor: PROJECT_CONTEXT.md §2.1 — Théorie de la Toile Cosmologique
/// Service TTC en TypeScript — logique métier de la toile contextuelle.
///
/// En développement : stockage en mémoire (Map).
/// En production : PostgreSQL + pgvector.
///
/// # Principes TTC implémentés
/// - A : ancrage obligatoire, force d'ancrage
/// - C : détection de contradictions, résolution
/// - P : propagation BFS pondérée
/// - E_min : calcul d'entropie, minimisation

import { randomUUID } from 'node:crypto';

// ============================================================
// Types internes au service
// ============================================================

export interface ContextNodeInput {
  readonly kind: 'fact' | 'rule' | 'code' | 'documentation';
  readonly content: string;
  readonly weight?: number;
  readonly ambiguity?: number;
  readonly anchors: readonly AnchorInput[];
  readonly metadata?: Record<string, string>;
}

export interface AnchorInput {
  readonly uri: string;
  readonly sourceType: 'official_documentation' | 'test_case' | 'specification' | 'code_repository' | 'peer_review' | 'other';
  readonly description?: string;
}

export interface ContextLinkInput {
  readonly sourceId: string;
  readonly targetId: string;
  readonly relation: 'depends_on' | 'contradicts' | 'refines' | 'exemplifies' | 'references' | 'custom';
  readonly weight?: number;
  readonly relevanceScore?: number;
}

export interface StoredNode {
  readonly id: string;
  readonly kind: string;
  readonly content: string;
  readonly weight: number;
  readonly ambiguity: number;
  readonly anchors: readonly AnchorInput[];
  readonly metadata: Record<string, string>;
  readonly createdAt: string;
  updatedAt: string;
}

export interface StoredLink {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly relation: string;
  readonly weight: number;
  readonly relevanceScore: number;
  readonly createdAt: string;
}

export interface AnchorVerification {
  readonly isAnchored: boolean;
  readonly strength: number;
  readonly sourceCount: number;
  readonly missingCategories: readonly string[];
}

export interface ContradictionReport {
  readonly isContradiction: boolean;
  readonly confidence: number;
  readonly contradictions: readonly string[];
  readonly suggestedResolution: string | null;
}

export interface HallucinationReport {
  readonly isHallucination: boolean;
  readonly confidence: number;
  readonly contradictingNodeIds: readonly string[];
  readonly suggestions: readonly string[];
}

export interface PropagationResult {
  readonly sourceId: string;
  readonly reachedNodes: ReadonlyMap<string, number>;
  readonly maxDepth: number;
  readonly reachedCount: number;
}

// ============================================================
// Service TTC
// ============================================================

export class TtcService {
  private readonly nodes: Map<string, StoredNode> = new Map();
  private readonly links: Map<string, StoredLink> = new Map();
  // Index : nodeId → Set<linkId> pour les recherches rapides
  private readonly outgoingIndex: Map<string, Set<string>> = new Map();
  private readonly incomingIndex: Map<string, Set<string>> = new Map();

  // ============================================================
  // CRUD Nœuds
  // ============================================================

  /**
   * Ajoute un nœud à la toile.
   * @throws Error si le Principe A est violé (pas d'ancres valides)
   */
  addNode(input: ContextNodeInput): StoredNode {
    // Validation Principe A
    const validAnchors = input.anchors.filter((a) => this.isValidUri(a.uri));
    if (validAnchors.length === 0) {
      throw new Error(
        `Violation Principe A : le nœud "${input.content.slice(0, 60)}" n'a aucune ancre valide`,
      );
    }

    const now = new Date().toISOString();
    const node: StoredNode = {
      id: randomUUID(),
      kind: input.kind,
      content: input.content,
      weight: this.clamp(input.weight ?? 0.5, 0, 1),
      ambiguity: this.clamp(input.ambiguity ?? 0.5, 0, 1),
      anchors: validAnchors,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };

    this.nodes.set(node.id, node);
    return node;
  }

  /** Récupère un nœud par ID. */
  getNode(id: string): StoredNode | undefined {
    return this.nodes.get(id);
  }

  /** Liste tous les nœuds. */
  listNodes(): StoredNode[] {
    return [...this.nodes.values()];
  }

  /** Vérifie l'ancrage d'un nœud (Principe A). */
  verifyAnchoring(nodeId: string): AnchorVerification {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Nœud ${nodeId} introuvable`);
    }

    const sourceCount = node.anchors.length;
    const isAnchored = sourceCount > 0;
    const strength = this.computeAnchorStrength(node.anchors);
    const missingCategories = this.findMissingCategories(node.anchors, isAnchored);

    return { isAnchored, strength, sourceCount, missingCategories };
  }

  /** Vérifie l'ancrage de tous les nœuds. */
  verifyAllAnchors(): Map<string, AnchorVerification> {
    const results = new Map<string, AnchorVerification>();
    for (const [id] of this.nodes) {
      results.set(id, this.verifyAnchoring(id));
    }
    return results;
  }

  // ============================================================
  // CRUD Liens
  // ============================================================

  /**
   * Ajoute un lien entre deux nœuds.
   * @throws Error si un des nœuds n'existe pas
   */
  addLink(input: ContextLinkInput): StoredLink {
    if (!this.nodes.has(input.sourceId)) {
      throw new Error(`Nœud source ${input.sourceId} introuvable`);
    }
    if (!this.nodes.has(input.targetId)) {
      throw new Error(`Nœud cible ${input.targetId} introuvable`);
    }

    const link: StoredLink = {
      id: randomUUID(),
      sourceId: input.sourceId,
      targetId: input.targetId,
      relation: input.relation,
      weight: this.clamp(input.weight ?? 0.5, 0, 1),
      relevanceScore: this.clamp(input.relevanceScore ?? 0.5, 0, 1),
      createdAt: new Date().toISOString(),
    };

    this.links.set(link.id, link);

    // Mise à jour des index
    if (!this.outgoingIndex.has(link.sourceId)) {
      this.outgoingIndex.set(link.sourceId, new Set());
    }
    this.outgoingIndex.get(link.sourceId)!.add(link.id);

    if (!this.incomingIndex.has(link.targetId)) {
      this.incomingIndex.set(link.targetId, new Set());
    }
    this.incomingIndex.get(link.targetId)!.add(link.id);

    return link;
  }

  /** Récupère les liens sortants d'un nœud. */
  getOutgoingLinks(nodeId: string): StoredLink[] {
    const linkIds = this.outgoingIndex.get(nodeId);
    if (!linkIds) return [];
    return [...linkIds].map((id) => this.links.get(id)!).filter(Boolean);
  }

  /** Récupère tous les liens. */
  listLinks(): StoredLink[] {
    return [...this.links.values()];
  }

  // ============================================================
  // Principe C — Cohérence / Contradictions
  // ============================================================

  /**
   * Détecte les contradictions entre un nouveau contenu et la toile existante.
   * Compare via mots-clés + négations.
   */
  detectContradictions(content: string): ContradictionReport {
    const contradictions: string[] = [];
    const keywords = this.extractKeywords(content);
    const hasNegation = this.hasNegation(content);

    for (const node of this.nodes.values()) {
      const nodeKeywords = this.extractKeywords(node.content);
      const commonKeywords = keywords.filter((kw) => nodeKeywords.includes(kw));

      if (commonKeywords.length === 0) continue;

      const nodeHasNegation = this.hasNegation(node.content);
      // Divergence de négation = contradiction potentielle
      if (hasNegation !== nodeHasNegation) {
        contradictions.push(
          `Contradiction détectée avec le nœud ${node.id} : "${node.content.slice(0, 80)}"`,
        );
      }
    }

    const confidence = contradictions.length === 0 ? 1.0 : Math.max(0, 1 - contradictions.length * 0.2);

    return {
      isContradiction: contradictions.length > 0,
      confidence,
      contradictions,
      suggestedResolution: contradictions.length > 0
        ? '@resolution: vérifier les ancres respectives et trancher selon la force d\'ancrage'
        : null,
    };
  }

  // ============================================================
  // Principe P — Propagation
  // ============================================================

  /**
   * Propage le contexte depuis un nœud source (BFS pondéré).
   * P(n_i, n_j) = w_ij × relevanceScore
   */
  propagateContext(sourceId: string, threshold: number = 0.01, maxDepth: number = 10): PropagationResult {
    const reached = new Map<string, number>();
    const queue: Array<[string, number, number]> = [[sourceId, 1.0, 0]]; // [nodeId, score, depth]
    let maxDepthReached = 0;

    reached.set(sourceId, 1.0);

    while (queue.length > 0) {
      const [currentId, currentScore, depth] = queue.shift()!;
      if (depth >= maxDepth) continue;
      maxDepthReached = Math.max(maxDepthReached, depth);

      const outgoing = this.getOutgoingLinks(currentId);
      for (const link of outgoing) {
        const propagationForce = link.weight * link.relevanceScore;
        const newScore = currentScore * propagationForce;
        if (newScore < threshold) continue;

        const existing = reached.get(link.targetId) ?? 0;
        if (newScore > existing) {
          reached.set(link.targetId, newScore);
          queue.push([link.targetId, newScore, depth + 1]);
        }
      }
    }

    reached.delete(sourceId); // On ne compte pas le nœud source
    return {
      sourceId,
      reachedNodes: reached,
      maxDepth: maxDepthReached,
      reachedCount: reached.size,
    };
  }

  // ============================================================
  // Détection d'hallucination (combine A + C + P)
  // ============================================================

  /**
   * Analyse une réponse LLM par rapport à la toile TTC.
   * Retourne un rapport d'hallucination complet.
   */
  detectHallucination(llmResponse: string): HallucinationReport {
    const contradictingNodeIds: string[] = [];
    const suggestions: string[] = [];

    if (this.nodes.size === 0) {
      return {
        isHallucination: true,
        confidence: 0,
        contradictingNodeIds: [],
        suggestions: ['La toile est vide — impossible de vérifier les assertions.'],
      };
    }

    const assertions = this.extractAssertions(llmResponse);
    if (assertions.length === 0) {
      return { isHallucination: false, confidence: 0.9, contradictingNodeIds: [], suggestions: [] };
    }

    let contradictionCount = 0;

    for (const assertion of assertions) {
      const report = this.detectContradictions(assertion);
      if (report.isContradiction) {
        contradictionCount++;
        // Extrait les IDs des nœuds contredisants depuis les messages
        for (const msg of report.contradictions) {
          const match = msg.match(/nœud ([a-f0-9-]+)/);
          if (match && match[1]) {
            contradictingNodeIds.push(match[1]);
          }
        }
        if (report.suggestedResolution) {
          suggestions.push(report.suggestedResolution);
        }
      }
    }

    const ratio = contradictionCount / assertions.length;
    const confidence = Math.max(0, 1 - ratio);

    if (suggestions.length === 0 && confidence < 0.7) {
      suggestions.push('Confiance faible — enrichir la toile avec plus de nœuds ancrés.');
    }

    return {
      isHallucination: confidence < 0.7,
      confidence,
      contradictingNodeIds: [...new Set(contradictingNodeIds)],
      suggestions: [...new Set(suggestions)].slice(0, 5),
    };
  }

  // ============================================================
  // Statistiques
  // ============================================================

  getStats() {
    const verifications = this.verifyAllAnchors();
    let anchoredCount = 0;
    for (const v of verifications.values()) {
      if (v.isAnchored) anchoredCount++;
    }

    const contradictions = [...this.links.values()].filter((l) => l.relation === 'contradicts');

    const totalAmbiguity = [...this.nodes.values()].reduce((sum, n) => sum + n.ambiguity, 0);
    const entropy = this.nodes.size > 0 ? totalAmbiguity / this.nodes.size : 0;

    return {
      nodeCount: this.nodes.size,
      linkCount: this.links.size,
      anchoredCount,
      anchoringRate: this.nodes.size > 0 ? anchoredCount / this.nodes.size : 1,
      contradictionCount: contradictions.length,
      globalEntropy: entropy,
    };
  }

  // ============================================================
  // Helpers privés
  // ============================================================

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private isValidUri(uri: string): boolean {
    if (uri.length === 0) return false;
    if (/\s/.test(uri)) return false;
    const schemes = ['http://', 'https://', 'file://', 'test://', 'spec://'];
    if (schemes.some((s) => uri.startsWith(s))) return true;
    if (uri.startsWith('/')) return true;
    return false;
  }

  private computeAnchorStrength(anchors: readonly AnchorInput[]): number {
    if (anchors.length === 0) return 0;
    const countFactor = Math.min(anchors.length, 5) / 5;
    const qualityFactor = anchors.reduce((sum, a) => {
      switch (a.sourceType) {
        case 'official_documentation':
        case 'specification':
          return sum + 0.3;
        case 'test_case':
        case 'code_repository':
          return sum + 0.2;
        case 'peer_review':
          return sum + 0.15;
        default:
          return sum + 0.1;
      }
    }, 0);
    return Math.min(countFactor * 0.5 + Math.min(qualityFactor, 0.5), 1.0);
  }

  private findMissingCategories(anchors: readonly AnchorInput[], isAnchored: boolean): readonly string[] {
    const missing: string[] = [];
    if (!isAnchored) {
      missing.push('ANY_SOURCE');
    }
    const hasOfficial = anchors.some(
      (a) => a.sourceType === 'official_documentation' || a.sourceType === 'specification',
    );
    if (anchors.length > 0 && !hasOfficial) {
      missing.push('OFFICIAL_SOURCE');
    }
    return missing;
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'le', 'la', 'les', 'des', 'une', 'est', 'pas', 'que', 'qui',
      'dans', 'sur', 'par', 'pour', 'avec', 'the', 'is', 'not', 'are',
      'this', 'that', 'and', 'for', 'from', 'was',
    ]);
    return text
      .toLowerCase()
      .replace(/[^a-zà-ÿ0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !stopWords.has(w));
  }

  private hasNegation(text: string): boolean {
    const patterns = [
      /\bn['’]est pas\b/, /\bne pas\b/, /\bnot\b/, /\bis not\b/,
      /\bisn['’]t\b/, /\bfalse\b/, /\bfaux\b/, /\bjamais\b/,
    ];
    return patterns.some((p) => p.test(text.toLowerCase()));
  }

  private extractAssertions(text: string): string[] {
    return text
      .split(/[.!?;]\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
  }
}

// Instance singleton du service TTC
export const ttcService = new TtcService();
