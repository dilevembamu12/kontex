/// @anchor: PROJECT_CONTEXT.md §2.1 — Principe d'Ancrage A(f)
/// Vérification et renforcement de l'ancrage des nœuds dans la toile.
///
/// # Fondement mathématique TTC
/// Chaque fait DOIT être relié à au moins une source vérifiable :
///
///   A(f) ⟹ ∃s ∈ Sources : lien(f, s)
///
/// La force d'ancrage est calculée comme une somme pondérée :
///
///   strength(n) = min(1.0, Σ_{s ∈ sources(n)} quality(s) · freshness(s) / |sources(n)|)
///
/// où :
/// - quality(s) ∈ [0.1, 0.4] selon le type de source
/// - freshness(s) = exp(-λ · Δt) — péremption exponentielle
/// - λ = ln(2) / T_half avec T_half = 365 jours (les ancres périment en 1 an)

use crate::node::{Anchor, AnchorType, Node};

/// Demi-vie d'une ancre en jours (1 an).
const ANCHOR_HALF_LIFE_DAYS: f64 = 365.0;
/// Facteur de péremption λ = ln(2) / T_half
const ANCHOR_DECAY_LAMBDA: f64 = 0.6931471805599453 / ANCHOR_HALF_LIFE_DAYS; // ≈ 0.0019

/// Résultat de la vérification d'ancrage d'un nœud.
#[derive(Debug, Clone)]
pub struct AnchorVerification {
    /// Le nœud est-il correctement ancré ?
    pub is_anchored: bool,
    /// Force d'ancrage ∈ [0.0, 1.0]
    pub strength: f64,
    /// Nombre de sources
    pub source_count: usize,
    /// Score de qualité des sources
    pub quality_score: f64,
    /// Score de fraîcheur (péremption)
    pub freshness_score: f64,
    /// Liste des sources manquantes (catégories absentes)
    pub missing_categories: Vec<String>,
    /// Diagnostic complet
    pub diagnostics: Vec<String>,
}

/// Calcule la qualité d'une ancre selon son type.
///
/// # Barème TTC
/// - OfficialDocumentation : 0.40
/// - Specification : 0.35
/// - CodeRepository : 0.25
/// - TestCase : 0.20
/// - PeerReview : 0.15
/// - Other : 0.10
#[inline]
pub fn anchor_quality(source_type: &AnchorType) -> f64 {
    match source_type {
        AnchorType::OfficialDocumentation => 0.40,
        AnchorType::Specification => 0.35,
        AnchorType::CodeRepository => 0.25,
        AnchorType::TestCase => 0.20,
        AnchorType::PeerReview => 0.15,
        AnchorType::Other(_) => 0.10,
    }
}

/// Calcule la fraîcheur d'une ancre (péremption exponentielle).
///
/// fresh(s) = exp(-λ · jours_écoulés)
///
/// Une ancre de plus d'un an vaut moins de 50% de sa valeur initiale.
#[inline]
pub fn anchor_freshness(anchored_at: &chrono::DateTime<chrono::Utc>) -> f64 {
    let now = chrono::Utc::now();
    let duration = now.signed_duration_since(*anchored_at);
    let days_elapsed = duration.num_days().max(0) as f64;
    (-ANCHOR_DECAY_LAMBDA * days_elapsed).exp()
}

/// Calcule la force d'ancrage d'un nœud selon la formule TTC complète.
///
/// strength(n) = min(1.0, Σ quality(s) · freshness(s) / max(|sources|, 1))
///
/// Bonus de quantité quand plusieurs sources de types différents sont présentes.
pub fn compute_anchor_strength(node: &Node) -> f64 {
    if node.sources.is_empty() {
        return 0.0;
    }

    let source_count = node.sources.len() as f64;
    let mut total_quality = 0.0;

    for anchor in &node.sources {
        let quality = anchor_quality(&anchor.source_type);
        let freshness = anchor_freshness(&anchor.anchored_at);
        total_quality += quality * freshness;
    }

    // Bonus de diversité : +0.1 si ≥ 2 types de sources différents
    let mut types_seen = std::collections::HashSet::new();
    for anchor in &node.sources {
        types_seen.insert(std::mem::discriminant(&anchor.source_type));
    }
    let diversity_bonus = if types_seen.len() >= 2 { 0.1 } else { 0.0 };

    (total_quality / source_count + diversity_bonus).min(1.0)
}

