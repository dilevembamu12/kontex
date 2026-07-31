/// @anchor: TTC White Paper — Théorie de la Toile Cosmologique
/// Solveur discret des équations de champ TTC sur le graphe contextuel.
///
/// # Fondement : la triade W = (Γ, Φ, T)
///
/// La réalité émerge de trois champs scalaires sur le graphe :
/// - Γ (Cohérence) : degré d'organisation locale. Γ ≫ v_Γ = matière, Γ ≈ v_Γ = vide
/// - Φ (Phase) : relations de phase. Support de la lumière et des interactions
/// - T (Tension) : déséquilibre relationnel. Moteur des transformations
///
/// # Discrétisation sur graphe
///
/// Le continuum espace-temps est remplacé par le graphe de la toile contextuelle.
/// Les dérivées sont approximées par différences finies sur les arêtes.
///
/// ## Laplacien discret (□ → L)
///   □f|_i ≈ Σ_{j∈N(i)} w_{ij} (f_i - f_j)
///   où L = D - A est la matrice laplacienne du graphe
///
/// ## Gradient discret (∇ → différence sur arête)
///   ∇f|_{i→j} ≈ w_{ij} · (f_j - f_i)
///
/// ## Courant de phase (J_Φ^μ = Γ²∇^μΦ)
///   J_{ij} = Γ_i² · w_{ij} · (Φ_j - Φ_i)  sur l'arête i→j
///
/// # Les 5 paramètres libres du Lagrangien MCW-1
///   α : auto-couplage de Γ (mécanisme de Higgs)
///   β : rappel de T vers v_T
///   λ : couplage T-Γ (la tension modifie la cohérence)
///   v_Γ : VEV de cohérence (vide)
///   v_T : VEV de tension (vide)

use crate::web::ContextWeb;
use std::collections::HashMap;
use uuid::Uuid;

// ============================================================
// Paramètres du Lagrangien MCW-1 (5 paramètres libres)
// ============================================================

/// Paramètres du modèle TTC discret.
#[derive(Debug, Clone)]
pub struct TtcParameters {
    /// Auto-couplage de Γ (mécanisme de Higgs)
    pub alpha: f64,
    /// Rappel de T vers v_T
    pub beta: f64,
    /// Couplage T-Γ : la tension modifie la cohérence
    pub lambda: f64,
    /// VEV de cohérence (vide = Γ ≈ v_Γ)
    pub v_gamma: f64,
    /// VEV de tension (vide = T ≈ v_T)
    pub v_tension: f64,
}

impl Default for TtcParameters {
    fn default() -> Self {
        Self {
            alpha: 1.0,
            beta: 0.5,
            lambda: 0.1,
            v_gamma: 0.5,    // Cohérence moyenne
            v_tension: 0.0,   // Tension nulle dans le vide
        }
    }
}

// ============================================================
// État de champ TTC sur le graphe
// ============================================================

/// Valeurs des champs TTC en un nœud.
#[derive(Debug, Clone, Default)]
pub struct NodeFields {
    /// Cohérence Γ — degré d'organisation
    pub gamma: f64,
    /// Phase Φ — relation de phase
    pub phi: f64,
    /// Tension T — déséquilibre relationnel
    pub tension: f64,
}

/// État complet des champs TTC sur la toile.
#[derive(Debug, Clone)]
pub struct TtcFieldState {
    /// Champs par nœud (UUID → fields)
    pub nodes: HashMap<Uuid, NodeFields>,
    /// Paramètres du modèle
    pub params: TtcParameters,
}

impl TtcFieldState {
    /// Construit l'état des champs à partir de la toile.
    ///
    /// Initialise Γ à partir du poids du nœud, Φ à 0, T à 0.
    pub fn from_web(web: &ContextWeb, params: TtcParameters) -> Self {
        let mut nodes = HashMap::new();
        for node in web.iter_nodes() {
            nodes.insert(
                node.id,
                NodeFields {
                    gamma: node.weight.clamp(0.01, 1.0), // Γ ∈ (0, 1]
                    phi: 0.0,                              // Phase initiale nulle
                    tension: node.ambiguity,                // T initiale = ambiguïté
                },
            );
        }
        Self { nodes, params }
    }
}

// ============================================================
// Opérateurs discrets sur le graphe
// ============================================================

