/// @anchor: TTC White Paper — Loi de conservation de la phase
/// Propagation du contexte via le courant de phase J_Φ^μ = Γ²∇^μΦ.
///
/// # Fondement TTC (§3, Loi 4)
/// La propagation n'est pas une marche aléatoire, mais la **conservation
/// du courant de phase** sur le graphe :
///
///   ∇_μ (Γ² ∇^μ Φ) = 0
///
/// En discret sur le graphe de la toile :
///   Σ_{j∈N(i)} J_{ij} - Σ_{k∈N⁻¹(i)} J_{ki} = 0
///   où J_{ij} = Γ_i² · w_{ij} · (Φ_j - Φ_i)
///
/// # Émergence de la gravité (§4)
/// La métrique effective module les poids des liens :
///   w_{ij}^{eff} = w_{ij} · f(Γ_i² + Γ_j² - 2λ(T_i + T_j))
///
/// # Bridage P_max (§6)
/// P_MAX_COMPUTATIONAL = 243.0 — seuil de saturation heuristique.
/// Note TTC v1.1 : 3⁵=243 n'a AUCUN lien avec c⁵/G.
/// Cf. TTC-note-Pmax-rectification.md.
/// Au-delà, rupture de cohérence → trou noir informationnel (élagage).

use crate::engine::field_solver::{
    self, TtcParameters,
    effective_link_weight, phase_current,
};
use std::collections::{HashMap, VecDeque};
use uuid::Uuid;

use crate::web::ContextWeb;

/// Constante de bridage TTC : densité sémantique maximale avant élagage.
/// Seuil de saturation numérique heuristique (TTC v1.1 §4).
/// 3⁵ = 243 — coïncidence avec le nombre de champs TTC (3) et l'exposant
/// du c⁵/G (5). SANS lien physique avec la constante de Planck.
pub const P_MAX: f64 = 243.0;

/// Alias documenté pour P_MAX (TTC v1.1).
pub const P_MAX_COMPUTATIONAL: f64 = P_MAX;

/// Résultat de la propagation de contexte depuis un nœud source.
#[derive(Debug, Clone)]
pub struct PropagationResult {
    /// Nœud source
    pub source_id: Uuid,
    /// Nœuds atteints avec leur score de phase Φ
    pub reached_nodes: HashMap<Uuid, f64>,
    /// Profondeur maximale atteinte
    pub max_depth: usize,
    /// Nombre total de nœuds atteints
    pub reached_count: usize,
    /// Champ de phase total (somme des Φ)
    pub total_phase_flux: f64,
    /// Densité sémantique estimée (tokens / surface)
    pub semantic_density: f64,
    /// Indique si le bridage P_max a été activé
    pub density_capped: bool,
}

/// Calcule la force de propagation entre deux nœuds via un lien.
///
/// # Formule TTC
/// P(n_i, n_j) = w_{ij} · relevance(n_i, n_j)
///
/// Fonction pure (E2).
#[inline]
pub fn propagation_force(weight: f64, relevance_score: f64) -> f64 {
    weight * relevance_score
}