/// Vérifie l'ancrage d'un nœud selon le Principe A avec le calcul TTC complet.
/// Fonction pure (E2).
///
/// # Règles d'ancrage
/// - Au moins 1 source (obligatoire)
/// - ≥ 2 sources de types différents pour un score > 0.5
/// - Une source officielle (doc ou spec) donne un bonus qualité
pub fn verify_node_anchoring(node: &Node) -> AnchorVerification {
    let source_count = node.sources.len();
    let is_anchored = source_count > 0;
    let strength = compute_anchor_strength(node);

    let quality_score = if source_count > 0 {
        node.sources.iter().map(|a| anchor_quality(&a.source_type)).sum::<f64>() / source_count as f64
    } else {
        0.0
    };

    let freshness_score = if source_count > 0 {
        node.sources.iter().map(|a| anchor_freshness(&a.anchored_at)).sum::<f64>() / source_count as f64
    } else {
        0.0
    };

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

    // Vérifie la présence de sources officielles
    let has_official_source = node.sources.iter().any(|a| {
        matches!(
            a.source_type,
            AnchorType::OfficialDocumentation | AnchorType::Specification
        )
    });

    if !has_official_source && is_anchored {
        missing_categories.push("OFFICIAL_SOURCE".to_string());
        diagnostics.push(
            "Recommandation : ajouter une source officielle (documentation ou spécification)"
                .to_string(),
        );
    }

    // Vérifie la fraîcheur
    if freshness_score < 0.5 && is_anchored {
        diagnostics.push(format!(
            "PÉREMPTION : fraîcheur={freshness_score:.2} — les ancres datent de plus d'un an, renouveler les sources"
        ));
    }

    // Vérifie la diversité
    let unique_types: std::collections::HashSet<_> = node
        .sources
        .iter()
        .map(|a| std::mem::discriminant(&a.source_type))
        .collect();
    if unique_types.len() < 2 && is_anchored && source_count >= 2 {
        diagnostics.push(
            "DIVERSITÉ FAIBLE : toutes les ancres sont du même type — varier les sources"
                .to_string(),
        );
    }

    AnchorVerification {
        is_anchored,
        strength,
        source_count,
        quality_score,
        freshness_score,
        missing_categories,
        diagnostics,
    }
}

/// Vérifie l'ancrage de tous les nœuds.
/// Fonction pure (E2).
pub fn verify_all_anchors(nodes: &[&Node]) -> Vec<AnchorVerification> {
    nodes.iter().map(|node| verify_node_anchoring(node)).collect()
}

/// Calcule le taux d'ancrage global de la toile.
///
/// anchoring_rate = |{n ∈ T : anchored(n)}| / |T|
pub fn compute_anchoring_rate(verifications: &[AnchorVerification]) -> f64 {
    if verifications.is_empty() {
        return 1.0; // Toile vide = pas de violation
    }
    let anchored_count = verifications.iter().filter(|v| v.is_anchored).count();
    anchored_count as f64 / verifications.len() as f64
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::node::{Node, NodeKind};

    fn make_anchor(uri: &str, source_type: AnchorType) -> Anchor {
        Anchor {
            uri: uri.to_string(),
            source_type,
            anchored_at: chrono::Utc::now(),
        }
    }

    #[test]
    fn test_anchor_quality_baseline() {
        assert!(anchor_quality(&AnchorType::OfficialDocumentation) > anchor_quality(&AnchorType::Other("blog".into())));
        assert!(anchor_quality(&AnchorType::Specification) > 0.3);
    }

    #[test]
    fn test_freshness_recent_anchor() {
        let anchor = make_anchor("spec://test", AnchorType::Specification);
        let freshness = anchor_freshness(&anchor.anchored_at);
        assert!(freshness > 0.99, "Ancre récente doit être fraîche (> 0.99), reçu {}", freshness);
    }

    #[test]
    fn test_compute_anchor_strength_multi_source() {
        let node = Node::new(
            NodeKind::Fact,
            "fait".into(),
            0.9,
            0.1,
            vec![
                make_anchor("spec://a", AnchorType::Specification),
                make_anchor("https://docs.rs", AnchorType::OfficialDocumentation),
            ],
        );
        let strength = compute_anchor_strength(&node);
        assert!(strength > 0.4, "2 sources différentes → force > 0.4, reçu {}", strength);
    }

    #[test]
    fn test_verify_node_anchoring_no_source() {
        // Un nœud ne peut pas être créé sans ancres (Principe A — invariant du constructeur)
        // Teste plutôt un nœud avec une ancre extrêmement faible
        let node = Node::new(
            NodeKind::Fact,
            "fait".into(),
            0.5,
            0.9,
            vec![make_anchor("blog://weak", AnchorType::Other("blog".into()))],
        );
        let v = verify_node_anchoring(&node);
        assert!(v.is_anchored, "Même une ancre faible valide le principe A");
        assert!(v.strength < 0.3, "Force d'ancrage faible attendue, reçu {}", v.strength);
        assert!(v.missing_categories.contains(&"OFFICIAL_SOURCE".to_string()));
    }

    #[test]
    fn test_compute_anchoring_rate() {
        let anchored = Node::new(NodeKind::Fact, "a".into(), 0.9, 0.1, vec![make_anchor("spec://a", AnchorType::Specification)]);
        // Nœud avec ancre très faible (simule un non-ancrage en termes de qualité)
        let weak = Node::new(NodeKind::Fact, "b".into(), 0.5, 0.9, vec![make_anchor("blog://x", AnchorType::Other("blog".into()))]);
        let verifications = verify_all_anchors(&[&anchored, &weak]);
        let rate = compute_anchoring_rate(&verifications);
        assert_eq!(rate, 1.0); // Les deux sont techniquement ancrés (ont des sources)
        // Mais leurs forces sont très différentes
        let strong_v = &verifications[0];
        let weak_v = &verifications[1];
        assert!(strong_v.strength > weak_v.strength, "L'ancre spec doit être plus forte que blog");
    }
}