/// Calcule le Laplacien discret de Γ au nœud i.
///
/// # Équation continue
/// □Γ = g^{μν} ∂_μ ∂_ν Γ
///
/// # Discrétisation
/// L_Γ|_i = Σ_{j∈N(i)} w_{ij} (Γ_i - Γ_j)
///
/// où w_{ij} est le poids du lien i→j et N(i) les voisins sortants.
pub fn laplacian_gamma(
    web: &ContextWeb,
    fields: &TtcFieldState,
    node_id: &Uuid,
) -> f64 {
    let gamma_i = fields.nodes.get(node_id).map(|f| f.gamma).unwrap_or(0.5);
    let mut laplacian = 0.0;

    for link in web.outgoing_links(node_id) {
        let gamma_j = fields.nodes.get(&link.target_id).map(|f| f.gamma).unwrap_or(0.5);
        laplacian += link.weight * (gamma_i - gamma_j);
    }

    // Terme entrant (liens inverses)
    for link in web.incoming_links(node_id) {
        let gamma_j = fields.nodes.get(&link.source_id).map(|f| f.gamma).unwrap_or(0.5);
        laplacian += link.weight * (gamma_i - gamma_j);
    }

    laplacian
}

/// Calcule le terme de phase « centrifuge » : Γ(∇Φ)²
///
/// # Équation continue
/// Γ(∇^μ Φ ∇_μ Φ)
///
/// # Discrétisation
/// Γ_i · Σ_{j∈N(i)} w_{ij} (Φ_i - Φ_j)²
pub fn phase_centrifugal_term(
    web: &ContextWeb,
    fields: &TtcFieldState,
    node_id: &Uuid,
) -> f64 {
    let gamma_i = fields.nodes.get(node_id).map(|f| f.gamma).unwrap_or(0.5);
    let phi_i = fields.nodes.get(node_id).map(|f| f.phi).unwrap_or(0.0);
    let mut sum = 0.0;

    for link in web.outgoing_links(node_id) {
        let phi_j = fields.nodes.get(&link.target_id).map(|f| f.phi).unwrap_or(0.0);
        let grad_phi = phi_i - phi_j;
        sum += link.weight * grad_phi * grad_phi;
    }

    gamma_i * sum
}

/// Calcule le Laplacien discret de T au nœud i.
///
/// □T|_i = Σ w_{ij} (T_i - T_j)
pub fn laplacian_tension(
    web: &ContextWeb,
    fields: &TtcFieldState,
    node_id: &Uuid,
) -> f64 {
    let t_i = fields.nodes.get(node_id).map(|f| f.tension).unwrap_or(0.0);
    let mut laplacian = 0.0;

    for link in web.outgoing_links(node_id) {
        let t_j = fields.nodes.get(&link.target_id).map(|f| f.tension).unwrap_or(0.0);
        laplacian += link.weight * (t_i - t_j);
    }

    for link in web.incoming_links(node_id) {
        let t_j = fields.nodes.get(&link.source_id).map(|f| f.tension).unwrap_or(0.0);
        laplacian += link.weight * (t_i - t_j);
    }

    laplacian
}

/// Calcule le courant de phase sur une arête i→j.
///
/// # Équation continue
/// J_Φ^μ = Γ² ∇^μ Φ
///
/// # Discrétisation
/// J_{ij} = Γ_i² · w_{ij} · (Φ_j - Φ_i)
pub fn phase_current(
    fields: &TtcFieldState,
    source_id: &Uuid,
    target_id: &Uuid,
    weight: f64,
) -> f64 {
    let gamma_i = fields.nodes.get(source_id).map(|f| f.gamma).unwrap_or(0.5);
    let phi_i = fields.nodes.get(source_id).map(|f| f.phi).unwrap_or(0.0);
    let phi_j = fields.nodes.get(target_id).map(|f| f.phi).unwrap_or(0.0);

    gamma_i * gamma_i * weight * (phi_j - phi_i)
}