/// Propage le contexte depuis un nœud source dans la toile.
///
/// Algorithme : BFS pondéré avec atténuation par champ de phase.
///
/// 1. Initialise Φ(source) = 1.0
/// 2. Pour chaque lien sortant, calcule P(n_i, n_j)
/// 3. Propage Φ(n_j) = P(n_i, n_j) · Φ(n_i) / d(n_i)
/// 4. Arrêt si Φ < threshold ou depth > max_depth
/// 5. Active le bridage P_max si la densité sémantique dépasse le seuil
///
/// Fonction pure (E2) — ne modifie pas la toile.
pub fn propagate_context(
    web: &ContextWeb,
    source_id: &Uuid,
    threshold: f64,
    max_depth: usize,
) -> PropagationResult {
    let mut reached: HashMap<Uuid, f64> = HashMap::new();
    let mut queue: VecDeque<(Uuid, f64, usize)> = VecDeque::new();
    let mut max_depth_reached = 0;
    let mut total_phase_flux = 0.0;
    let mut density_capped = false;

    // Initialisation : le nœud source a un flux de phase Φ = 1.0
    reached.insert(*source_id, 1.0);
    queue.push_back((*source_id, 1.0, 0));
    total_phase_flux += 1.0;

    while let Some((current_id, current_phi, depth)) = queue.pop_front() {
        if depth >= max_depth {
            continue;
        }

        max_depth_reached = max_depth_reached.max(depth);

        let outgoing = web.outgoing_links(&current_id);
        let out_degree = outgoing.len().max(1); // Évite division par zéro

        for link in outgoing {
            // P(n_i, n_j) = w_{ij} · relevance(n_i, n_j)
            let p_force = propagation_force(link.weight, link.relevance_score);

            // Φ(n_j) = P(n_i, n_j) · Φ(n_i) / d(n_i)
            // Normalisation par le degré sortant (marche aléatoire)
            let new_phi = p_force * current_phi / out_degree as f64;

            // Arrêt si le flux est trop faible
            if new_phi < threshold {
                continue;
            }

            // Bridage P_max : si le flux cumulé dépasse la constante de bridage,
            // on n'ajoute plus de nouveaux nœuds (élagage des branches faibles)
            if total_phase_flux + new_phi > P_MAX {
                density_capped = true;
                // On n'ajoute que si le nœud est déjà atteint avec un score plus faible
                let existing = reached.get(&link.target_id).copied().unwrap_or(0.0);
                if new_phi > existing {
                    let delta = new_phi - existing;
                    reached.insert(link.target_id, new_phi);
                    total_phase_flux += delta;
                }
                continue;
            }

            // Met à jour le score du nœud cible (garde le maximum)
            let existing = reached.get(&link.target_id).copied().unwrap_or(0.0);
            if new_phi > existing {
                let delta = new_phi - existing;
                reached.insert(link.target_id, new_phi);
                total_phase_flux += delta;
                queue.push_back((link.target_id, new_phi, depth + 1));
            }
        }
    }

    // Retire le nœud source du décompte
    let reached_count = reached.len().saturating_sub(1);

    // Calcule la densité sémantique : tokens estimés / nombre de nœuds atteints
    let semantic_density = if reached_count > 0 {
        total_phase_flux / reached_count as f64
    } else {
        0.0
    };

    PropagationResult {
        source_id: *source_id,
        reached_nodes: reached,
        max_depth: max_depth_reached,
        reached_count,
        total_phase_flux,
        semantic_density,
        density_capped,
    }
}

/// Évalue la densité sémantique d'un sous-graphe et retourne les nœuds à élaguer.
///
/// Si la densité dépasse P_max, les nœuds avec le Φ le plus faible sont
/// proposés pour élagage afin de réduire la surcharge cognitive.
///
/// C'est l'application directe du bridage P_max = c^5/G.
pub fn prune_density(
    propagation: &PropagationResult,
    keep_ratio: f64,
) -> Vec<Uuid> {
    if !propagation.density_capped || propagation.reached_count == 0 {
        return Vec::new();
    }

    let keep_count = (propagation.reached_count as f64 * keep_ratio).ceil() as usize;
    let keep_count = keep_count.max(1);

    // Trie les nœuds atteints par Φ décroissant
    let mut sorted: Vec<(Uuid, f64)> = propagation
        .reached_nodes
        .iter()
        .filter(|(id, _)| **id != propagation.source_id)
        .map(|(id, phi)| (*id, *phi))
        .collect();

    sorted.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    // Retourne les nœuds à élaguer (ceux au-delà du ratio)
    sorted
        .into_iter()
        .skip(keep_count)
        .map(|(id, _)| id)
        .collect()
}

