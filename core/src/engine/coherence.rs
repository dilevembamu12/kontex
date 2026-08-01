/// @anchor: TTC White Paper §3 — Loi de la tension et loi de la cohérence
/// Détection topologique des contradictions via la dynamique du champ T.
///
/// # Fondement TTC (§3, Lois 3 & 5)
///
/// **Loi de la cohérence (Γ)** :
///   □Γ - Γ(∇Φ)² - αΓ(Γ² - v_Γ²) - 2λTΓ = 0
///
/// **Loi de la tension (T)** :
///   □T - β(T - v_T) - λΓ² = 0
///
/// La cohérence Γ est une **source** de tension : quand Γ est élevé
/// (beaucoup de matière informationnelle), la tension T augmente.
/// Si T dépasse le seuil critique, une contradiction topologique est déclarée.
///
/// # Discrétisation sur le graphe
///   □T|_i ≈ Σ w_{ij} (T_i - T_j)
///   Résidu : R_T = □T - β(T - v_T) - λΓ²
///   Si R_T > seuil → contradiction (la toile ne peut pas satisfaire l'équation)
///
/// # Intégrale de tension
///   ∮_S T(n_i, n_j) dS = Σ_{(i,j) ∈ S} w_{ij} · T(n_i, n_j)

use std::collections::{HashMap, HashSet};
use uuid::Uuid;

use crate::engine::field_solver::{self, TtcFieldState, TtcParameters};
use crate::node::Node;
use crate::web::ContextWeb;

/// Seuil critique de tension T au-delà duquel une contradiction est déclarée.
/// Seuil de tension critique pour la détection de contradiction.
/// **Calibré à 0.95** (valeur unifiée avec detectController.ts).
/// Ce seuil n'est PAS une constante fondamentale du Lagrangien MCW-1 —
/// il est calibré empiriquement par domaine d'application.
/// Cf. Réponse co-auteur TTC §3 — T_crit est un paramètre libre.
pub const T_CRITICAL: f64 = 0.95;

/// Résultat de l'analyse de cohérence entre deux nœuds.
#[derive(Debug, Clone)]
pub struct CoherenceAnalysis {
    /// Les deux nœuds sont-ils cohérents ?
    pub is_coherent: bool,
    /// Tension T entre les deux nœuds ∈ [0.0, 1.0]
    pub tension: f64,
    /// Identifiants des nœuds analysés
    pub node_a: Uuid,
    pub node_b: Uuid,
    /// Liste des contradictions détectées
    pub contradictions: Vec<String>,
    /// Résolution proposée (si applicable)
    pub suggested_resolution: Option<String>,
    /// Type de contradiction détectée
    pub contradiction_type: ContradictionType,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ContradictionType {
    None,
    /// Négation explicite (A dit X, B dit ¬X)
    ExplicitNegation,
    /// Incompatibilité de types (int vs float)
    TypeMismatch { field_a: String, field_b: String },
    /// Tension topologique élevée (vecteurs d'état opposés)
    TopologicalTension { cosine_distance: f64 },
    /// Lien de contradiction explicite dans le graphe
    ExplicitLink,
}

/// Vecteur d'état simplifié d'un nœud pour le calcul de tension.
///
/// Dans la version complète (pgvector), ce serait un embedding N-dimensionnel.
/// Ici, on utilise une représentation par bigrammes pondérés.
#[derive(Debug, Clone)]
struct StateVector {
    /// Bigrammes normalisés du contenu
    features: HashMap<String, f64>,
    /// Norme L2 du vecteur
    norm: f64,
}

impl StateVector {
    /// Construit un vecteur d'état à partir du contenu textuel.
    fn from_content(content: &str, _kind: &str, weight: f64) -> Self {
        let lower = content.to_lowercase();
        let words: Vec<&str> = lower
            .split(|c: char| !c.is_alphanumeric() && c != '\'')
            .filter(|w| w.len() >= 2)
            .collect();

        let mut features = HashMap::new();

        // Unigrams pondérés
        for word in &words {
            let entry = features.entry(word.to_string()).or_insert(0.0);
            *entry += 1.0;
        }

        // Bigrams pour capture de contexte
        for window in words.windows(2) {
            let bigram = format!("{}:{}", window[0], window[1]);
            let entry = features.entry(bigram).or_insert(0.0);
            *entry += 0.5; // Les bigrams ont un poids réduit
        }

        // Normalisation par le poids du nœud
        for val in features.values_mut() {
            *val *= weight;
        }

        // Calcul de la norme L2
        let norm = features.values().map(|v| v * v).sum::<f64>().sqrt();

        Self { features, norm }
    }

