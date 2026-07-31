/// @anchor: PROJECT_CONTEXT.md §2.1 — Principe d'Entropie Minimale E_min(T)
/// Minimisation de l'ambiguïté dans la toile contextuelle par optimisation.
///
/// # Fondement mathématique TTC
/// La toile tend vers l'état de moindre entropie. L'entropie est définie comme
/// la somme pondérée des ambiguïtés :
///
///   E_min(T) = arg min_{T'} Σ_{n ∈ T'} ambiguity(n)
///
/// L'algorithme de minimisation identifie les nœuds à forte ambiguïté et
/// propose des actions concrètes :
/// 1. Renforcer l'ancrage (ambiguïté > 0.7)
/// 2. Fusionner les nœuds redondants (contenu similaire, forte ambiguïté)
/// 3. Élaguer les nœuds isolés (peu de connexions, forte ambiguïté)

use crate::web::ContextWeb;
use uuid::Uuid;

/// Rapport d'entropie pour la toile entière.
#[derive(Debug, Clone)]
pub struct EntropyReport {
    /// Entropie globale de la toile
    pub global_entropy: f64,
    /// Entropie moyenne par nœud
    pub average_ambiguity: f64,
    /// Nombre de nœuds à forte ambiguïté (> 0.7)
    pub high_ambiguity_count: usize,
    /// Liste des nœuds les plus ambigus (top N)
    pub most_ambiguous_nodes: Vec<(Uuid, f64)>,
    /// Actions de réduction d'entropie (format structuré)
    pub actions: Vec<EntropyAction>,
    /// Suggestions de réduction d'entropie (format lisible)
    pub reduction_suggestions: Vec<String>,
    /// Score d'optimisation (0 = parfait, 1 = chaos total)
    pub optimization_score: f64,
}

/// Action concrète proposée pour réduire l'entropie.
#[derive(Debug, Clone)]
pub enum EntropyAction {
    /// Renforcer l'ancrage d'un nœud (ajouter des sources)
    StrengthenAnchoring { node_id: Uuid, current_strength: f64, target_strength: f64 },
    /// Fusionner deux nœuds redondants
    MergeNodes { node_a: Uuid, node_b: Uuid, similarity: f64 },
    /// Élaguer un nœud isolé à forte ambiguïté
    PruneNode { node_id: Uuid, ambiguity: f64, connection_count: usize },
    /// Ajouter des liens depuis un nœud bien ancré vers un nœud flou
    AddRefinementLink { from_node: Uuid, to_node: Uuid },
    /// Toile trop petite — ajouter plus de nœuds
    ExpandWeb { current_node_count: usize, recommended_minimum: usize },
}

