/// @anchor: PROJECT_CONTEXT.md §2.1 — Principe de Cohérence C(n₁, n₂)
/// Détection et résolution des contradictions dans la toile.
///
/// # Formule TTC
/// C(n₁, n₂) ⟹ ¬(n₁ ⊕ n₂) ∨ résolu(n₁, n₂)
///
/// Aucune contradiction ne peut exister dans la toile sans résolution explicite.

use std::collections::HashSet;
use uuid::Uuid;

use crate::web::ContextWeb;

/// Résultat de l'analyse de cohérence entre deux nœuds.
#[derive(Debug, Clone)]
pub struct CoherenceAnalysis {
    /// Les deux nœuds sont-ils cohérents ?
    pub is_coherent: bool,
    /// Identifiants des nœuds analysés
    pub node_a: Uuid,
    pub node_b: Uuid,
    /// Liste des contradictions détectées
    pub contradictions: Vec<String>,
    /// Résolution proposée (si applicable)
    pub suggested_resolution: Option<String>,
}

/// Détecte les contradictions entre deux nœuds.
///
/// Stratégie simplifiée (Phase 0) :
/// - Vérifie si un lien `Contradicts` existe entre les nœuds
/// - Compare les contenus pour détecter des négations simples
///
/// Fonction pure (E2).
pub fn detect_contradiction(web: &ContextWeb, node_a: &Uuid, node_b: &Uuid) -> CoherenceAnalysis {
    let mut contradictions = Vec::new();
    let mut is_coherent = true;

    // Vérifie les liens contradictoires directs
    let outgoing = web.outgoing_links(node_a);
    let has_contradiction_link = outgoing
        .iter()
        .any(|link| &link.target_id == node_b && link.is_contradiction());

    if has_contradiction_link {
        is_coherent = false;
        contradictions.push(format!(
            "Lien de contradiction explicite entre {node_a} et {node_b}"
        ));
    }

    // Vérifie les contradictions bidirectionnelles
    let incoming = web.incoming_links(node_b);
    let has_reverse_contradiction = incoming
        .iter()
        .any(|link| &link.source_id == node_a && link.is_contradiction());

    if has_reverse_contradiction {
        is_coherent = false;
        contradictions.push(format!(
            "Contradiction inverse détectée entre {node_b} et {node_a}"
        ));
    }

    // Analyse textuelle basique : détection de négations
    if let (Some(node_a_data), Some(node_b_data)) = (web.get_node(node_a), web.get_node(node_b)) {
        let content_a_lower = node_a_data.content.to_lowercase();
        let content_b_lower = node_b_data.content.to_lowercase();

        // Détection simple : "X est Y" vs "X n'est pas Y"
        let negation_patterns = [
            "n'est pas",
            "ne pas",
            "not ",
            "is not",
            "isn't",
            "false",
            "faux",
        ];

        let a_has_negation = negation_patterns
            .iter()
            .any(|p| content_a_lower.contains(p));
        let b_has_negation = negation_patterns
            .iter()
            .any(|p| content_b_lower.contains(p));

        // Si l'un nie ce que l'autre affirme, il y a potentiellement contradiction
        if a_has_negation != b_has_negation {
            // Vérifie si les sujets sont similaires (heuristique simple)
            let words_a: HashSet<&str> = content_a_lower.split_whitespace().collect();
            let words_b: HashSet<&str> = content_b_lower.split_whitespace().collect();
            let intersection: HashSet<_> = words_a.intersection(&words_b).collect();

            if intersection.len() >= 2 {
                is_coherent = false;
                contradictions.push(format!(
                    "Contradiction sémantique potentielle : les nœuds partagent {} mots clés mais divergent sur une affirmation",
                    intersection.len()
                ));
            }
        }
    }

    let suggested_resolution = if !is_coherent {
        Some(format!(
            "@resolution: examiner {node_a} et {node_b} — vérifier les sources d'ancrage respectives et trancher selon la force d'ancrage"
        ))
    } else {
        None
    };

    CoherenceAnalysis {
        is_coherent,
        node_a: *node_a,
        node_b: *node_b,
        contradictions,
        suggested_resolution,
    }
}

/// Vérifie la cohérence globale de la toile.
/// Parcourt toutes les paires de nœuds liés par contradiction.
/// Fonction pure (E2) — ne modifie pas la toile.
pub fn verify_global_coherence(web: &ContextWeb) -> Vec<CoherenceAnalysis> {
    let contradictions = web.contradictions();
    let mut analyses = Vec::with_capacity(contradictions.len());

    for contradiction_link in contradictions {
        let analysis = detect_contradiction(
            web,
            &contradiction_link.source_id,
            &contradiction_link.target_id,
        );
        if !analysis.is_coherent {
            analyses.push(analysis);
        }
    }

    analyses
}

/// Résout automatiquement une contradiction en comparant les forces d'ancrage.
/// Le nœud avec la force d'ancrage la plus faible est marqué comme « résolu ».
/// @side-effect: supprime le lien contradictoire si une résolution est trouvée.
///
/// # Returns
/// - `Ok(String)` décrivant la résolution
/// - `Err(String)` si la résolution automatique est impossible
pub fn auto_resolve_contradiction(
    web: &mut ContextWeb,
    node_a: &Uuid,
    node_b: &Uuid,
) -> Result<String, String> {
    let strength_a = web
        .get_node(node_a)
        .map(|n| n.anchor_strength())
        .ok_or_else(|| format!("Nœud {node_a} introuvable"))?;

    let strength_b = web
        .get_node(node_b)
        .map(|n| n.anchor_strength())
        .ok_or_else(|| format!("Nœud {node_b} introuvable"))?;

    // Supprime la contradiction
    web.resolve_contradiction(node_a, node_b)?;

    let (stronger, weaker, strong_score, weak_score) = if strength_a >= strength_b {
        (node_a, node_b, strength_a, strength_b)
    } else {
        (node_b, node_a, strength_b, strength_a)
    };

    Ok(format!(
        "@resolution: contradiction résolue — {stronger} (ancrage {strong_score:.2}) > {weaker} (ancrage {weak_score:.2})"
    ))
}
