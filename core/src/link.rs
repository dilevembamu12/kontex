/// @anchor: PROJECT_CONTEXT.md §2.1 — Principe de Propagation P(n_i, n_j)
/// Lien pondéré entre deux nœuds de la toile.
///
/// # Formule TTC
/// P(n_i, n_j) = w_{ij} · relevance(n_i, n_j)

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Type de relation entre deux nœuds.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum RelationKind {
    /// Le nœud source dépend du nœud cible
    DependsOn,
    /// Le nœud source contredit le nœud cible
    Contradicts,
    /// Le nœud source raffine/détaille le nœud cible
    Refines,
    /// Le nœud source est un exemple du nœud cible
    Exemplifies,
    /// Le nœud source référence le nœud cible
    References,
    /// Relation personnalisée
    Custom(String),
}

/// Lien pondéré entre deux nœuds de la toile.
///
/// # Invariants
/// - `weight` ∈ [0.0, 1.0]
/// - `source_id != target_id` (pas d'auto-lien)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Link {
    /// Identifiant unique du lien
    pub id: Uuid,
    /// Nœud source
    pub source_id: Uuid,
    /// Nœud cible
    pub target_id: Uuid,
    /// Type de relation
    pub relation: RelationKind,
    /// Poids de pertinence ∈ [0.0, 1.0]
    pub weight: f64,
    /// Score de pertinence contextuelle
    pub relevance_score: f64,
}

impl Link {
    /// Construit un nouveau lien entre deux nœuds.
    /// Fonction pure (E2).
    ///
    /// # Panics
    /// - Si `weight` ∉ [0.0, 1.0]
    /// - Si `source_id == target_id`
    pub fn new(
        source_id: Uuid,
        target_id: Uuid,
        relation: RelationKind,
        weight: f64,
        relevance_score: f64,
    ) -> Self {
        assert!(
            (0.0..=1.0).contains(&weight),
            "Link::new: weight doit être ∈ [0.0, 1.0], reçu {weight}"
        );
        assert_ne!(
            source_id, target_id,
            "Link::new: un lien ne peut pas pointer vers lui-même"
        );

        Self {
            id: Uuid::new_v4(),
            source_id,
            target_id,
            relation,
            weight,
            relevance_score,
        }
    }

    /// Calcule la force de propagation selon la formule TTC.
    /// P(n_i, n_j) = w_{ij} · relevance(n_i, n_j)
    /// Fonction pure (E2).
    pub fn propagation_force(&self) -> f64 {
        self.weight * self.relevance_score
    }

    /// Vérifie si ce lien est une contradiction non résolue.
    /// Fonction pure (E2).
    pub fn is_contradiction(&self) -> bool {
        self.relation == RelationKind::Contradicts
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_link_propagation_force() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let link = Link::new(a, b, RelationKind::DependsOn, 0.8, 0.9);
        // P = 0.8 * 0.9 = 0.72
        assert!((link.propagation_force() - 0.72).abs() < f64::EPSILON);
    }

    #[test]
    fn test_link_contradiction_detection() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let contradicts = Link::new(a, b, RelationKind::Contradicts, 1.0, 1.0);
        assert!(contradicts.is_contradiction());

        let depends = Link::new(a, b, RelationKind::DependsOn, 0.5, 0.5);
        assert!(!depends.is_contradiction());
    }

    #[test]
    #[should_panic(expected = "un lien ne peut pas pointer vers lui-même")]
    fn test_no_self_link() {
        let a = Uuid::new_v4();
        Link::new(a, a, RelationKind::References, 1.0, 1.0);
    }
}
