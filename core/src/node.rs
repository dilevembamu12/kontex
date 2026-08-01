/// @anchor: PROJECT_CONTEXT.md §2.1 — Principe d'Ancrage A(f)
/// Nœud de la Toile Cosmologique.
/// Chaque nœud représente un fait, une règle, du code ou de la documentation.
///
/// # Principes TTC appliqués
/// - A1 : chaque nœud possède au moins un champ `sources` pour l'ancrage
/// - E1 : nommage explicite, aucun champ abrégé ambigu

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;

/// Type de nœud dans la toile contextuelle.
/// @anchor: PROJECT_CONTEXT.md §2.2 — Structure de la Toile
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum NodeKind {
    /// Nœud de fait — assertion vérifiable
    Fact,
    /// Nœud de règle — contrainte ou règle métier
    Rule,
    /// Nœud de code — fragment de code source
    Code,
    /// Nœud de documentation — référence documentaire
    Documentation,
}

/// Source vérifiable pour l'ancrage (Principe A).
/// @anchor: .cursorrules Règle A1 — Pas de code sans référence
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Anchor {
    /// URL, chemin de fichier ou identifiant de spec
    pub uri: String,
    /// Type de source (doc officielle, test, spec, etc.)
    pub source_type: AnchorType,
    /// Horodatage de l'ancrage
    pub anchored_at: DateTime<Utc>,
}

/// Catégorie de source d'ancrage.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AnchorType {
    OfficialDocumentation,
    TestCase,
    Specification,
    CodeRepository,
    PeerReview,
    Other(String),
}

/// Nœud de la Toile Cosmologique.
///
/// # Invariants
/// - Un nœud DOIT avoir au moins une source (Principe A)
/// - `weight` ∈ [0.0, 1.0] — pertinence du nœud dans la toile
/// - `ambiguity` ∈ [0.0, 1.0] — 0 = parfaitement clair, 1 = totalement ambigu
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    /// Identifiant unique du nœud
    pub id: Uuid,
    /// Type du nœud (Fait, Règle, Code, Documentation)
    pub kind: NodeKind,
    /// Contenu textuel du nœud
    pub content: String,
    /// Poids de pertinence dans la toile ∈ [0.0, 1.0]
    pub weight: f64,
    /// Niveau d'ambiguïté ∈ [0.0, 1.0] — utilisé pour E_min
    pub ambiguity: f64,
    /// Sources d'ancrage (Principe A)
    pub sources: Vec<Anchor>,
    /// Métadonnées libres (tags, contexte, etc.)
    pub metadata: HashSet<String>,
    /// Horodatage de création
    pub created_at: DateTime<Utc>,
    /// Horodatage de dernière modification
    pub updated_at: DateTime<Utc>,
}

impl Node {
    /// Construit un nouveau nœud.
    /// @side-effect: génère un UUID v4
    ///
    /// # Panics
    /// - Si `weight` ∉ [0.0, 1.0]
    /// - Si `ambiguity` ∉ [0.0, 1.0]
    /// - Si `sources` est vide (violation du Principe A)
    pub fn new(
        kind: NodeKind,
        content: String,
        weight: f64,
        ambiguity: f64,
        sources: Vec<Anchor>,
    ) -> Self {
        assert!(
            (0.0..=1.0).contains(&weight),
            "Node::new: weight doit être ∈ [0.0, 1.0], reçu {weight}"
        );
        assert!(
            (0.0..=1.0).contains(&ambiguity),
            "Node::new: ambiguity doit être ∈ [0.0, 1.0], reçu {ambiguity}"
        );
        assert!(
            !sources.is_empty(),
            "Node::new: violation du Principe A — au moins une source d'ancrage requise"
        );

        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            kind,
            content,
            weight,
            ambiguity,
            sources,
            metadata: HashSet::new(),
            created_at: now,
            updated_at: now,
        }
    }

    /// Construit un nœud avec un ID spécifique.
    /// Utilisé pour la synchronisation PG → Rust (l'UUID est déjà attribué).
    pub fn new_with_id(
        id: Uuid,
        kind: NodeKind,
        content: String,
        weight: f64,
        ambiguity: f64,
        sources: Vec<Anchor>,
    ) -> Self {
        assert!((0.0..=1.0).contains(&weight));
        assert!((0.0..=1.0).contains(&ambiguity));
        assert!(!sources.is_empty());
        let now = Utc::now();
        Self { id, kind, content, weight, ambiguity, sources, metadata: HashSet::new(), created_at: now, updated_at: now }
    }

    /// Vérifie si le nœud satisfait le Principe d'Ancrage.
    /// Fonction pure (E2).
    pub fn is_anchored(&self) -> bool {
        !self.sources.is_empty()
    }

    /// Calcule la « force d'ancrage » — nombre et qualité des sources.
    /// Fonction pure (E2).
    /// Retourne une valeur dans [0.0, 1.0] où 1.0 = ancrage maximal.
    pub fn anchor_strength(&self) -> f64 {
        if self.sources.is_empty() {
            return 0.0;
        }
        // Pondération : plus il y a de sources, plus c'est fort (avec saturation à 5)
        let count_factor = (self.sources.len() as f64).min(5.0) / 5.0;
        // Bonus pour les sources officielles
        let quality_factor: f64 = self.sources.iter().fold(0.0, |acc, anchor| {
            acc + match anchor.source_type {
                AnchorType::OfficialDocumentation | AnchorType::Specification => 0.3,
                AnchorType::TestCase | AnchorType::CodeRepository => 0.2,
                AnchorType::PeerReview => 0.15,
                AnchorType::Other(_) => 0.1,
            }
        });
        (count_factor * 0.5 + quality_factor.min(0.5_f64)).min(1.0_f64)
    }
}