    /// Calcule la similarité cosinus avec un autre vecteur d'état.
    fn cosine_similarity(&self, other: &StateVector) -> f64 {
        if self.norm == 0.0 || other.norm == 0.0 {
            return 1.0; // Vecteurs vides = pas de contradiction
        }

        let dot_product: f64 = self
            .features
            .iter()
            .filter_map(|(k, v)| other.features.get(k).map(|ov| v * ov))
            .sum();

        dot_product / (self.norm * other.norm)
    }
}

/// Calcule la tension T entre deux nœuds.
///
/// # Formule TTC
/// T(n_A, n_B) = 1 - cos(θ)
///
/// où cos(θ) est la similarité cosinus entre les vecteurs d'état.
///
/// Si T > T_CRITICAL, une contradiction topologique est déclarée.
pub fn calculate_tension(node_a: &Node, node_b: &Node) -> f64 {
    let kind_a = format!("{:?}", node_a.kind);
    let kind_b = format!("{:?}", node_b.kind);

    let vec_a = StateVector::from_content(&node_a.content, &kind_a, node_a.weight);
    let vec_b = StateVector::from_content(&node_b.content, &kind_b, node_b.weight);

    let cosine_sim = vec_a.cosine_similarity(&vec_b);

    // T = 1 - cos(θ), borné à [0, 1]
    (1.0 - cosine_sim).clamp(0.0, 1.0)
}

/// Détecte les contradictions entre deux nœuds en utilisant le modèle TTC complet.
///
/// Signaux de contradiction (pipeline) :
/// 1. Lien de contradiction explicite dans le graphe → T = 1.0
/// 2. Négation textuelle (A dit X, B dit ¬X) → T > T_CRITICAL
/// 3. Tension topologique (vecteurs d'état opposés) → T = 1 - cos(θ)
/// 4. Incompatibilité de types extraits du contenu
///
/// Fonction pure (E2).
pub fn detect_contradiction(web: &ContextWeb, node_a: &Uuid, node_b: &Uuid) -> CoherenceAnalysis {
    let mut contradictions = Vec::new();
    let mut tension = 0.0;
    let mut contradiction_type = ContradictionType::None;

    // Récupère les nœuds
    let node_a_data = web.get_node(node_a);
    let node_b_data = web.get_node(node_b);

    // --- Signal 1 : Lien de contradiction explicite ---
    let outgoing = web.outgoing_links(node_a);
    let has_contradiction_link = outgoing
        .iter()
        .any(|link| &link.target_id == node_b && link.is_contradiction());

    if has_contradiction_link {
        tension = 1.0;
        contradiction_type = ContradictionType::ExplicitLink;
        contradictions.push(format!(
            "Lien de contradiction explicite entre {node_a} et {node_b}"
        ));
    }

    // --- Signal 2 : Négation textuelle ---
    if let (Some(a), Some(b)) = (node_a_data, node_b_data) {
        let has_neg_a = has_negation_pattern(&a.content);
        let has_neg_b = has_negation_pattern(&b.content);

        if has_neg_a != has_neg_b {
            // L'un nie ce que l'autre affirme — vérifier s'ils parlent du même sujet
            let common_keywords = count_common_keywords(&a.content, &b.content);
            if common_keywords >= 2 {
                tension = f64::max(tension, 0.8);
                contradiction_type = ContradictionType::ExplicitNegation;
                contradictions.push(format!(
                    "Négation contradictoire : \"{}\" ↔ \"{}\"",
                    truncate(&a.content, 60),
                    truncate(&b.content, 60)
                ));
            }
        }

        // --- Signal 3 : Tension topologique ---
        let topological_tension = calculate_tension(a, b);
        if topological_tension > T_CRITICAL {
            tension = f64::max(tension, topological_tension);
            if contradiction_type == ContradictionType::None {
                contradiction_type = ContradictionType::TopologicalTension {
                    cosine_distance: 1.0 - (1.0 - topological_tension),
                };
            }
            contradictions.push(format!(
                "Tension topologique T={:.3} entre les nœuds (seuil={})",
                topological_tension, T_CRITICAL
            ));
        }

        // --- Signal 4 : Incompatibilité de types ---
        if let Some((field_a, field_b)) = detect_type_mismatch(&a.content, &b.content) {
            tension = f64::max(tension, 0.9);
            contradiction_type = ContradictionType::TypeMismatch {
                field_a: field_a.clone(),
                field_b: field_b.clone(),
            };
            contradictions.push(format!(
                "Incompatibilité de type : {} ↔ {}",
                field_a, field_b
            ));
        }
    }

    let is_coherent = tension < T_CRITICAL;

    let suggested_resolution = if !is_coherent {
        Some(generate_resolution(&contradiction_type, node_a, node_b))
    } else {
        None
    };

    CoherenceAnalysis {
        is_coherent,
        tension,
        node_a: *node_a,
        node_b: *node_b,
        contradictions,
        suggested_resolution,
        contradiction_type,
    }
}

/// Calcule l'intégrale de tension sur un sous-graphe.
///
/// # Formule TTC
/// ∮_S T(n_i, n_j) dS = Σ_{(i,j) ∈ S} w_{ij} · T(n_i, n_j)
///
/// C'est la somme pondérée de toutes les tensions dans le sous-graphe S.
pub fn integrate_tension(web: &ContextWeb, node_ids: &[Uuid]) -> f64 {
    let mut total_tension = 0.0;
    let mut pair_count = 0;

    for i in 0..node_ids.len() {
        for j in (i + 1)..node_ids.len() {
            if let (Some(a), Some(b)) = (web.get_node(&node_ids[i]), web.get_node(&node_ids[j])) {
                let t = calculate_tension(a, b);
                // Pondération par les poids des nœuds
                let weight = a.weight * b.weight;
                total_tension += weight * t;
                pair_count += 1;
            }
        }
    }

    if pair_count > 0 {
        total_tension / pair_count as f64
    } else {
        0.0
    }
}

/// Résout automatiquement une contradiction entre deux nœuds.
///
/// Stratégies de résolution (par ordre de priorité) :
/// 1. Si l'un des nœuds est mal ancré → suggérer de renforcer son ancrage
/// 2. Si les nœuds sont de types compatibles → suggérer un lien de raffinement
/// 3. Si tension topologique élevée → suggérer une fusion
///
/// Fonction pure (E2).
pub fn auto_resolve_contradiction(
    web: &ContextWeb,
    node_a: &Uuid,
    node_b: &Uuid,
) -> String {
    let analysis = detect_contradiction(web, node_a, node_b);

    if analysis.is_coherent {
        return "Aucune contradiction à résoudre — les nœuds sont cohérents.".to_string();
    }

    let node_a_data = web.get_node(node_a);
    let node_b_data = web.get_node(node_b);

    match (node_a_data, node_b_data) {
        (Some(a), Some(b)) => {
            // Résolution 1 : Renforcer l'ancrage du nœud le plus faible
            if a.anchor_strength() < b.anchor_strength() && a.anchor_strength() < 0.5 {
                return format!(
                    "@resolution: renforcer l'ancrage du nœud {} (force={:.2}) — ajouter une source officielle.",
                    a.id, a.anchor_strength()
                );
            }
            if b.anchor_strength() < a.anchor_strength() && b.anchor_strength() < 0.5 {
                return format!(
                    "@resolution: renforcer l'ancrage du nœud {} (force={:.2}) — ajouter une source officielle.",
                    b.id, b.anchor_strength()
                );
            }

            // Résolution 2 : Raffinement
            if a.kind == b.kind {
                return format!(
                    "@resolution: créer un lien Refines entre {} et {} pour clarifier la relation hiérarchique.",
                    a.id, b.id
                );
            }

            // Résolution 3 : Fusion suggérée
            format!(
                "@resolution: tension T={:.3} — envisager la fusion des nœuds {} et {} ou ajouter un lien de raffinement.",
                analysis.tension, a.id, b.id
            )
        }
        _ => "@resolution: un des nœuds est introuvable — vérifier les identifiants.".to_string(),
    }
}

/// Vérifie la cohérence globale de la toile.
///
/// Ne vérifie que les liens de type Contradicts (pas tous les liens).
/// Pour chaque lien contradictoire, calcule la tension T et détermine
/// si la contradiction est justifiée ou résoluble.
pub fn verify_global_coherence(web: &ContextWeb) -> (f64, Vec<String>) {
    let contradictions = web.contradictions();
    if contradictions.is_empty() {
        return (1.0, Vec::new());
    }

    let mut warnings = Vec::new();
    let mut coherent_pairs = 0;
    let total_pairs = contradictions.len();

    for link in contradictions {
        let analysis = detect_contradiction(web, &link.source_id, &link.target_id);
        if analysis.is_coherent {
            coherent_pairs += 1;
        } else {
            warnings.push(format!(
                "Tension T={:.3} entre {} et {}",
                analysis.tension,
                link.source_id, link.target_id
            ));
        }
    }

    let coherence_rate = if total_pairs > 0 {
        coherent_pairs as f64 / total_pairs as f64
    } else {
        1.0
    };

    (coherence_rate, warnings)
}

// ============================================================
// Helpers
// ============================================================

fn has_negation_pattern(text: &str) -> bool {
    let lower = text.to_lowercase();
    let patterns = [
        "n'est pas", "ne pas", "n'existe pas", "n'a pas", "ne peut pas",
        "not ", "is not", "isn't", "cannot", "can't", "doesn't", "don't",
        "false", "faux", "jamais", "never", "sans", "without",
    ];
    patterns.iter().any(|p| lower.contains(p))
        || (lower.contains("ne ") && lower.contains(" pas"))
}

fn count_common_keywords(a: &str, b: &str) -> usize {
    let stop_words: HashSet<&str> = [
        "le", "la", "les", "des", "une", "est", "pas", "que", "qui",
        "dans", "sur", "par", "pour", "avec", "the", "is", "not", "are",
        "this", "that", "and", "for", "from", "was", "n'est",
    ]
    .iter()
    .copied()
    .collect();

    let lower_a = a.to_lowercase();
    let lower_b = b.to_lowercase();

    let words_a: HashSet<&str> = lower_a
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.len() >= 3 && !stop_words.contains(w))
        .collect();