/// Propage le contexte via le courant de phase TTC.
///
/// Contrairement au BFS classique, cette propagation respecte la loi de
/// conservation du courant de phase (§3, Loi 4) :
///
///   ∇_μ (Γ² ∇^μ Φ) = 0
///
/// 1. Initialise l'état des champs TTC à partir de la toile
/// 2. Résout les équations de champ (Γ, Φ, T)
/// 3. Utilise le courant de phase J_{ij} = Γ_i² w_{ij} (Φ_j - Φ_i)
///    comme score de propagation
/// 4. La métrique effective w_{ij}^{eff} module l'intensité des liens
///
/// C'est la version « physique » de la propagation, par opposition
/// au BFS heuristique de `propagate_context`.
pub fn propagate_via_phase_current(
    web: &ContextWeb,
    source_id: &Uuid,
    threshold: f64,
    max_depth: usize,
) -> PropagationResult {
    // 1. Résout les équations de champ TTC
    let params = TtcParameters::default();
    let (fields, _history) = field_solver::solve_field_equations(
        web, params, 0.1, 50,
    );

    let mut reached: HashMap<Uuid, f64> = HashMap::new();
    let mut queue: VecDeque<(Uuid, f64, usize)> = VecDeque::new();
    let mut max_depth_reached = 0;
    let mut total_phase_flux = 0.0;
    let mut density_capped = false;

    // Phase initiale au nœud source = 2π (un cycle complet)
    reached.insert(*source_id, 2.0 * std::f64::consts::PI);
    queue.push_back((*source_id, 2.0 * std::f64::consts::PI, 0));
    total_phase_flux += 2.0 * std::f64::consts::PI;

    while let Some((current_id, current_flux, depth)) = queue.pop_front() {
        if depth >= max_depth {
            continue;
        }
        max_depth_reached = max_depth_reached.max(depth);

        for link in web.outgoing_links(&current_id) {
            // Poids effectif modulé par la métrique TTC
            let w_eff = effective_link_weight(
                &fields, &current_id, &link.target_id, link.weight, &fields.params,
            );

            // Courant de phase J_{ij} = Γ_i² · w_{ij}^{eff} · (Φ_j - Φ_i)
            let j_phase = phase_current(&fields, &current_id, &link.target_id, w_eff);

            // Le flux propagé est la valeur absolue du courant de phase
            let new_flux = current_flux * j_phase.abs().min(1.0);

            if new_flux < threshold {
                continue;
            }

            // Bridage P_max
            if total_phase_flux + new_flux > P_MAX {
                density_capped = true;
                let existing = reached.get(&link.target_id).copied().unwrap_or(0.0);
                if new_flux > existing {
                    let delta = new_flux - existing;
                    reached.insert(link.target_id, new_flux);
                    total_phase_flux += delta;
                }
                continue;
            }

            let existing = reached.get(&link.target_id).copied().unwrap_or(0.0);
            if new_flux > existing {
                let delta = new_flux - existing;
                reached.insert(link.target_id, new_flux);
                total_phase_flux += delta;
                queue.push_back((link.target_id, new_flux, depth + 1));
            }
        }
    }

    let reached_count = reached.len().saturating_sub(1);
    let semantic_density = if reached_count > 0 {
        total_phase_flux / reached_count as f64
    } else {
        0.0
    };

    PropagationResult {
        source_id: *source_id,
        reached_nodes: reached,
        max_depth: max_depth_reached,
        reached_count,
        total_phase_flux,
        semantic_density,
        density_capped,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::node::{Anchor, AnchorType, Node, NodeKind};
    use crate::{Link, RelationKind};

    fn make_anchor(uri: &str) -> Anchor {
        Anchor {
            uri: uri.to_string(),
            source_type: AnchorType::Specification,
            anchored_at: chrono::Utc::now(),
        }
    }

    #[test]
    fn test_propagation_force_formula() {
        let force = propagation_force(0.9, 0.8);
        assert!((force - 0.72).abs() < 1e-10, "P = w × r = 0.9 × 0.8 = 0.72");
    }

    #[test]
    fn test_propagation_with_petgraph() {
        let mut web = ContextWeb::new();

        let n1 = Node::new(NodeKind::Fact, "React".into(), 0.9, 0.1, vec![make_anchor("spec://react")]);
        let n2 = Node::new(NodeKind::Fact, "useState".into(), 0.85, 0.1, vec![make_anchor("spec://usestate")]);
        let n3 = Node::new(NodeKind::Fact, "Virtual DOM".into(), 0.7, 0.2, vec![make_anchor("spec://vdom")]);

        let id1 = web.add_node(n1);
        let id2 = web.add_node(n2);
        let id3 = web.add_node(n3);

        // Liens React → useState (fort), React → Virtual DOM (moyen)
        web.add_link(Link::new(id1, id2, RelationKind::Refines, 0.9, 0.85)).unwrap();
        web.add_link(Link::new(id1, id3, RelationKind::Refines, 0.6, 0.5)).unwrap();

        let result = propagate_context(&web, &id1, 0.01, 5);

        assert_eq!(result.source_id, id1);
        assert!(result.reached_count >= 2, "Au moins 2 nœuds atteints");
        assert!(result.total_phase_flux > 0.0, "Flux de phase non nul");
        assert!(!result.density_capped, "Pas de bridage pour 3 nœuds");
    }

    #[test]
    fn test_constant_p_max() {
        // Vérifie que P_max = c^5 / G est bien défini
        assert!(P_MAX > 0.0);
        assert_eq!(P_MAX, 243.0); // 3^5 / 1
    }

    #[test]
    fn test_prune_density_respects_ratio() {
        let mut reached = HashMap::new();
        let source = Uuid::new_v4();
        reached.insert(source, 1.0);
        for i in 0..10 {
            reached.insert(Uuid::new_v4(), 0.1 * (10 - i) as f64);
        }

        let result = PropagationResult {
            source_id: source,
            reached_nodes: reached,
            max_depth: 3,
            reached_count: 10,
            total_phase_flux: 5.0,
            semantic_density: 0.5,
            density_capped: true,
        };

        let pruned = prune_density(&result, 0.5);
        assert!(pruned.len() <= 5, "Au maximum 50% élagués");
    }
}