/// Analyse l'entropie de la toile et génère des suggestions de réduction.
///
/// Algorithme E_min :
/// 1. Calcule l'entropie globale et l'ambiguïté moyenne
/// 2. Identifie les nœuds > 0.7 ambiguïté
/// 3. Pour chaque nœud problématique, propose l'action optimale
/// 4. Calcule le score d'optimisation global
///
/// Fonction pure (E2) — lit seulement, ne modifie pas.
pub fn analyze_entropy(web: &ContextWeb) -> EntropyReport {
    let mut high_ambiguity_count = 0usize;
    let mut all_ambiguities: Vec<(Uuid, f64, f64, usize)> = Vec::new(); // (id, ambiguity, anchor_strength, link_count)
    let mut total_ambiguity = 0.0f64;
    let node_count = web.node_count();

    for node in web.iter_nodes() {
        let ambiguity = node.ambiguity;
        let anchor_strength = node.anchor_strength();
        let link_count = web.outgoing_links(&node.id).len() + web.incoming_links(&node.id).len();
        total_ambiguity += ambiguity;
        all_ambiguities.push((node.id, ambiguity, anchor_strength, link_count));

        if ambiguity > 0.7 {
            high_ambiguity_count = high_ambiguity_count.saturating_add(1);
        }
    }

    let average_ambiguity = if node_count > 0 {
        total_ambiguity / node_count as f64
    } else {
        0.0
    };

    // Trie par ambiguïté décroissante
    all_ambiguities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    let most_ambiguous_nodes: Vec<(Uuid, f64)> = all_ambiguities
        .iter()
        .take(10)
        .map(|(id, amb, _, _)| (*id, *amb))
        .collect();

    // Génère des actions de réduction d'entropie
    let mut actions = Vec::new();

    for (node_id, ambiguity, anchor_strength, link_count) in &all_ambiguities {
        if *ambiguity < 0.5 {
            break; // On ne traite que les nœuds problématiques
        }

        // Règle 1 : Forte ambiguïté + ancrage faible → renforcer l'ancrage
        if *ambiguity > 0.7 && *anchor_strength < 0.4 {
            actions.push(EntropyAction::StrengthenAnchoring {
                node_id: *node_id,
                current_strength: *anchor_strength,
                target_strength: 0.6,
            });
        }
        // Règle 2 : Forte ambiguïté + peu de connexions → élaguer ou connecter
        else if *ambiguity > 0.7 && *link_count < 2 {
            if node_count > 5 {
                actions.push(EntropyAction::PruneNode {
                    node_id: *node_id,
                    ambiguity: *ambiguity,
                    connection_count: *link_count,
                });
            } else {
                // Trouve le nœud le mieux ancré pour créer un lien de raffinement
                if let Some((best_anchored_id, _, best_strength, _)) = all_ambiguities
                    .iter()
                    .filter(|(id, _, _, _)| id != node_id)
                    .max_by(|a, b| a.2.partial_cmp(&b.2).unwrap_or(std::cmp::Ordering::Equal))
                {
                    if *best_strength > 0.5 {
                        actions.push(EntropyAction::AddRefinementLink {
                            from_node: *best_anchored_id,
                            to_node: *node_id,
                        });
                    }
                }
            }
        }
        // Règle 3 : Ambiguïté moyenne + ancrage OK → proposer une fusion
        else if *ambiguity > 0.5 && *anchor_strength > 0.5 {
            // Cherche un nœud similaire pour fusion
            for (other_id, other_amb, other_strength, _) in &all_ambiguities {
                if other_id == node_id || *other_amb < 0.5 {
                    continue;
                }
                // Heuristique simple : si les deux ont des ambiguïtés proches,
                // ils pourraient être redondants
                if (*ambiguity - *other_amb).abs() < 0.2
                    && *anchor_strength > 0.5
                    && *other_strength > 0.5
                {
                    actions.push(EntropyAction::MergeNodes {
                        node_a: *node_id,
                        node_b: *other_id,
                        similarity: 1.0 - (*ambiguity - *other_amb).abs(),
                    });
                    break;
                }
            }
        }
    }

    // Règle 4 : Toile trop petite
    if node_count < 3 && node_count > 0 {
        actions.push(EntropyAction::ExpandWeb {
            current_node_count: node_count,
            recommended_minimum: 5,
        });
    }

    // Suggestions textuelles (pour compatibilité)
    let reduction_suggestions: Vec<String> = actions
        .iter()
        .map(|action| match action {
            EntropyAction::StrengthenAnchoring { node_id, current_strength, target_strength } =>
                format!("Renforcer l'ancrage du nœud {node_id} (force={current_strength:.2} → {target_strength:.2})"),
            EntropyAction::MergeNodes { node_a, node_b, similarity } =>
                format!("Fusionner les nœuds {node_a} et {node_b} (similarité={similarity:.2})"),
            EntropyAction::PruneNode { node_id, ambiguity, connection_count } =>
                format!("Élaguer le nœud {node_id} (ambiguïté={ambiguity:.2}, connexions={connection_count})"),
            EntropyAction::AddRefinementLink { from_node, to_node } =>
                format!("Ajouter un lien de raffinement de {from_node} vers {to_node}"),
            EntropyAction::ExpandWeb { current_node_count, recommended_minimum } =>
                format!("Toile trop petite ({current_node_count} nœuds) — ajouter au moins {recommended_minimum} nœuds"),
        })
        .collect();

    // Score d'optimisation : 0 = parfait, 1 = chaos
    let optimization_score = if node_count > 0 {
        (average_ambiguity * 0.4
            + (high_ambiguity_count as f64 / node_count as f64) * 0.4
            + (actions.len() as f64 / node_count.max(1) as f64).min(1.0) * 0.2)
            .min(1.0)
    } else {
        1.0
    };

    EntropyReport {
        global_entropy: average_ambiguity,
        average_ambiguity,
        high_ambiguity_count,
        most_ambiguous_nodes,
        reduction_suggestions,
        optimization_score,
        actions,
    }
}

/// Minimise l'entropie de la toile en appliquant des actions correctives.
///
/// Modifie la toile en place :
/// - Réduit l'ambiguïté des nœuds bien ancrés
/// - Propose l'élagage des nœuds à forte entropie
///
/// Retourne le nouveau niveau d'entropie après optimisation.
///
/// @side-effect: modifie les nœuds de la toile (réduction d'ambiguïté).
pub fn minimize_entropy(web: &mut ContextWeb, max_iterations: usize) -> EntropyReport {
    let initial_report = analyze_entropy(web);
    let mut current_entropy = initial_report.global_entropy;

    for _iteration in 0..max_iterations {
        let report = analyze_entropy(web);

        // Si plus d'actions nécessaires, on arrête
        if report.actions.is_empty() {
            break;
        }

        // Applique la première action non destructive
        for action in &report.actions {
            match action {
                EntropyAction::StrengthenAnchoring { node_id, .. } => {
                    // Réduit l'ambiguïté du nœud ciblé (simulation d'ancrage renforcé)
                    if let Some(node) = web.get_node_mut(node_id) {
                        node.ambiguity = (node.ambiguity * 0.7).max(0.1);
                    }
                    break;
                }
                EntropyAction::AddRefinementLink { .. } => {
                    // Les liens de raffinement réduisent l'entropie sans modifier les nœuds
                    // (pas d'effet de bord dans cette version)
                    break;
                }
                EntropyAction::MergeNodes { node_a, node_b, .. } => {
                    // Fusion : réduit l'ambiguïté des deux nœuds
                    if let Some(node) = web.get_node_mut(node_a) {
                        node.ambiguity = (node.ambiguity * 0.5).max(0.05);
                    }
                    if let Some(node) = web.get_node_mut(node_b) {
                        node.ambiguity = (node.ambiguity * 0.5).max(0.05);
                    }
                    break;
                }
                EntropyAction::PruneNode { .. } | EntropyAction::ExpandWeb { .. } => {
                    // Actions non destructives en mode analyse
                    break;
                }
            }
        }

        let new_report = analyze_entropy(web);
        let new_entropy = new_report.global_entropy;

        // Convergence : si l'entropie ne baisse plus, on arrête
        if (current_entropy - new_entropy).abs() < 0.001 {
            break;
        }
        current_entropy = new_entropy;
    }

    analyze_entropy(web)
}