    let words_b: HashSet<&str> = lower_b
        .split(|c: char| !c.is_alphanumeric())
        .filter(|w| w.len() >= 3 && !stop_words.contains(w))
        .collect();

    words_a.intersection(&words_b).count()
}

fn detect_type_mismatch(a: &str, b: &str) -> Option<(String, String)> {
    let incompatible_pairs: &[(&str, &str)] = &[
        ("int", "float"), ("integer", "float"), ("entier", "flottant"),
        ("string", "number"), ("true", "false"), ("vrai", "faux"),
        ("sync", "async"), ("synchrone", "asynchrone"),
        ("compilation", "runtime"), ("deux", "trois"), ("two", "three"),
    ];

    let lower_a = a.to_lowercase();
    let lower_b = b.to_lowercase();

    for (left, right) in incompatible_pairs {
        if lower_a.contains(left) && lower_b.contains(right) {
            return Some((left.to_string(), right.to_string()));
        }
        if lower_a.contains(right) && lower_b.contains(left) {
            return Some((right.to_string(), left.to_string()));
        }
    }

    None
}

fn generate_resolution(typ: &ContradictionType, a: &Uuid, b: &Uuid) -> String {
    match typ {
        ContradictionType::ExplicitNegation => format!(
            "@resolution: contradiction explicite entre {a} et {b} — vérifier les ancres et trancher selon la force d'ancrage (Principe A)."
        ),
        ContradictionType::TypeMismatch { field_a, field_b } => format!(
            "@resolution: incompatibilité {field_a}↔{field_b} entre {a} et {b} — un des nœuds doit être corrigé."
        ),
        ContradictionType::TopologicalTension { cosine_distance } => format!(
            "@resolution: tension topologique élevée (cos_dist={cosine_distance:.3}) entre {a} et {b} — ajouter un lien de raffinement ou fusionner."
        ),
        ContradictionType::ExplicitLink => format!(
            "@resolution: lien de contradiction entre {a} et {b} — résoudre en renforçant l'ancrage du nœud le moins fiable."
        ),
        ContradictionType::None => "Aucune contradiction.".to_string(),
    }
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len])
    }
}

