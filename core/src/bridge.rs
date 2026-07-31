/// @anchor: napi-rs — https://napi.rs/docs/introduction/getting-started
/// Bridge Rust → Node.js : expose les types et algorithmes TTC à l'API Express.
///
/// # Modules exposés
/// - `JsNode`, `JsAnchor`, `JsLink` : types JS correspondant aux structs Rust
/// - `JsWeb` : ContextWeb wrappé pour Node.js
/// - Fonctions : add_node, add_link, verify_anchoring, detect_contradiction,
///   propagate_context, resolve_contradiction, minimize_entropy, get_stats

use napi_derive::napi;
use std::sync::Mutex;

use crate::engine::anchoring::verify_node_anchoring;
use crate::engine::coherence::auto_resolve_contradiction;
use crate::engine::entropy::minimize_entropy;
use crate::engine::field_solver::{self, TtcFieldState, TtcParameters};
use crate::engine::propagation::propagate_context;
use crate::node::{Anchor as RustAnchor, AnchorType as RustAnchorType, Node as RustNode, NodeKind as RustNodeKind};
use crate::web::ContextWeb;
use crate::{Link as RustLink, RelationKind as RustRelationKind};

// ============================================================
// Types JS exposés
// ============================================================

/// Type de nœud dans la toile contextuelle.
#[napi]
pub enum NodeKind {
    Fact,
    Rule,
    Code,
    Documentation,
}

impl From<RustNodeKind> for NodeKind {
    fn from(kind: RustNodeKind) -> Self {
        match kind {
            RustNodeKind::Fact => NodeKind::Fact,
            RustNodeKind::Rule => NodeKind::Rule,
            RustNodeKind::Code => NodeKind::Code,
            RustNodeKind::Documentation => NodeKind::Documentation,
        }
    }
}

/// Type de source d'ancrage.
#[napi]
pub enum AnchorType {
    OfficialDocumentation,
    TestCase,
    Specification,
    CodeRepository,
    PeerReview,
    Other,
}

/// Source vérifiable (Principe A).
#[napi(object)]
pub struct JsAnchor {
    pub uri: String,
    pub source_type: String,
    pub description: Option<String>,
}

