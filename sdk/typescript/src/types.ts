/// @anchor: SDK KontEx — Types fondamentaux partagés
/// Représente les types de la Toile Cosmologique côté client.
///
/// # Principes TTC
/// - A1 : chaque type a un champ `anchors` ou `sources`
/// - E1 : nommage explicite, pas d'abréviations ambiguës

// ============================================================
// Types alignés sur le moteur Rust core/src/node.rs
// ============================================================

/**
 * Type de nœud dans la toile contextuelle.
 * @anchor: PROJECT_CONTEXT.md §2.2 — Structure de la Toile
 */
export type NodeKind = 'fact' | 'rule' | 'code' | 'documentation';

/**
 * Catégorie de source d'ancrage.
 */
export type AnchorType =
  | 'official_documentation'
  | 'test_case'
  | 'specification'
  | 'code_repository'
  | 'peer_review'
  | 'other';

/**
 * Source vérifiable pour l'ancrage (Principe A).
 * @anchor: .cursorrules Règle A1 — Pas de code sans référence
 */
export interface Anchor {
  /** URI, chemin de fichier ou identifiant de spec */
  readonly uri: string;
  /** Type de source */
  readonly sourceType: AnchorType;
  /** Description optionnelle */
  readonly description?: string;
}

/**
 * Nœud de la Toile Cosmologique.
 */
export interface ContextNode {
  /** Identifiant unique (UUID v4) */
  readonly id: string;
  /** Type du nœud */
  readonly kind: NodeKind;
  /** Contenu textuel */
  readonly content: string;
  /** Poids de pertinence ∈ [0, 1] */
  readonly weight: number;
  /** Niveau d'ambiguïté ∈ [0, 1] */
  readonly ambiguity: number;
  /** Sources d'ancrage (Principe A) */
  readonly anchors: readonly Anchor[];
  /** Métadonnées (tags, contexte) */
  readonly metadata: ReadonlySet<string>;
  /** Timestamp ISO 8601 */
  readonly createdAt: string;
}

/**
 * Type de relation entre deux nœuds.
 */
export type RelationKind =
  | 'depends_on'
  | 'contradicts'
  | 'refines'
  | 'exemplifies'
  | 'references'
  | 'custom';

/**
 * Lien pondéré entre deux nœuds.
 * P(n_i, n_j) = weight × relevanceScore
 */
export interface ContextLink {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly relation: RelationKind;
  readonly weight: number;
  readonly relevanceScore: number;
}

// ============================================================
// Types pour l'API REST
// ============================================================

/**
 * Réponse du endpoint GET /health.
 */
export interface HealthReport {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly timestamp: string;
  readonly uptime: number;
  readonly version: string;
  readonly components: readonly ComponentHealth[];
}

/**
 * État de santé d'un composant.
 */
export interface ComponentHealth {
  readonly component: string;
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly latencyMs: number;
  readonly message: string;
}

// ============================================================
// Types pour la validation TTC
// ============================================================

/**
 * Résultat de la vérification d'ancrage d'un nœud.
 */
export interface AnchorVerification {
  /** Le nœud est-il correctement ancré ? */
  readonly isAnchored: boolean;
  /** Force d'ancrage ∈ [0, 1] */
  readonly strength: number;
  /** Nombre de sources */
  readonly sourceCount: number;
  /** Catégories de sources manquantes */
  readonly missingCategories: readonly string[];
}

/**
 * Résultat de la détection d'hallucination.
 */
export interface HallucinationReport {
  /** La réponse est-elle une hallucination ? */
  readonly isHallucination: boolean;
  /** Score de confiance ∈ [0, 1] (1 = pas d'hallucination) */
  readonly confidence: number;
  /** Nœuds de la toile qui contredisent la réponse */
  readonly contradictingNodes: readonly ContextNode[];
  /** Suggestions de correction */
  readonly suggestions: readonly string[];
}