// ============================================================
// Détection TTC basée sur l'équation de champ de tension
// ============================================================

/// Évalue la tension sur une arête via l'équation de champ TTC discrétisée.
///
/// # Équation (§3, Loi 5)
/// □T - β(T - v_T) - λΓ² = 0
///
/// Le résidu R_T = □T - β(T - v_T) - λΓ² mesure l'écart à l'équilibre.
/// Si |R_T| > seuil, la toile est en état de tension sur cette connexion.
pub fn tension_field_residue(
    fields: &TtcFieldState,
    source_id: &Uuid,
    target_id: &Uuid,
    weight: f64,
) -> f64 {
    let t_s = fields.nodes.get(source_id).map(|f| f.tension).unwrap_or(0.0);
    let t_t = fields.nodes.get(target_id).map(|f| f.tension).unwrap_or(0.0);
    let gamma_s = fields.nodes.get(source_id).map(|f| f.gamma).unwrap_or(0.5);
    let gamma_t = fields.nodes.get(target_id).map(|f| f.gamma).unwrap_or(0.5);

    let params = &fields.params;

    // □T discret : w · (T_i - T_j)
    let laplacian = weight * (t_s - t_t);

    // Terme de rappel : β(T - v_T), moyenné sur les deux nœuds
    let rappel = params.beta * ((t_s + t_t) / 2.0 - params.v_tension);

    // Terme source : λΓ², moyenné
    let source = params.lambda * (gamma_s * gamma_s + gamma_t * gamma_t) / 2.0;

    // Résidu de l'équation de champ
    laplacian - rappel - source
}