/// Vérifie la conservation du courant de phase au nœud i.
///
/// # Équation continue
/// ∇_μ J_Φ^μ = 0  →  ∇_μ (Γ² ∇^μ Φ) = 0
///
/// # Discrétisation
/// div J|_i = Σ_{j∈N(i)} J_{ij} − Σ_{k∈N⁻¹(i)} J_{ki} = 0
///
/// Retourne la divergence (devrait être proche de 0).
pub fn phase_current_divergence(
    web: &ContextWeb,
    fields: &TtcFieldState,
    node_id: &Uuid,
) -> f64 {
    let mut divergence = 0.0;

    // Flux sortant (positif)
    for link in web.outgoing_links(node_id) {
        divergence += phase_current(fields, node_id, &link.target_id, link.weight);
    }

    // Flux entrant (négatif)
    for link in web.incoming_links(node_id) {
        divergence -= phase_current(fields, &link.source_id, node_id, link.weight);
    }

    divergence
}

// ============================================================
// Solveur des équations de champ TTC
// ============================================================

/// Résultat d'un pas du solveur TTC.
#[derive(Debug, Clone)]
pub struct FieldStepResult {
    /// Variation maximale de Γ dans ce pas
    pub max_delta_gamma: f64,
    /// Variation maximale de Φ
    pub max_delta_phi: f64,
    /// Variation maximale de T
    pub max_delta_tension: f64,
    /// Nombre de nœuds mis à jour
    pub nodes_updated: usize,
    /// Le solveur a-t-il convergé ?
    pub converged: bool,
}

/// Exécute un pas du solveur des équations de champ TTC.
///
/// Pour chaque nœud i, résout simultanément les 3 équations :
///
/// **Loi de Γ (Cohérence)** :
///   □Γ_i - Γ_i(∇Φ)²_i - α Γ_i(Γ_i² - v_Γ²) - 2λ T_i Γ_i = 0
///
/// **Loi de Φ (Phase)** :
///   div J_i = 0  →  Σ_j J_{ij} - Σ_k J_{ki} = 0
///
/// **Loi de T (Tension)** :
///   □T_i - β(T_i - v_T) - λ Γ_i² = 0
///
/// Utilise une relaxation itérative (Jacobi) avec pas d'apprentissage η.
pub fn step_field_equations(
    web: &ContextWeb,
    fields: &mut TtcFieldState,
    learning_rate: f64,
) -> FieldStepResult {
    let params = &fields.params;
    let mut max_delta_gamma = 0.0_f64;
    let mut max_delta_phi = 0.0_f64;
    let mut max_delta_tension = 0.0_f64;
    let mut nodes_updated = 0;

    // Sauvegarde l'état actuel pour Jacobi (mise à jour simultanée)
    let old_fields = fields.nodes.clone();

    for node in web.iter_nodes() {
        let node_id = node.id;
        let old = old_fields.get(&node_id).cloned().unwrap_or_default();

        // ─── Équation de Γ : □Γ - Γ(∇Φ)² - αΓ(Γ²-v_Γ²) - 2λTΓ = 0 ───
        let lap_g = laplacian_gamma(web, fields, &node_id);
        let centrifugal = phase_centrifugal_term(web, fields, &node_id);
        let higgs_term = params.alpha * old.gamma * (old.gamma * old.gamma - params.v_gamma * params.v_gamma);
        let coupling_term = 2.0 * params.lambda * old.tension * old.gamma;

        // Résidu de l'équation de Γ (devrait être 0)
        let residue_gamma = lap_g - centrifugal - higgs_term - coupling_term;

        // Mise à jour de Γ par descente de gradient sur le résidu
        let delta_gamma = -learning_rate * residue_gamma;
        let new_gamma = (old.gamma + delta_gamma).clamp(0.01, 1.0);

        // ─── Équation de Φ : div J = 0 → conservation du courant ───
        let divergence = phase_current_divergence(web, fields, &node_id);

        // Mise à jour de Φ : ajuste pour réduire la divergence
        let delta_phi = -learning_rate * divergence;

        // Projette Φ dans [0, 2π) (périodicité de la phase)
        let new_phi = (old.phi + delta_phi) % (2.0 * std::f64::consts::PI);
        let new_phi = if new_phi < 0.0 { new_phi + 2.0 * std::f64::consts::PI } else { new_phi };

        // ─── Équation de T : □T - β(T-v_T) - λΓ² = 0 ───
        let lap_t = laplacian_tension(web, fields, &node_id);
        let rappel = params.beta * (old.tension - params.v_tension);
        let source = params.lambda * old.gamma * old.gamma;

        // Résidu de l'équation de T
        let residue_tension = lap_t - rappel - source;

        let delta_tension = -learning_rate * residue_tension;
        let new_tension = (old.tension + delta_tension).clamp(0.0, 1.0);

        // ─── Applique les mises à jour ───
        if let Some(f) = fields.nodes.get_mut(&node_id) {
            let dg = (new_gamma - old.gamma).abs();
            let dp = (new_phi - old.phi).abs();
            let dt = (new_tension - old.tension).abs();

            max_delta_gamma = max_delta_gamma.max(dg);
            max_delta_phi = max_delta_phi.max(dp);
            max_delta_tension = max_delta_tension.max(dt);

            f.gamma = new_gamma;
            f.phi = new_phi;
            f.tension = new_tension;
            nodes_updated += 1;
        }
    }

    let converged = max_delta_gamma < 1e-6
        && max_delta_phi < 1e-6
        && max_delta_tension < 1e-6;

    FieldStepResult {
        max_delta_gamma,
        max_delta_phi,
        max_delta_tension,
        nodes_updated,
        converged,
    }
}