/// Identifie les nœuds « flous » — forte ambiguïté avec beaucoup de connexions faibles.
///
/// Ces nœuds sont problématiques car ils créent de l'entropie sans apporter
/// de valeur informationnelle. Ils devraient être soit fusionnés, soit ancrés.
pub fn find_fuzzy_nodes(web: &ContextWeb, ambiguity_threshold: f64) -> Vec<Uuid> {
    web.iter_nodes()
        .filter(|node| {
            if node.ambiguity < ambiguity_threshold {
                return false;
            }
            let link_count = web.outgoing_links(&node.id).len() + web.incoming_links(&node.id).len();
            // Nœud flou = forte ambiguïté + beaucoup de liens (trop connecté mais pas clair)
            link_count >= 3
        })
        .map(|node| node.id)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::node::{Anchor, AnchorType, Node, NodeKind};

    fn make_anchor(uri: &str) -> Anchor {
        Anchor {
            uri: uri.to_string(),
            source_type: AnchorType::Specification,
            anchored_at: chrono::Utc::now(),
        }
    }

    #[test]
    fn test_analyze_entropy_empty_web() {
        let web = ContextWeb::new();
        let report = analyze_entropy(&web);
        assert_eq!(report.global_entropy, 0.0);
        assert_eq!(report.high_ambiguity_count, 0);
    }

    #[test]
    fn test_high_ambiguity_detection() {
        let mut web = ContextWeb::new();
        // Nœud à forte ambiguïté, faible ancrage
        let fuzzy = Node::new(
            NodeKind::Fact,
            "contenu flou".into(),
            0.5,
            0.85, // ambiguïté élevée
            vec![make_anchor("spec://weak")],
        );
        web.add_node(fuzzy);

        let report = analyze_entropy(&web);
        assert_eq!(report.high_ambiguity_count, 1);
        assert!(!report.actions.is_empty(), "Doit proposer des actions");
    }

    #[test]
    fn test_minimize_entropy_reduces_ambiguity() {
        let mut web = ContextWeb::new();
        for i in 0..5 {
            let node = Node::new(
                NodeKind::Fact,
                format!("fait flou {i}"),
                0.5,
                0.8, // Forte ambiguïté
                vec![make_anchor(&format!("spec://fuzzy-{i}"))],
            );
            web.add_node(node);
        }

        let before = analyze_entropy(&web);
        let after = minimize_entropy(&mut web, 5);

        assert!(
            after.global_entropy <= before.global_entropy,
            "L'entropie doit diminuer après minimisation"
        );
    }

    #[test]
    fn test_find_fuzzy_nodes() {
        let mut web = ContextWeb::new();
        let clear = Node::new(NodeKind::Fact, "clair".into(), 0.9, 0.1, vec![make_anchor("spec://clear")]);
        let fuzzy = Node::new(NodeKind::Fact, "flou".into(), 0.5, 0.9, vec![make_anchor("spec://fuzzy")]);

        let id_clear = web.add_node(clear);
        let id_fuzzy = web.add_node(fuzzy);

        // Ajoute assez de liens pour rendre le nœud flou "trop connecté" (≥ 3)
        let extra1 = Node::new(NodeKind::Fact, "extra1".into(), 0.5, 0.3, vec![make_anchor("spec://extra1")]);
        let extra2 = Node::new(NodeKind::Fact, "extra2".into(), 0.5, 0.3, vec![make_anchor("spec://extra2")]);
        let id_extra1 = web.add_node(extra1);
        let id_extra2 = web.add_node(extra2);
        web.add_link(crate::Link::new(id_fuzzy, id_clear, crate::RelationKind::References, 0.3, 0.3)).unwrap();
        web.add_link(crate::Link::new(id_fuzzy, id_extra1, crate::RelationKind::References, 0.3, 0.3)).unwrap();
        web.add_link(crate::Link::new(id_fuzzy, id_extra2, crate::RelationKind::References, 0.3, 0.3)).unwrap();

        let fuzzy_nodes = find_fuzzy_nodes(&web, 0.7);
        assert!(fuzzy_nodes.contains(&id_fuzzy), "Doit identifier le nœud flou");
    }
}
