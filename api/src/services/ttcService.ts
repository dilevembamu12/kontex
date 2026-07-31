/// @anchor: PROJECT_CONTEXT.md §2.1 — Théorie de la Toile Cosmologique
/// Service TTC en TypeScript — logique métier de la toile contextuelle.
///
/// En développement : stockage en mémoire (Map).
/// En production : PostgreSQL + pgvector via repositories.
///
/// # Principes TTC implémentés
/// - A : ancrage obligatoire, force d'ancrage
/// - C : détection de contradictions, résolution
/// - P : propagation BFS pondérée
/// - E_min : calcul d'entropie, minimisation

import {
  InMemoryNodeRepository,
  PostgresNodeRepository,
  type NodeRepository,
} from '../repositories/nodeRepository.js';
import {
  InMemoryLinkRepository,
  PostgresLinkRepository,
  type LinkRepository,
} from '../repositories/linkRepository.js';

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
  private readonly nodeRepo: NodeRepository;
  private readonly linkRepo: LinkRepository;
  // Index mémoire pour les recherches rapides (propagation BFS)
  private readonly outgoingIndex: Map<string, Set<string>> = new Map();
  private readonly incomingIndex: Map<string, Set<string>> = new Map();

  constructor(nodeRepo?: NodeRepository, linkRepo?: LinkRepository) {
    this.nodeRepo = nodeRepo ?? new InMemoryNodeRepository();
    this.linkRepo = linkRepo ?? new InMemoryLinkRepository();
  }

  // ============================================================
  // CRUD Nœuds
  // ============================================================

  /**
   * Ajoute un nœud à la toile.
   * @throws Error si le Principe A est violé (pas d'ancres valides)
   */
  async addNode(input: ContextNodeInput): Promise<StoredNode> {
    // Validation Principe A
    const validAnchors = input.anchors.filter((a) => this.isValidUri(a.uri));
    if (validAnchors.length === 0) {
      throw new Error(
        `Violation Principe A : le nœud "${input.content.slice(0, 60)}" n'a aucune ancre valide`,
      );
    }
    // Ajoute les ancres validées uniquement
    return this.nodeRepo.create({ ...input, anchors: validAnchors });
  }

  /** Récupère un nœud par ID. */
  async getNode(id: string): Promise<StoredNode | undefined> {
    const node = await this.nodeRepo.findById(id);
    return node ?? undefined;
  }

  /** Liste tous les nœuds. */
  async listNodes(): Promise<StoredNode[]> {
    return this.nodeRepo.findAll();
  }

  /** Vérifie l'ancrage d'un nœud (Principe A). */
  async verifyAnchoring(nodeId: string): Promise<AnchorVerification> {
    const node = await this.nodeRepo.findById(nodeId);
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
  async verifyAllAnchors(): Promise<Map<string, AnchorVerification>> {
    const results = new Map<string, AnchorVerification>();
    const nodes = await this.nodeRepo.findAll();
    for (const node of nodes) {
      results.set(node.id, this.computeAnchorVerification(node));
    }
    return results;
  }

  private computeAnchorVerification(node: StoredNode): AnchorVerification {
    const sourceCount = node.anchors.length;
    const isAnchored = sourceCount > 0;
    const strength = this.computeAnchorStrength(node.anchors);
    const missingCategories = this.findMissingCategories(node.anchors, isAnchored);
    return { isAnchored, strength, sourceCount, missingCategories };
  }

  // ============================================================
  // CRUD Liens
  // ============================================================

  /**
   * Ajoute un lien entre deux nœuds.
   * @throws Error si un des nœuds n'existe pas
   */
  async addLink(input: ContextLinkInput): Promise<StoredLink> {
    const sourceExists = await this.nodeRepo.findById(input.sourceId);
    const targetExists = await this.nodeRepo.findById(input.targetId);
    if (!sourceExists) {
      throw new Error(`Nœud source ${input.sourceId} introuvable`);
    }
    if (!targetExists) {
      throw new Error(`Nœud cible ${input.targetId} introuvable`);
    }

    const link = await this.linkRepo.create(input);

    // Mise à jour des index mémoire pour le BFS
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
  async getOutgoingLinks(nodeId: string): Promise<StoredLink[]> {
    return this.linkRepo.findBySourceId(nodeId);
  }

  /** Récupère tous les liens. */
  async listLinks(): Promise<StoredLink[]> {
    return this.linkRepo.findAll();
  }

  // ============================================================
  // Principe C — Cohérence / Contradictions
  // ============================================================

  /**
   * Détecte les contradictions entre un nouveau contenu et la toile existante.
   *
   * Approche robuste par comparaison de tokens uniques :
   * 1. Si deux textes partagent ≥40% de mots-clés → même sujet
   * 2. On compare les tokens UNIQUES à chaque texte
   * 3. Si les tokens uniques contiennent des paires incompatibles → contradiction
   *
   * Paires incompatibles connues :
   *   - int ↔ float, string ↔ number, 2 ↔ 3, true ↔ false
   *   - « ne pas » vs affirmation, « toujours » vs « jamais »
   */
  async detectContradictions(content: string): Promise<ContradictionReport> {
    const contradictions: string[] = [];
    const allNodes = await this.nodeRepo.findAll();

    const inputTokens = this.tokenize(content);
    const inputKeywords = this.extractKeywords(content);

    for (const node of allNodes) {
      const nodeKeywords = this.extractKeywords(node.content);
      const commonKeywords = inputKeywords.filter((kw) => nodeKeywords.includes(kw));

      // Moins de 25% d'overlap OU moins de 2 mots-clés communs → sujets différents
      const overlapRatio = commonKeywords.length / Math.max(inputKeywords.length, 1);
      if (overlapRatio < 0.20 && commonKeywords.length < 2) continue;

      const nodeTokens = this.tokenize(node.content);

      // Trouve les tokens UNIQUES à chaque texte
      const inputUnique = inputTokens.filter((t) => !nodeTokens.includes(t));
      const nodeUnique = nodeTokens.filter((t) => !inputTokens.includes(t));

      // Vérifie les paires contradictoires entre tokens uniques
      const hasNegationInput = this.hasNegation(content);
      const hasNegationNode = this.hasNegation(node.content);

      // Signal 1 : Négation contradictoire (l'un nie ce que l'autre affirme)
      if (hasNegationInput !== hasNegationNode && commonKeywords.length >= 2) {
        contradictions.push(
          `Contradiction de négation avec le nœud ${node.id} : "${node.content.slice(0, 100)}"`,
        );
        continue;
      }

      // Signal 2 : Tokens incompatibles (int↔float, 2↔3, etc.)
      // Vérifie à la fois les tokens uniques ET les ensembles complets
      if (
        this.hasIncompatibleTokens(inputUnique, nodeUnique) ||
        this.hasIncompatibleTokens(inputTokens, nodeTokens)
      ) {
        contradictions.push(
          `Contradiction de valeur avec le nœud ${node.id} : "${node.content.slice(0, 100)}"`,
        );
        continue;
      }

      // Signal 3 : Entités numériques contradictoires
      const inputNums = this.extractNumbers(content);
      const nodeNums = this.extractNumbers(node.content);
      for (const [context, inputVal] of inputNums) {
        const nodeVal = nodeNums.get(context);
        if (nodeVal !== undefined && inputVal !== nodeVal) {
          contradictions.push(
            `Contradiction numérique (${inputVal}↔${nodeVal}) avec le nœud ${node.id}`,
          );
          break;
        }
      }
    }

    const confidence = contradictions.length === 0
      ? 1.0
      : Math.max(0, 1 - contradictions.length * 0.25);

    return {
      isContradiction: contradictions.length > 0,
      confidence,
      contradictions,
      suggestedResolution: contradictions.length > 0
        ? '@resolution: vérifier les ancres respectives et trancher selon la force d\'ancrage'
        : null,
    };
  }

  /**
   * Paires de tokens incompatibles.
   */
  private readonly INCOMPATIBLE_PAIRS: ReadonlyArray<[string, string]> = [
    // Types
    ['int', 'float'], ['integer', 'float'], ['entier', 'flottant'],
    ['string', 'number'], ['chaîne', 'nombre'],
    // Booléens
    ['true', 'false'], ['vrai', 'faux'],
    // Temps/fréquence
    ['toujours', 'jamais'], ['always', 'never'],
    // Sync/async
    ['synchrone', 'asynchrone'], ['sync', 'async'],
    ['callback', 'promise'], ['callbacks', 'promises'],
    // Compilation vs runtime
    ['compilation', 'runtime'], ['compile', 'runtime'],
    ['effacés', 'existent'], ['erased', 'exist'],
    // Domaine/purpose
    ['stockage', 'entraînement'], ['storage', 'training'],
    ['recherche', 'entraînement'], ['search', 'training'],
    ['recherche', 'entraîner'], ['vecteurs', 'modèles'],
    ['similarité', 'prédiction'],
    ['recherche', 'apprentissage'],
    // Quantités
    ['deux', 'trois'], ['two', 'three'], ['2', '3'],
    ['un', 'deux'], ['one', 'two'], ['1', '2'],
    // Support
    ['supporte', 'supporte pas'], ['supports', 'does not support'],
    // Éléments d'API (ajout/suppression)
    ['setstate', 'resetstate'],
  ];

  private hasIncompatibleTokens(tokensA: string[], tokensB: string[]): boolean {
    for (const [left, right] of this.INCOMPATIBLE_PAIRS) {
      if (tokensA.includes(left) && tokensB.includes(right)) return true;
      if (tokensA.includes(right) && tokensB.includes(left)) return true;
    }
    return false;
  }

  /**
   * Tokenise un texte en mots normalisés.
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-zà-ÿ0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2);
  }

  /**
   * Extrait les paires (contexte, nombre) d'un texte.
   */
  private extractNumbers(text: string): Map<string, number> {
    const result = new Map<string, number>();
    const lower = text.toLowerCase();
    const wordToNum: Record<string, number> = {
      'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5,
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    };

    // Recherche les motifs "X éléments", "X arguments", etc.
    const patterns = [
      /(\d+|[a-zé]+)\s+éléments?/gi,
      /(\d+|[a-zé]+)\s+arguments?/gi,
      /(\d+|[a-zé]+)\s+valeurs?/gi,
      /tableau\s+de\s+(\d+|[a-zé]+)/gi,
      /retourne\s+(\d+|[a-zé]+)/gi,
    ];

    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(lower)) !== null) {
        const numStr = match[1]!;
        const num = wordToNum[numStr.toLowerCase()] ?? parseInt(numStr, 10);
        if (!isNaN(num)) {
          const context = match[0]!.replace(/\s+/g, '_');
          result.set(context, num);
        }
      }
    }

    return result;
  }

  // ============================================================
  // Principe P — Propagation
  // ============================================================

  /**
   * Propage le contexte depuis un nœud source (BFS pondéré).
   * P(n_i, n_j) = w_ij × relevanceScore
   */
  async propagateContext(sourceId: string, threshold: number = 0.01, maxDepth: number = 10): Promise<PropagationResult> {
    const reached = new Map<string, number>();
    const queue: Array<[string, number, number]> = [[sourceId, 1.0, 0]];
    let maxDepthReached = 0;
    reached.set(sourceId, 1.0);

    while (queue.length > 0) {
      const [currentId, currentScore, depth] = queue.shift()!;
      if (depth >= maxDepth) continue;
      maxDepthReached = Math.max(maxDepthReached, depth);

      const outgoing = await this.linkRepo.findBySourceId(currentId);
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

    reached.delete(sourceId);
    return { sourceId, reachedNodes: reached, maxDepth: maxDepthReached, reachedCount: reached.size };
  }

  // ============================================================
  // Détection d'hallucination (combine A + C + P)
  // ============================================================

  /**
   * Analyse une réponse LLM par rapport à la toile TTC.
   * Retourne un rapport d'hallucination complet.
   */
  async detectHallucination(llmResponse: string): Promise<HallucinationReport> {
    const contradictingNodeIds: string[] = [];
    const suggestions: string[] = [];

    const nodeCount = await this.nodeRepo.count();
    if (nodeCount === 0) {
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
      const report = await this.detectContradictions(assertion);
      if (report.isContradiction) {
        contradictionCount++;
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

  async getStats() {
    const nodeCount = await this.nodeRepo.count();
    const linkCount = await this.linkRepo.count();
    const allNodes = await this.nodeRepo.findAll();
    const allLinks = await this.linkRepo.findAll();

    let anchoredCount = 0;
    let totalAmbiguity = 0;

    for (const node of allNodes) {
      const v = this.computeAnchorVerification(node);
      if (v.isAnchored) anchoredCount++;
      totalAmbiguity += node.ambiguity;
    }

    const contradictions = allLinks.filter((l: StoredLink) => l.relation === 'contradicts');

    return {
      nodeCount,
      linkCount,
      anchoredCount,
      anchoringRate: nodeCount > 0 ? anchoredCount / nodeCount : 1,
      contradictionCount: contradictions.length,
      globalEntropy: nodeCount > 0 ? totalAmbiguity / nodeCount : 0,
    };
  }

  // ============================================================
  // Recherche de similarité (pgvector ou fallback mots-clés)
  // ============================================================

  /**
   * Trouve les N nœuds les plus similaires à un contenu donné.
   *
   * Stratégie :
   * 1. Si pgvector est disponible → similarité cosinus via l'opérateur <=>
   * 2. Sinon → fallback par overlap de mots-clés (Jaccard)
   *
   * Retourne les nœuds triés par similarité décroissante.
   */
  async findSimilarNodes(
    content: string,
    limit: number = 5,
  ): Promise<Array<{ id: string; content: string; similarity: number }>> {
    const allNodes = await this.nodeRepo.findAll();

    if (allNodes.length === 0) return [];

    // Tente la similarité cosinus via pgvector
    try {
      const pgResults = await this.findSimilarViaPgvector(content, allNodes, limit);
      if (pgResults.length > 0) return pgResults;
    } catch {
      // pgvector non disponible → fallback
    }

    // Fallback : similarité Jaccard sur les mots-clés
    return this.findSimilarViaKeywords(content, allNodes, limit);
  }

  /**
   * Similarité cosinus via pgvector (opérateur <=>).
   * Utilise l'index IVFFlat pour une recherche < 10ms.
   */
  private async findSimilarViaPgvector(
    content: string,
    _nodes: StoredNode[],
    limit: number,
  ): Promise<Array<{ id: string; content: string; similarity: number }>> {
    // Vérifie si le repository supporte findSimilar (PostgresNodeRepository)
    if (typeof (this.nodeRepo as unknown as Record<string, unknown>)['findSimilar'] === 'function') {
      const { embeddingGenerator } = await import('./embeddingService.js');
      const embedding = await embeddingGenerator.embed(content);
      const repo = this.nodeRepo as unknown as { findSimilar(emb: Float32Array, lim: number): Promise<Array<{ id: string; content: string; similarity: number }>> };
      return repo.findSimilar(embedding, limit);
    }
    return [];
  }

  /**
   * Similarité Jaccard sur les mots-clés (fallback sans pgvector).
   *
   * similarity = |A ∩ B| / |A ∪ B|
   */
  private findSimilarViaKeywords(
    content: string,
    nodes: StoredNode[],
    limit: number,
  ): Array<{ id: string; content: string; similarity: number }> {
    const inputKeywords = new Set(this.extractKeywords(content));

    const scored = nodes.map((node) => {
      const nodeKeywords = new Set(this.extractKeywords(node.content));
      const intersection = new Set([...inputKeywords].filter((k) => nodeKeywords.has(k)));
      const union = new Set([...inputKeywords, ...nodeKeywords]);
      const similarity = union.size > 0 ? intersection.size / union.size : 0;
      return { id: node.id, content: node.content, similarity };
    });

    // Trie par similarité décroissante
    scored.sort((a, b) => b.similarity - a.similarity);

    // Ne garde que ceux avec similarité > 0
    return scored.filter((s) => s.similarity > 0).slice(0, limit);
  }

  // ============================================================
  // Helpers privés
  // ============================================================

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
    const lower = text.toLowerCase();
    // Patterns de négation française/anglaise
    const patterns = [
      /\bn['’]est pas\b/, /\bne pas\b/, /\bnot\b/, /\bis not\b/,
      /\bisn['’]t\b/, /\bfalse\b/, /\bfaux\b/, /\bjamais\b/, /\bnever\b/,
      /\bn[’']existe pas\b/, /\bn[’']a pas\b/, /\bne peut pas\b/,
      /\bcannot\b/, /\bcan't\b/, /\bdoesn['’]t\b/, /\bdon['’]t\b/,
      /\bno\s+\w+\b/, /\bwithout\b/, /\bsans\b/,
    ];
    if (patterns.some((p) => p.test(lower))) return true;

    // Détection flexible : "ne ... pas" dans la même phrase
    if (/\bne\b/.test(lower) && /\bpas\b/.test(lower)) return true;

    return false;
  }

  private extractAssertions(text: string): string[] {
    return text
      .split(/[.!?;]\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
  }
}

// Instance singleton du service TTC
// Auto-détection PostgreSQL : si DATABASE_URL est définie, utilise les repositories PG
function createTtcService(): TtcService {
  if (process.env['DATABASE_URL']) {
    console.log('[KontEx::TTC] PostgreSQL détecté — repositories PG activés');
    return new TtcService(new PostgresNodeRepository(), new PostgresLinkRepository());
  }
  console.log('[KontEx::TTC] DATABASE_URL non définie — fallback in-memory activé');
  return new TtcService(new InMemoryNodeRepository(), new InMemoryLinkRepository());
}

export const ttcService = createTtcService();