/// Nœud de la Toile Cosmologique (format JS).
#[napi(object)]
pub struct JsNode {
    pub id: String,
    pub kind: String,
    pub content: String,
    pub weight: f64,
    pub ambiguity: f64,
    pub anchors: Vec<JsAnchor>,
    pub metadata: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Lien pondéré (format JS).
#[napi(object)]
pub struct JsLink {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub relation: String,
    pub weight: f64,
    pub relevance_score: f64,
    pub created_at: String,
}

/// Résultat de vérification d'ancrage (Principe A).
#[napi(object)]
pub struct JsAnchorVerification {
    pub is_anchored: bool,
    pub strength: f64,
    pub source_count: u32,
    pub missing_categories: Vec<String>,
}

/// Rapport de propagation de contexte (Principe P).
#[napi(object)]
pub struct JsPropagationResult {
    pub source_id: String,
    pub reached_count: u32,
    pub max_depth: u32,
    pub nodes: Vec<JsReachedNode>,
}

#[napi(object)]
pub struct JsReachedNode {
    pub node_id: String,
    pub score: f64,
}

/// Rapport de contradiction (Principe C).
#[napi(object)]
pub struct JsContradictionReport {
    pub is_contradiction: bool,
    pub confidence: f64,
    pub contradictions: Vec<String>,
    pub suggested_resolution: Option<String>,
}

/// Statistiques globales de la toile.
#[napi(object)]
pub struct JsWebStats {
    pub node_count: u32,
    pub link_count: u32,
    pub anchored_count: u32,
    pub anchoring_rate: f64,
    pub contradiction_count: u32,
    pub global_entropy: f64,
}

// ============================================================
// Helpers de conversion Rust → JS
// ============================================================

fn rust_node_to_js(node: &RustNode) -> JsNode {
    JsNode {
        id: node.id.to_string(),
        kind: match node.kind {
            RustNodeKind::Fact => "fact",
            RustNodeKind::Rule => "rule",
            RustNodeKind::Code => "code",
            RustNodeKind::Documentation => "documentation",
        }
        .to_string(),
        content: node.content.clone(),
        weight: node.weight,
        ambiguity: node.ambiguity,
        anchors: node
            .sources
            .iter()
            .map(|a| JsAnchor {
                uri: a.uri.clone(),
                source_type: match a.source_type {
                    RustAnchorType::OfficialDocumentation => "official_documentation",
                    RustAnchorType::TestCase => "test_case",
                    RustAnchorType::Specification => "specification",
                    RustAnchorType::CodeRepository => "code_repository",
                    RustAnchorType::PeerReview => "peer_review",
                    RustAnchorType::Other(_) => "other",
                }
                .to_string(),
                description: None,
            })
            .collect(),
        metadata: node.metadata.iter().cloned().collect(),
        created_at: node.created_at.to_rfc3339(),
        updated_at: node.updated_at.to_rfc3339(),
    }
}

// ============================================================
// Types TTC — Paramètres du Lagrangien MCW-1
// ============================================================

/// Paramètres du Lagrangien MCW-1 (5 paramètres libres).
#[napi(object)]
pub struct JsTtcParameters {
    pub alpha: f64,
    pub beta: f64,
    pub lambda: f64,
    pub v_gamma: f64,
    pub v_tension: f64,
}

/// État des champs TTC pour un nœud.
#[napi(object)]
pub struct JsNodeFields {
    pub node_id: String,
    pub gamma: f64,
    pub phi: f64,
    pub tension: f64,
}

/// Résultat du solveur TTC.
#[napi(object)]
pub struct JsSolveResult {
    pub iterations: u32,
    pub converged: bool,
    pub node_fields: Vec<JsNodeFields>,
}

// ============================================================
// ContextWeb wrappé — Classe JS avec état mutable protégé
// ============================================================

/// Contexte Web TTC (Thread-safe via Mutex).
#[napi]
pub struct JsWeb {
    web: Mutex<ContextWeb>,
}

#[napi]
impl JsWeb {
    /// Crée une nouvelle toile vide.
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            web: Mutex::new(ContextWeb::new()),
        }
    }

    /// Ajoute un nœud à la toile.
    /// Retourne l'UUID du nœud créé.
    #[napi]
    pub fn add_node(
        &self,
        kind: String,
        content: String,
        weight: f64,
        ambiguity: f64,
        anchors: Vec<JsAnchor>,
    ) -> napi::Result<String> {
        let rust_kind = match kind.as_str() {
            "fact" => RustNodeKind::Fact,
            "rule" => RustNodeKind::Rule,
            "code" => RustNodeKind::Code,
            "documentation" => RustNodeKind::Documentation,
            _ => {
                return Err(napi::Error::from_reason(format!(
                    "NodeKind invalide : {kind}"
                )))
            }
        };

        let rust_anchors: Vec<RustAnchor> = anchors
            .iter()
            .map(|a| RustAnchor {
                uri: a.uri.clone(),
                source_type: match a.source_type.as_str() {
                    "official_documentation" => RustAnchorType::OfficialDocumentation,
                    "test_case" => RustAnchorType::TestCase,
                    "specification" => RustAnchorType::Specification,
                    "code_repository" => RustAnchorType::CodeRepository,
                    "peer_review" => RustAnchorType::PeerReview,
                    _ => RustAnchorType::Other(a.source_type.clone()),
                },
                anchored_at: chrono::Utc::now(),
            })
            .collect();

        let node = RustNode::new(rust_kind, content, weight, ambiguity, rust_anchors);
        let id = node.id.to_string();
        let mut web = self.web.lock().map_err(|e| {
            napi::Error::from_reason(format!("Mutex lock failed: {e}"))
        })?;
        web.add_node(node);

        Ok(id)
    }

    /// Récupère un nœud par ID.
    #[napi]
    pub fn get_node(&self, id: String) -> napi::Result<Option<JsNode>> {
        let web = self.web.lock().map_err(|e| {
            napi::Error::from_reason(format!("Mutex lock failed: {e}"))
        })?;

        let uuid = uuid::Uuid::parse_str(&id).map_err(|e| {
            napi::Error::from_reason(format!("UUID invalide : {e}"))
        })?;

        Ok(web.get_node(&uuid).map(|n| rust_node_to_js(n)))
    }

    /// Liste tous les nœuds.
    #[napi]
    pub fn list_nodes(&self) -> napi::Result<Vec<JsNode>> {
        let web = self.web.lock().map_err(|e| {
            napi::Error::from_reason(format!("Mutex lock failed: {e}"))
        })?;
        Ok(web.iter_nodes().map(|n| rust_node_to_js(n)).collect())
    }

    /// Ajoute un lien entre deux nœuds.
    #[napi]
    pub fn add_link(
        &self,
        source_id: String,
        target_id: String,
        relation: String,
        weight: f64,
        relevance_score: f64,
    ) -> napi::Result<String> {
        let source_uuid = uuid::Uuid::parse_str(&source_id).map_err(|e| {
            napi::Error::from_reason(format!("UUID source invalide : {e}"))
        })?;
        let target_uuid = uuid::Uuid::parse_str(&target_id).map_err(|e| {
            napi::Error::from_reason(format!("UUID cible invalide : {e}"))
        })?;

        let rust_relation = match relation.as_str() {
            "depends_on" => RustRelationKind::DependsOn,
            "contradicts" => RustRelationKind::Contradicts,
            "refines" => RustRelationKind::Refines,
            "exemplifies" => RustRelationKind::Exemplifies,
            "references" => RustRelationKind::References,
            _ => RustRelationKind::Custom(relation.clone()),
        };

        let link = RustLink::new(source_uuid, target_uuid, rust_relation, weight, relevance_score);
        let link_id = link.id.to_string();

        let mut web = self.web.lock().map_err(|e| {
            napi::Error::from_reason(format!("Mutex lock failed: {e}"))
        })?;
        web.add_link(link).map_err(|e| napi::Error::from_reason(e))?;

        Ok(link_id)
    }

    // ============================================================
    // Algorithmes TTC
    // ============================================================

    /// Principe A — Vérifie l'ancrage d'un nœud.
    #[napi]
    pub fn verify_anchoring(&self, node_id: String) -> napi::Result<JsAnchorVerification> {
        let web = self.web.lock().map_err(|e| {
            napi::Error::from_reason(format!("Mutex lock failed: {e}"))
        })?;

        let uuid = uuid::Uuid::parse_str(&node_id).map_err(|e| {
            napi::Error::from_reason(format!("UUID invalide : {e}"))
        })?;

        let node = web.get_node(&uuid).ok_or_else(|| {
            napi::Error::from_reason(format!("Nœud {node_id} introuvable"))
        })?;

        let verification = verify_node_anchoring(node);

        Ok(JsAnchorVerification {
            is_anchored: verification.is_anchored,
            strength: verification.strength,
            source_count: verification.source_count as u32,
            missing_categories: verification.missing_categories,
        })
    }

    /// Principe C — Détecte une contradiction entre un texte et la toile.
    #[napi]
    pub fn detect_contradiction(&self, content: String) -> napi::Result<JsContradictionReport> {
        let web = self.web.lock().map_err(|e| {
            napi::Error::from_reason(format!("Mutex lock failed: {e}"))
        })?;

        // Parcourt tous les nœuds pour détecter une contradiction sémantique
        let keywords = extract_keywords(&content);
        let content_has_negation = has_negation(&content);
        let mut contradictions: Vec<String> = Vec::new();

        for node in web.iter_nodes() {
            let node_keywords = extract_keywords(&node.content);
            let common: Vec<_> = keywords
                .iter()
                .filter(|kw| node_keywords.contains(kw))
                .collect();

            if common.is_empty() {
                continue;
            }

            let node_has_negation = has_negation(&node.content);
            if content_has_negation != node_has_negation {
                contradictions.push(format!(
                    "Contradiction avec le nœud {} : \"{}\"",
                    node.id,
                    &node.content[..node.content.len().min(80)]
                ));
            }
        }

        let has_contradictions = !contradictions.is_empty();
        let confidence = if has_contradictions {
            (1.0 - contradictions.len() as f64 * 0.2).max(0.0)
        } else {
            1.0
        };

        Ok(JsContradictionReport {
            is_contradiction: has_contradictions,
            confidence,
            contradictions,
            suggested_resolution: if has_contradictions {
                Some("@resolution: vérifier les ancres respectives et trancher selon la force d'ancrage".to_string())
            } else {
                None
            },
        })
    }

    /// Principe P — Propage le contexte depuis un nœud source (BFS pondéré).
    #[napi]
    pub fn propagate_context(
        &self,
        source_id: String,
        threshold: f64,
        max_depth: u32,
    ) -> napi::Result<JsPropagationResult> {
        let web = self.web.lock().map_err(|e| {
            napi::Error::from_reason(format!("Mutex lock failed: {e}"))
        })?;

        let uuid = uuid::Uuid::parse_str(&source_id).map_err(|e| {
            napi::Error::from_reason(format!("UUID invalide : {e}"))
        })?;

        let result = propagate_context(&web, &uuid, threshold, max_depth as usize);

        let nodes: Vec<JsReachedNode> = result
            .reached_nodes
            .iter()
            .filter(|(id, _)| *id != &result.source_id)
            .map(|(id, score)| JsReachedNode {
                node_id: id.to_string(),
                score: *score,
            })
            .collect();

        Ok(JsPropagationResult {
            source_id,
            reached_count: nodes.len() as u32,
            max_depth: result.max_depth as u32,
            nodes,
        })
    }

    /// Principe C — Résout une contradiction entre deux nœuds.
    #[napi]
    pub fn resolve_contradiction(
        &self,
        node_a: String,
        node_b: String,
    ) -> napi::Result<String> {
        let web = self.web.lock().map_err(|e| {
            napi::Error::from_reason(format!("Mutex lock failed: {e}"))
        })?;

        let uuid_a = uuid::Uuid::parse_str(&node_a).map_err(|e| {
            napi::Error::from_reason(format!("UUID invalide : {e}"))
        })?;
        let uuid_b = uuid::Uuid::parse_str(&node_b).map_err(|e| {
            napi::Error::from_reason(format!("UUID invalide : {e}"))
        })?;

        Ok(auto_resolve_contradiction(&web, &uuid_a, &uuid_b))
    }

    /// Principe E_min — Minimise l'entropie de la toile.
    #[napi]
    pub fn minimize_entropy(&self, max_iterations: u32) -> napi::Result<f64> {
        let mut web = self.web.lock().map_err(|e| {
            napi::Error::from_reason(format!("Mutex lock failed: {e}"))
        })?;

        let report = minimize_entropy(&mut web, max_iterations as usize);
        Ok(report.global_entropy)
    }

    /// Statistiques globales de la toile.
    #[napi]
    pub fn get_stats(&self) -> napi::Result<JsWebStats> {
        let web = self.web.lock().map_err(|e| {
            napi::Error::from_reason(format!("Mutex lock failed: {e}"))
        })?;

        let mut anchored_count = 0u32;
        let mut total_ambiguity = 0.0f64;

        for node in web.iter_nodes() {
            let verification = verify_node_anchoring(node);
            if verification.is_anchored {
                anchored_count = anchored_count.saturating_add(1);
            }
            total_ambiguity += node.ambiguity;
        }

        let node_count = web.node_count() as u32;
        let entropy = if node_count > 0 {
            total_ambiguity / node_count as f64
        } else {
            0.0
        };

        Ok(JsWebStats {
            node_count,
            link_count: web.link_count() as u32,
            anchored_count,
            anchoring_rate: if node_count > 0 {
                anchored_count as f64 / node_count as f64
            } else {
                1.0
            },
            contradiction_count: web.contradiction_count() as u32,
            global_entropy: entropy,
        })
    }

    // ============================================================
    // Solveur TTC — Équations de champ physique
    // ============================================================

    /// Résout les équations de champ TTC (Γ, Φ, T) sur la toile.
    ///
    /// # Paramètres
    /// - `params` : les 5 constantes du Lagrangien MCW-1
    /// - `learning_rate` : pas de relaxation (ex: 0.1)
    /// - `iterations` : nombre max d'itérations
    ///
    /// # Retour
    /// L'état des champs pour chaque nœud après résolution.
    #[napi]
    pub fn solve_field_equations(
        &self,
        params: JsTtcParameters,
        learning_rate: f64,
        iterations: u32,
    ) -> napi::Result<JsSolveResult> {
        let web = self.web.lock().map_err(|e| {
            napi::Error::from_reason(format!("Mutex lock failed: {e}"))
        })?;

        let ttc_params = TtcParameters {
            alpha: params.alpha,
            beta: params.beta,
            lambda: params.lambda,
            v_gamma: params.v_gamma,
            v_tension: params.v_tension,
        };

        let (fields, history) = field_solver::solve_field_equations(
            &web,
            ttc_params,
            learning_rate,
            iterations as usize,
        );

        let node_fields: Vec<JsNodeFields> = fields
            .nodes
            .iter()
            .map(|(id, f)| JsNodeFields {
                node_id: id.to_string(),
                gamma: f.gamma,
                phi: f.phi,
                tension: f.tension,
            })
            .collect();

        Ok(JsSolveResult {
            iterations: history.len() as u32,
            converged: history.last().map(|h| h.converged).unwrap_or(false),
            node_fields,
        })
    }

    /// Retourne la tension topologique T d'un nœud après résolution des champs.
    ///
    /// La tension T est l'indicateur d'hallucination :
    /// - T ≈ v_T (proche de 0) → cohérent avec la toile
    /// - T ≫ v_T → contradiction topologique → hallucination probable
    #[napi]
    pub fn get_tension_residue(&self, node_id: String) -> napi::Result<f64> {
        let uuid = uuid::Uuid::parse_str(&node_id).map_err(|e| {
            napi::Error::from_reason(format!("UUID invalide : {e}"))
        })?;

        let web = self.web.lock().map_err(|e| {
            napi::Error::from_reason(format!("Mutex lock failed: {e}"))
        })?;

        // Résout d'abord les équations de champ
        let params = TtcParameters::default();
        let (fields, _) = field_solver::solve_field_equations(&web, params, 0.1, 30);

        // Récupère la tension du nœud
        let tension = fields
            .nodes
            .get(&uuid)
            .map(|f| f.tension)
            .unwrap_or(0.0);

        Ok(tension)
    }

    /// Retourne l'état complet des champs TTC pour tous les nœuds.
    #[napi]
    pub fn get_field_state(&self) -> napi::Result<Vec<JsNodeFields>> {
        let web = self.web.lock().map_err(|e| {
            napi::Error::from_reason(format!("Mutex lock failed: {e}"))
        })?;

        let params = TtcParameters::default();
        let (fields, _) = field_solver::solve_field_equations(&web, params, 0.1, 30);

        let result: Vec<JsNodeFields> = fields
            .nodes
            .iter()
            .map(|(id, f)| JsNodeFields {
                node_id: id.to_string(),
                gamma: f.gamma,
                phi: f.phi,
                tension: f.tension,
            })
            .collect();

        Ok(result)
    }

    /// Calcule le résidu de l'équation de tension sur une arête.
    ///
    /// □T - β(T-v_T) - λΓ² = 0
    ///
    /// Si le résidu est élevé, la connexion est en état de tension anormale.
    #[napi]
    pub fn get_edge_tension(
        &self,
        source_id: String,
        target_id: String,
    ) -> napi::Result<f64> {
        let source_uuid = uuid::Uuid::parse_str(&source_id).map_err(|e| {
            napi::Error::from_reason(format!("UUID source invalide : {e}"))
        })?;
        let target_uuid = uuid::Uuid::parse_str(&target_id).map_err(|e| {
            napi::Error::from_reason(format!("UUID cible invalide : {e}"))
        })?;

        let web = self.web.lock().map_err(|e| {
            napi::Error::from_reason(format!("Mutex lock failed: {e}"))
        })?;

        let params = TtcParameters::default();
        let (fields, _) = field_solver::solve_field_equations(&web, params, 0.1, 30);

        let weight = web
            .outgoing_links(&source_uuid)
            .iter()
            .find(|l| l.target_id == target_uuid)
            .map(|l| l.weight)
            .unwrap_or(0.5);

        let residue = crate::engine::coherence::tension_field_residue(
            &fields, &source_uuid, &target_uuid, weight,
        );

        Ok(residue)
    }
}

// ============================================================
// Helpers de texte (privés)
// ============================================================

fn extract_keywords(text: &str) -> Vec<String> {
    let stop_words: std::collections::HashSet<&str> = [
        "le", "la", "les", "des", "une", "est", "pas", "que", "qui", "dans",
        "sur", "par", "pour", "avec", "the", "is", "not", "are", "this", "that",
        "and", "for", "from", "was",
    ]
    .iter()
    .copied()
    .collect();

    text.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c.is_whitespace() { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .filter(|w| w.len() >= 4 && !stop_words.contains(w))
        .map(|w| w.to_string())
        .collect()
}

fn has_negation(text: &str) -> bool {
    let lower = text.to_lowercase();
    let patterns = [
        "n'est pas", "ne pas", "not ", "is not", "isn't", "false", "faux", "jamais",
    ];
    patterns.iter().any(|p| lower.contains(p))
}