/// Détecte une contradiction en utilisant l'équation de champ TTC.
///
/// Résout les champs Γ, Φ, T sur le sous-graphe, puis vérifie si
/// le résidu de l'équation de tension dépasse le seuil critique.
///
/// C'est la version « physique » de la détection de contradiction,
/// par opposition à l'approche heuristique de `detect_contradiction`.
pub fn detect_contradiction_ttc(
    web: &ContextWeb,
    source_id: &Uuid,
    target_id: &Uuid,
) -> f64 {
    // Résout les équations de champ sur la toile
    let params = TtcParameters::default();
    let (fields, _) = field_solver::solve_field_equations(web, params, 0.1, 30);

    // Trouve le poids du lien
    let weight = web.outgoing_links(source_id)
        .iter()
        .find(|l| &l.target_id == target_id)
        .map(|l| l.weight)
        .unwrap_or(0.5);

    // Calcule le résidu de l'équation de tension
    let residue = tension_field_residue(&fields, source_id, target_id, weight);

    // Tension normalisée : |résidu| / max(|résidu|, 1)
    residue.abs() / residue.abs().max(1.0).min(1.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::node::{Anchor, AnchorType, NodeKind};
    use crate::{Link, RelationKind};

    fn make_anchor(uri: &str) -> Anchor {
        Anchor {
            uri: uri.to_string(),
            source_type: AnchorType::Specification,
            anchored_at: chrono::Utc::now(),
        }
    }

    #[test]
    fn test_tension_identical_nodes() {
        let a = Node::new(NodeKind::Fact, "La Terre est ronde".into(), 0.9, 0.1, vec![make_anchor("spec://earth")]);
        let b = Node::new(NodeKind::Fact, "La Terre est ronde".into(), 0.9, 0.1, vec![make_anchor("spec://earth")]);
        let t = calculate_tension(&a, &b);
        // Même contenu → faible tension
        assert!(t < 0.3, "Nœuds identiques doivent avoir une tension faible, reçu T={}", t);
    }

    #[test]
    fn test_tension_opposite_nodes() {
        let a = Node::new(NodeKind::Fact, "La Terre est ronde".into(), 0.9, 0.1, vec![make_anchor("spec://earth")]);
        let b = Node::new(NodeKind::Fact, "La Terre est plate".into(), 0.9, 0.1, vec![make_anchor("spec://flat")]);
        let t = calculate_tension(&a, &b);
        // Contenu différent → tension plus élevée
        assert!(t > 0.0, "Nœuds différents doivent avoir une tension > 0, reçu T={}", t);
    }

    #[test]
    fn test_contradiction_detection_with_link() {
        let mut web = ContextWeb::new();
        let a = Node::new(NodeKind::Fact, "X est vrai".into(), 0.8, 0.1, vec![make_anchor("spec://x")]);
        let b = Node::new(NodeKind::Fact, "X n'est pas vrai".into(), 0.8, 0.1, vec![make_anchor("spec://not-x")]);
        let id_a = web.add_node(a);
        let id_b = web.add_node(b);
        web.add_link(Link::new(id_a, id_b, RelationKind::Contradicts, 0.9, 0.9)).unwrap();

        let analysis = detect_contradiction(&web, &id_a, &id_b);
        assert!(!analysis.is_coherent, "Doit détecter une contradiction");
        assert!(analysis.tension > T_CRITICAL);
    }

    #[test]
    fn test_global_coherence_rate() {
        let mut web = ContextWeb::new();
        let n1 = Node::new(NodeKind::Fact, "React est une bibliothèque".into(), 0.9, 0.1, vec![make_anchor("spec://react")]);
        let n2 = Node::new(NodeKind::Fact, "React utilise le Virtual DOM".into(), 0.85, 0.1, vec![make_anchor("spec://vdom")]);
        let id1 = web.add_node(n1);
        let id2 = web.add_node(n2);
        web.add_link(Link::new(id1, id2, RelationKind::Refines, 0.9, 0.8)).unwrap();

        let (rate, warnings) = verify_global_coherence(&web);
        assert!(rate > 0.5, "Toile cohérente doit avoir un taux > 0.5");
        assert!(warnings.is_empty(), "Pas d'avertissements attendus");
    }

    #[test]
    fn test_integrate_tension() {
        let mut web = ContextWeb::new();
        let n1 = Node::new(NodeKind::Fact, "A".into(), 0.9, 0.1, vec![make_anchor("spec://a")]);
        let n2 = Node::new(NodeKind::Fact, "B".into(), 0.9, 0.1, vec![make_anchor("spec://b")]);
        let n3 = Node::new(NodeKind::Fact, "C".into(), 0.9, 0.1, vec![make_anchor("spec://c")]);
        let id1 = web.add_node(n1);
        let id2 = web.add_node(n2);
        let id3 = web.add_node(n3);

        let integral = integrate_tension(&web, &[id1, id2, id3]);
        // 3 paires → tension moyenne
        assert!(integral >= 0.0 && integral <= 1.0);
    }
}
