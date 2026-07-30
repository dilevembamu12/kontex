/// @anchor: PROJECT_CONTEXT.md §2.1 — Principe d'Entropie Minimale E_min(T)
/// Minimisation de l'ambiguïté dans la toile contextuelle.
///
/// # Formule TTC
/// E_min(T) = arg min_{T'} Σ_{n ∈ T'} ambiguity(n)
///
/// La toile tend vers l'état de moindre ambiguïté en réduisant
/// l'incertitude des nœuds et en renforçant les ancrages.

use crate::web::ContextWeb;

/// Rapport d'entropie pour un nœud ou la toile entière.
#[derive(Debug, Clone)]
pub struct EntropyReport {
    /// Entropie globale de la toile
    pub global_entropy: f64,
    /// Entropie moyenne par nœud
    pub average_ambiguity: f64,
    /// Nombre de nœuds à forte ambiguïté (> 0.7)
    pub high_ambiguity_count: usize,
    /// Liste des nœuds les plus ambigus (top N)
    pub most_ambiguous_nodes: Vec<(uuid::Uuid, f64)>,
    /// Suggestions de réduction d'entropie
    pub reduction_suggestions: Vec<String>,
}

/// Analyse l'entropie de la toile et génère des suggestions de réduction.
/// Fonction pure (E2) — lit seulement, ne modifie pas.
pub fn analyze_entropy(web: &ContextWeb) -> EntropyReport {
    let mut high_ambiguity_count = 0usize;
    let mut all_ambiguities: Vec<(uuid::Uuid, f64)> = Vec::new();
    let mut total_ambiguity = 0.0f64;
    let node_count = web.node_count();

    for node in web.iter_nodes() {
        let ambiguity = node.ambiguity;
        total_ambiguity += ambiguity;
        all_ambiguities.push((node.id, ambiguity));

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

    let most_ambiguous_nodes: Vec<(uuid::Uuid, f64)> = all_ambiguities
        .into_iter()
        .take(10)
        .collect();

    // Génère des suggestions de réduction
    let mut reduction_suggestions = Vec::new();

    if high_ambiguity_count > 0 {
        reduction_suggestions.push(format!(
            "{} nœud(s) ont une ambiguïté > 0.7 — renforcer leur ancrage (Principe A)",
            high_ambiguity_count
        ));
    }

    if average_ambiguity > 0.5 {
        reduction_suggestions.push(
            "Entropie moyenne élevée — ajouter des liens de raffinement (Principe C)"
                .to_string(),
        );
    }

    if node_count < 3 && node_count > 0 {
        reduction_suggestions.push(
            "Toile peu dense — ajouter plus de nœuds pour améliorer la propagation (Principe P)"
                .to_string(),
        );
    }

    if reduction_suggestions.is_empty() {
        reduction_suggestions.push("✓ Entropie sous contrôle — toile bien structurée".to_string());
    }

    EntropyReport {
        global_entropy: web.global_entropy(),
        average_ambiguity,
        high_ambiguity_count,
        most_ambiguous_nodes,
        reduction_suggestions,
    }
}

/// Réduit l'ambiguïté d'un nœud spécifique.
/// @side-effect: modifie le nœud dans la toile.
///
/// Stratégie : divise l'ambiguïté par 2 (simulation de raffinement).
/// En Phase 1+, cette fonction utilisera des heuristiques avancées.
pub fn reduce_node_ambiguity(web: &mut ContextWeb, node_id: &uuid::Uuid) -> Result<f64, String> {
    let node = web
        .get_node_mut(node_id)
        .ok_or_else(|| format!("Nœud {node_id} introuvable"))?;

    let old_ambiguity = node.ambiguity;
    // Réduction de 50% avec un plancher à 0.01
    node.ambiguity = (old_ambiguity * 0.5).max(0.01);

    Ok(node.ambiguity)
}

/// Applique une passe de minimisation d'entropie sur toute la toile.
/// @side-effect: réduit l'ambiguïté des nœuds les plus ambigus.
///
/// # Returns
/// Nombre de nœuds dont l'ambiguïté a été réduite.
pub fn minimize_entropy(web: &mut ContextWeb, max_iterations: usize) -> usize {
    let mut reduced_count = 0usize;

    for _ in 0..max_iterations {
        // Trouve le nœud le plus ambigu
        let most_ambiguous: Option<(uuid::Uuid, f64)> = web
            .iter_nodes()
            .map(|n| (n.id, n.ambiguity))
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

        if let Some((node_id, ambiguity)) = most_ambiguous {
            if ambiguity <= 0.1 {
                // Seuil de convergence atteint
                break;
            }
            if reduce_node_ambiguity(web, &node_id).is_ok() {
                reduced_count = reduced_count.saturating_add(1);
            }
        } else {
            break;
        }
    }

    web.update_global_entropy();
    reduced_count
}
