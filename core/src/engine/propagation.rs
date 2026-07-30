/// @anchor: PROJECT_CONTEXT.md §2.1 — Principe de Propagation P(n_i, n_j)
/// Propagation du contexte par liens de pertinence pondérés.
///
/// # Formule TTC
/// P(n_i, n_j) = w_{ij} · relevance(n_i, n_j)
///
/// Le contexte se propage de proche en proche dans la toile, avec une
/// atténuation proportionnelle à la distance et aux poids des liens.

use std::collections::{HashMap, VecDeque};
use uuid::Uuid;

use crate::web::ContextWeb;

/// Résultat de la propagation de contexte depuis un nœud source.
#[derive(Debug, Clone)]
pub struct PropagationResult {
    /// Nœud source
    pub source_id: Uuid,
    /// Nœuds atteints avec leur score de contexte propagé
    pub reached_nodes: HashMap<Uuid, f64>,
    /// Profondeur maximale atteinte
    pub max_depth: usize,
    /// Nombre total de nœuds atteints
    pub reached_count: usize,
}

/// Propage le contexte depuis un nœud source dans la toile.
///
/// Utilise un BFS pondéré :
/// - Le score initial = 1.0 au nœud source
/// - À chaque traversée de lien, le score est multiplié par P(n_i, n_j)
/// - La propagation s'arrête quand le score tombe sous `threshold`
/// - `max_depth` limite la profondeur de propagation
///
/// Fonction pure (E2) — ne modifie pas la toile, lit seulement.
pub fn propagate_context(
    web: &ContextWeb,
    source_id: &Uuid,
    threshold: f64,
    max_depth: usize,
) -> PropagationResult {
    let mut reached: HashMap<Uuid, f64> = HashMap::new();
    let mut queue: VecDeque<(Uuid, f64, usize)> = VecDeque::new();
    let mut max_depth_reached = 0;

    // Initialisation : le nœud source a un score de 1.0
    reached.insert(*source_id, 1.0);
    queue.push_back((*source_id, 1.0, 0));

    while let Some((current_id, current_score, depth)) = queue.pop_front() {
        if depth >= max_depth {
            continue;
        }

        max_depth_reached = max_depth_reached.max(depth);

        // Parcourt tous les liens sortants
        for link in web.outgoing_links(&current_id) {
            let propagation_force = link.propagation_force();
            let new_score = current_score * propagation_force;

            // Arrêt si le score est trop faible
            if new_score < threshold {
                continue;
            }

            // Met à jour le score du nœud cible (garde le maximum)
            let existing = reached.get(&link.target_id).copied().unwrap_or(0.0);
            if new_score > existing {
                reached.insert(link.target_id, new_score);
                queue.push_back((link.target_id, new_score, depth + 1));
            }
        }
    }

    // Retire le nœud source du décompte des nœuds atteints
    let reached_count = reached.len().saturating_sub(1);

    PropagationResult {
        source_id: *source_id,
        reached_nodes: reached,
        max_depth: max_depth_reached,
        reached_count,
    }
}

/// Calcule le « contexte effectif » d'un nœud — l'ensemble des nœuds
/// qui l'influencent significativement (score > threshold).
/// Fonction pure (E2).
pub fn compute_effective_context(
    web: &ContextWeb,
    node_id: &Uuid,
    threshold: f64,
) -> Vec<(Uuid, f64)> {
    let mut context_scores: HashMap<Uuid, f64> = HashMap::new();

    // Agrège les influences de tous les liens entrants
    for link in web.incoming_links(node_id) {
        let force = link.propagation_force();
        if force >= threshold {
            let entry = context_scores.entry(link.source_id).or_insert(0.0);
            *entry = entry.max(force);
        }
    }

    // Trie par score décroissant
    let mut result: Vec<(Uuid, f64)> = context_scores.into_iter().collect();
    result.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    result
}

/// Calcule la matrice de propagation pour un ensemble de nœuds.
/// Retourne une map (source, cible) → score de propagation.
/// Complexité : O(|nodes| × |edges|) — attention aux grandes toiles.
/// /// @complexity: O(n × e), justifié par la nécessité d'une matrice complète
pub fn compute_propagation_matrix(
    web: &ContextWeb,
    node_ids: &[Uuid],
    threshold: f64,
) -> HashMap<(Uuid, Uuid), f64> {
    let mut matrix: HashMap<(Uuid, Uuid), f64> = HashMap::new();

    for source_id in node_ids {
        let result = propagate_context(web, source_id, threshold, 5);
        for (target_id, score) in &result.reached_nodes {
            if source_id != target_id {
                matrix.insert((*source_id, *target_id), *score);
            }
        }
    }

    matrix
}