/// Résout les équations de champ TTC jusqu'à convergence ou max_iterations.
///
/// Retourne l'état final des champs et l'historique de convergence.
pub fn solve_field_equations(
    web: &ContextWeb,
    params: TtcParameters,
    learning_rate: f64,
    max_iterations: usize,
) -> (TtcFieldState, Vec<FieldStepResult>) {
    let mut fields = TtcFieldState::from_web(web, params);
    let mut history = Vec::with_capacity(max_iterations);

    for _ in 0..max_iterations {
        let result = step_field_equations(web, &mut fields, learning_rate);
        let converged = result.converged;
        history.push(result);

        if converged {
            break;
        }
    }

    (fields, history)
}

// ============================================================
// Métrique effective (gravité émergente)
// ============================================================

/// Calcule la métrique effective sur une arête i→j.
///
/// # Équation continue
/// g_{μν}^{eff} = f(Γ² - 2λT) η_{μν}
///
/// # Discrétisation
/// Le poids effectif du lien est modulé par la cohérence et la tension :
///   w_{ij}^{eff} = w_{ij} · f(Γ_i² + Γ_j² - 2λ(T_i + T_j))
///
/// où f(x) = 1 / (1 + e^{-k(x - x_0)}) est une sigmoïde centrée sur x_0.
pub fn effective_link_weight(
    fields: &TtcFieldState,
    source_id: &Uuid,
    target_id: &Uuid,
    base_weight: f64,
    params: &TtcParameters,
) -> f64 {
    let gamma_i = fields.nodes.get(source_id).map(|f| f.gamma).unwrap_or(params.v_gamma);
    let gamma_j = fields.nodes.get(target_id).map(|f| f.gamma).unwrap_or(params.v_gamma);
    let t_i = fields.nodes.get(source_id).map(|f| f.tension).unwrap_or(params.v_tension);
    let t_j = fields.nodes.get(target_id).map(|f| f.tension).unwrap_or(params.v_tension);

    // Argument de la métrique effective
    let arg = gamma_i * gamma_i + gamma_j * gamma_j - 2.0 * params.lambda * (t_i + t_j);

    // f(x) = sigmoïde : compresse dans (0, 2) autour de 1
    let f = 2.0 / (1.0 + (-arg).exp());

    base_weight * f
}

