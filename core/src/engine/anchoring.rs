/// @anchor: PROJECT_CONTEXT.md §2.1 — Principe d'Ancrage A(f)
/// Vérification et renforcement de l'ancrage des nœuds dans la toile.
///
/// # Formule TTC
/// A(f) ⟹ ∃s ∈ Sources : lien(f, s)
///
/// Chaque fait DOIT être relié à au moins une source vérifiable.

use crate::node::{Anchor, Node};

/// Résultat de la vérification d'ancrage d'un nœud.
#[derive(Debug, Clone)]
pub struct AnchorVerification {
    /// Le nœud est-il correctement ancré ?
    pub is_anchored: bool,
    /// Force d'ancrage ∈ [0.0, 1.0]
    pub strength: f64,
    /// Nombre de sources
    pub source_count: usize,
    /// Liste des sources manquantes (catégories absentes)
    pub missing_categories: Vec<String>,
    /// Diagnostic complet
    pub diagnostics: Vec<String>,
}

/// Vérifie l'ancrage d'un nœud selon le Principe A.
/// Fonction pure (E2).
///
/// # Règles d'ancrage
/// - Au moins 1 source (obligatoire)
/// - ≥ 2 sources pour un score maximal
/// - Une source officielle (doc ou spec) donne un bonus
pub fn verify_node_anchoring(node: &Node) -> AnchorVerification {
    let source_count = node.sources.len();
    let is_anchored = source_count > 0;
    let strength = node.anchor_strength();

    let mut diagnostics = Vec::new();
    let mut missing_categories = Vec::new();

    if !is_anchored {
        diagnostics.push(format!(
            "VIOLATION Principe A : le nœud {} n'a aucune source d'ancrage",
            node.id
        ));
        missing_categories.push("ANY_SOURCE".to_string());
    }

    if strength < 0.3 {
        diagnostics.push(format!(
            "ANCRAGE FAIBLE ({strength:.2}) : le nœud {} manque de sources robustes",
            node.id
        ));
    }

    // Vérifie la présence de sources officielles (bonus qualitatif)
    let has_official_source = node.sources.iter().any(|a| {
        matches!(
            a.source_type,
            crate::node::AnchorType::OfficialDocumentation
                | crate::node::AnchorType::Specification
        )
    });

    if !has_official_source && is_anchored {
        missing_categories.push("OFFICIAL_SOURCE".to_string());
        diagnostics.push(
            "Recommandation : ajouter une source officielle (documentation ou spécification)"
                .to_string(),
        );
    }

    AnchorVerification {
        is_anchored,
        strength,
        source_count,
        missing_categories,
        diagnostics,
    }
}

/// Vérifie l'ancrage de tous les nœuds d'une toile.
/// Retourne la liste des violations du Principe A.
/// Fonction pure (E2) — itération sans modification.
pub fn verify_all_anchors(nodes: &[&Node]) -> Vec<AnchorVerification> {
    nodes.iter().map(|node| verify_node_anchoring(node)).collect()
}

/// Calcule le taux d'ancrage d'un ensemble de nœuds.
/// Retourne le pourcentage de nœuds correctement ancrés.
/// Fonction pure (E2).
pub fn compute_anchoring_rate(verifications: &[AnchorVerification]) -> f64 {
    if verifications.is_empty() {
        return 1.0; // Ensemble vide = pas de violation
    }
    let anchored_count = verifications.iter().filter(|v| v.is_anchored).count();
    anchored_count as f64 / verifications.len() as f64
}

/// Ajoute une source d'ancrage à un nœud mutable.
/// @side-effect: modifie le nœud.
pub fn anchor_node(node: &mut Node, anchor: Anchor) {
    node.sources.push(anchor);
}