/// Calcule la « masse gravitationnelle » d'un nœud selon la TTC.
///
/// ρ_W = ½(∇Γ)² + ½Γ²(∇Φ)² + ½(∇T)² + U(Γ,T)
///
/// C'est la densité d'énergie de la Toile au nœud i.
pub fn energy_density(
    web: &ContextWeb,
    fields: &TtcFieldState,
    node_id: &Uuid,
    params: &TtcParameters,
) -> f64 {
    let f = fields.nodes.get(node_id).cloned().unwrap_or_default();
    let gamma = f.gamma;
    let tension = f.tension;
    let phi = f.phi;

    // ½(∇Γ)² : énergie cinétique de cohérence
    let mut grad_gamma_sq = 0.0;
    for link in web.outgoing_links(node_id) {
        let gamma_j = fields.nodes.get(&link.target_id).map(|n| n.gamma).unwrap_or(params.v_gamma);
        let grad = gamma - gamma_j;
        grad_gamma_sq += link.weight * grad * grad;
    }

    // ½Γ²(∇Φ)²
    let mut gamma_phi_sq = 0.0;
    for link in web.outgoing_links(node_id) {
        let phi_j = fields.nodes.get(&link.target_id).map(|n| n.phi).unwrap_or(0.0);
        let grad = phi - phi_j;
        gamma_phi_sq += gamma * gamma * link.weight * grad * grad;
    }

    // ½(∇T)²
    let mut grad_t_sq = 0.0;
    for link in web.outgoing_links(node_id) {
        let t_j = fields.nodes.get(&link.target_id).map(|n| n.tension).unwrap_or(0.0);
        let grad = tension - t_j;
        grad_t_sq += link.weight * grad * grad;
    }

    // Potentiel U(Γ,T) = α/4(Γ²-v_Γ²)² + β/2(T-v_T)² + λTΓ²
    let potential = params.alpha / 4.0 * (gamma * gamma - params.v_gamma * params.v_gamma).powi(2)
        + params.beta / 2.0 * (tension - params.v_tension).powi(2)
        + params.lambda * tension * gamma * gamma;

    0.5 * grad_gamma_sq + 0.5 * gamma_phi_sq + 0.5 * grad_t_sq + potential
}

// ============================================================
// Quantification de phase (condition de résonance)
// ============================================================

/// Vérifie la condition de quantification de phase le long d'un cycle.
///
/// # Équation
/// ∮ ∇Φ · dl = 2π n   (n ∈ ℤ)
///
/// # Discrétisation
/// Σ_{(i→j)∈cycle} w_{ij} (Φ_j - Φ_i) = 2π n
///
/// Retourne le nombre quantique n (arrondi) et l'erreur de quantification.
pub fn phase_quantization_along_path(
    fields: &TtcFieldState,
    path: &[(Uuid, Uuid, f64)], // (source, target, weight)
) -> (i64, f64) {
    let mut total_phase = 0.0;

    for (source, target, weight) in path {
        let phi_s = fields.nodes.get(source).map(|f| f.phi).unwrap_or(0.0);
        let phi_t = fields.nodes.get(target).map(|f| f.phi).unwrap_or(0.0);
        total_phase += weight * (phi_t - phi_s);
    }

    let n = (total_phase / (2.0 * std::f64::consts::PI)).round() as i64;
    let error = (total_phase - n as f64 * 2.0 * std::f64::consts::PI).abs();

    (n, error)
}

/// Calcule le spin effectif d'un nœud comme l'enroulement de phase.
///
/// Spin = (1/2π) · Σ_{cycles autour du nœud} ∮ ∇Φ · dl
///
/// Un spin demi-entier (ℏ/2) correspond à une périodicité 4π.
pub fn effective_spin(
    web: &ContextWeb,
    fields: &TtcFieldState,
    node_id: &Uuid,
) -> f64 {
    let mut total_winding = 0.0;

    // Parcourt les cycles de longueur 2 (i→j→i)
    for out_link in web.outgoing_links(node_id) {
        for in_link in web.incoming_links(node_id) {
            if out_link.target_id == in_link.source_id {
                let phi_i = fields.nodes.get(node_id).map(|f| f.phi).unwrap_or(0.0);
                let phi_j = fields.nodes.get(&out_link.target_id).map(|f| f.phi).unwrap_or(0.0);
                let forward = out_link.weight * (phi_j - phi_i);
                let backward = in_link.weight * (phi_i - phi_j);
                total_winding += forward + backward;
            }
        }
    }

    total_winding / (2.0 * std::f64::consts::PI)
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
    fn test_laplacian_constant_field() {
        let mut web = ContextWeb::new();
        let n1 = Node::new(NodeKind::Fact, "A".into(), 0.8, 0.2, vec![make_anchor("spec://a")]);
        let n2 = Node::new(NodeKind::Fact, "B".into(), 0.8, 0.2, vec![make_anchor("spec://b")]);
        let id1 = web.add_node(n1);
        let id2 = web.add_node(n2);
        web.add_link(Link::new(id1, id2, RelationKind::Refines, 0.5, 0.5)).unwrap();

        let mut fields = TtcFieldState::from_web(&web, TtcParameters::default());
        // Même Γ partout → Laplacien = 0
        fields.nodes.get_mut(&id1).unwrap().gamma = 0.7;
        fields.nodes.get_mut(&id2).unwrap().gamma = 0.7;

        let lap = laplacian_gamma(&web, &fields, &id1);
        assert!(lap.abs() < 1e-10, "Laplacien nul pour champ constant, reçu {}", lap);
    }

    #[test]
    fn test_phase_current_conservation() {
        let mut web = ContextWeb::new();
        let n1 = Node::new(NodeKind::Fact, "A".into(), 0.8, 0.2, vec![make_anchor("spec://a")]);
        let n2 = Node::new(NodeKind::Fact, "B".into(), 0.8, 0.2, vec![make_anchor("spec://b")]);
        let n3 = Node::new(NodeKind::Fact, "C".into(), 0.8, 0.2, vec![make_anchor("spec://c")]);
        let id1 = web.add_node(n1);
        let id2 = web.add_node(n2);
        let id3 = web.add_node(n3);
        web.add_link(Link::new(id1, id2, RelationKind::Refines, 0.5, 0.5)).unwrap();
        web.add_link(Link::new(id1, id3, RelationKind::Refines, 0.5, 0.5)).unwrap();

        let fields = TtcFieldState::from_web(&web, TtcParameters::default());
        let div = phase_current_divergence(&web, &fields, &id1);
        // Initialement Φ=0 partout → aucun courant → divergence nulle
        assert!(div.abs() < 1e-10, "Divergence nulle pour Φ constant");
    }

    #[test]
    fn test_field_solver_convergence() {
        let mut web = ContextWeb::new();
        let n1 = Node::new(NodeKind::Fact, "React".into(), 0.9, 0.1, vec![make_anchor("spec://react")]);
        let n2 = Node::new(NodeKind::Fact, "useState".into(), 0.85, 0.1, vec![make_anchor("spec://usestate")]);
        let id1 = web.add_node(n1);
        let id2 = web.add_node(n2);
        web.add_link(Link::new(id1, id2, RelationKind::Refines, 0.9, 0.85)).unwrap();

        let params = TtcParameters::default();
        let (fields, history) = solve_field_equations(&web, params, 0.1, 100);

        // Vérifie que le solveur a tourné
        assert!(!history.is_empty(), "Le solveur doit produire un historique");
        // Vérifie que les champs sont dans les bornes
        for (_, f) in &fields.nodes {
            assert!(f.gamma >= 0.01 && f.gamma <= 1.0, "Γ ∈ [0.01, 1.0]");
            assert!(f.tension >= 0.0 && f.tension <= 1.0, "T ∈ [0.0, 1.0]");
            assert!(f.phi >= 0.0 && f.phi < 2.0 * std::f64::consts::PI, "Φ ∈ [0, 2π)");
        }
    }

    #[test]
    fn test_effective_metric_modulates_weights() {
        let fields = TtcFieldState {
            nodes: HashMap::from([
                (Uuid::new_v4(), NodeFields { gamma: 0.9, phi: 0.0, tension: 0.1 }),
                (Uuid::new_v4(), NodeFields { gamma: 0.3, phi: 0.0, tension: 0.8 }),
            ]),
            params: TtcParameters::default(),
        };
        let ids: Vec<Uuid> = fields.nodes.keys().cloned().collect();

        let w_eff = effective_link_weight(&fields, &ids[0], &ids[1], 1.0, &TtcParameters::default());
        // Poids effectif ∈ (0, 2) à cause de la sigmoïde
        assert!(w_eff > 0.0 && w_eff < 2.0, "Poids effectif dans (0,2), reçu {}", w_eff);
    }

    #[test]
    fn test_energy_density_positive() {
        let mut web = ContextWeb::new();
        let n1 = Node::new(NodeKind::Fact, "A".into(), 0.8, 0.2, vec![make_anchor("spec://a")]);
        let id1 = web.add_node(n1);
        let fields = TtcFieldState::from_web(&web, TtcParameters::default());

        let rho = energy_density(&web, &fields, &id1, &TtcParameters::default());
        // ρ_W ≥ 0 (somme de carrés + potentiel positif)
        assert!(rho >= 0.0, "Densité d'énergie positive, reçu {}", rho);
    }
}