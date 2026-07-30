/// @anchor: Tests d'intégration du moteur TTC
/// Valide les 4 principes TTC de bout en bout.

use kontex_ttc::engine::anchoring::{compute_anchoring_rate, verify_all_anchors, verify_node_anchoring};
use kontex_ttc::engine::coherence::{auto_resolve_contradiction, verify_global_coherence};
use kontex_ttc::engine::entropy::{analyze_entropy, minimize_entropy};
use kontex_ttc::engine::propagation::propagate_context;
use kontex_ttc::node::{Anchor, AnchorType, Node, NodeKind};
use kontex_ttc::web::ContextWeb;
use kontex_ttc::{Link, RelationKind};

fn make_anchor(uri: &str) -> Anchor {
    Anchor {
        uri: uri.to_string(),
        source_type: AnchorType::Specification,
        anchored_at: chrono::Utc::now(),
    }
}

// ============================================================
// Tests du Principe A — Ancrage
// ============================================================

#[test]
fn test_principe_a_all_nodes_anchored() {
    let mut web = ContextWeb::new();
    for i in 0..100 {
        let node = Node::new(
            NodeKind::Fact,
            format!("fait_{i}"),
            0.5,
            0.1,
            vec![make_anchor(&format!("spec://test/{i}"))],
        );
        web.add_node(node);
    }

    let nodes: Vec<&Node> = web.iter_nodes().collect();
    let verifications = verify_all_anchors(&nodes);
    let rate = compute_anchoring_rate(&verifications);

    assert_eq!(rate, 1.0, "Tous les nœuds doivent être ancrés");
}

#[test]
fn test_principe_a_weak_anchor_detection() {
    let node = Node::new(
        NodeKind::Fact,
        "fait faible".into(),
        0.5,
        0.1,
        vec![Anchor {
            uri: "test://weak".into(),
            source_type: AnchorType::Other("blog".into()),
            anchored_at: chrono::Utc::now(),
        }],
    );

    let verification = verify_node_anchoring(&node);
    assert!(verification.is_anchored);
    // Une seule source non-officielle → force faible
    assert!(verification.strength < 0.3, "Force d'ancrage devrait être faible");
}

// ============================================================
// Tests du Principe C — Cohérence
// ============================================================

#[test]
fn test_principe_c_contradiction_detection() {
    let mut web = ContextWeb::new();

    let a = Node::new(
        NodeKind::Fact,
        "La Terre est plate".into(),
        0.8,
        0.1,
        vec![make_anchor("spec://flat-earth")],
    );
    let b = Node::new(
        NodeKind::Fact,
        "La Terre n'est pas plate, elle est ronde".into(),
        0.8,
        0.1,
        vec![make_anchor("spec://nasa")],
    );

    let id_a = a.id;
    let id_b = b.id;
    web.add_node(a);
    web.add_node(b);

    let contradiction = Link::new(id_a, id_b, RelationKind::Contradicts, 1.0, 1.0);
    web.add_link(contradiction).unwrap();

    let analyses = verify_global_coherence(&web);
    assert!(!analyses.is_empty(), "Doit détecter la contradiction");
}

#[test]
fn test_principe_c_auto_resolution() {
    let mut web = ContextWeb::new();

    // Nœud A : bien ancré (force élevée)
    let a = Node::new(
        NodeKind::Fact,
        "La Terre est ronde".into(),
        0.9,
        0.05,
        vec![
            make_anchor("spec://nasa"),
            make_anchor("spec://esa"),
            make_anchor("spec://jaxa"),
        ],
    );
    // Nœud B : faiblement ancré
    let b = Node::new(
        NodeKind::Fact,
        "La Terre est plate".into(),
        0.5,
        0.9,
        vec![Anchor {
            uri: "blog://random-post".into(),
            source_type: AnchorType::Other("blog".into()),
            anchored_at: chrono::Utc::now(),
        }],
    );

    let id_a = a.id;
    let id_b = b.id;
    web.add_node(a);
    web.add_node(b);

    let contradiction = Link::new(id_a, id_b, RelationKind::Contradicts, 1.0, 1.0);
    web.add_link(contradiction).unwrap();

    let result = auto_resolve_contradiction(&mut web, &id_a, &id_b);
    assert!(result.is_ok(), "La résolution automatique doit réussir");
    assert_eq!(web.contradiction_count(), 0, "Plus de contradiction après résolution");
}

// ============================================================
// Tests du Principe P — Propagation
// ============================================================

#[test]
fn test_principe_p_propagation_chain() {
    let mut web = ContextWeb::new();

    // Crée une chaîne de nœuds A → B → C → D
    let a = Node::new(NodeKind::Fact, "A".into(), 1.0, 0.1, vec![make_anchor("spec://a")]);
    let b = Node::new(NodeKind::Fact, "B".into(), 1.0, 0.1, vec![make_anchor("spec://b")]);
    let c = Node::new(NodeKind::Fact, "C".into(), 1.0, 0.1, vec![make_anchor("spec://c")]);
    let d = Node::new(NodeKind::Fact, "D".into(), 1.0, 0.1, vec![make_anchor("spec://d")]);

    let id_a = a.id;
    let id_b = b.id;
    let id_c = c.id;
    let id_d = d.id;

    web.add_node(a);
    web.add_node(b);
    web.add_node(c);
    web.add_node(d);

    // Liens avec poids décroissants
    web.add_link(Link::new(id_a, id_b, RelationKind::DependsOn, 1.0, 1.0)).unwrap();
    web.add_link(Link::new(id_b, id_c, RelationKind::DependsOn, 0.9, 0.9)).unwrap();
    web.add_link(Link::new(id_c, id_d, RelationKind::DependsOn, 0.8, 0.8)).unwrap();

    let result = propagate_context(&web, &id_a, 0.01, 10);

    // A atteint B, C, D avec des scores décroissants
    assert!(result.reached_nodes.contains_key(&id_b));
    assert!(result.reached_nodes.contains_key(&id_c));
    assert!(result.reached_nodes.contains_key(&id_d));

    // Score de D doit être inférieur à celui de B (atténuation)
    let score_b = result.reached_nodes[&id_b];
    let score_d = result.reached_nodes[&id_d];
    assert!(score_d < score_b, "Atténuation : score(D) < score(B)");
}

// ============================================================
// Tests du Principe E_min — Entropie Minimale
// ============================================================

#[test]
fn test_principe_e_min_entropy_reduction() {
    let mut web = ContextWeb::new();

    for i in 0..10 {
        let node = Node::new(
            NodeKind::Fact,
            format!("nœud_{i}"),
            0.5,
            0.9, // Très ambigu
            vec![make_anchor("spec://test")],
        );
        web.add_node(node);
    }

    let before = web.update_global_entropy();
    assert!(before > 0.8, "Entropie initiale élevée");

    let reduced = minimize_entropy(&mut web, 5);
    assert!(reduced > 0, "Au moins un nœud réduit");

    let after = web.global_entropy();
    assert!(after < before, "L'entropie doit diminuer après minimisation");
}

#[test]
fn test_principe_e_min_full_report() {
    let mut web = ContextWeb::new();

    // Mélange de nœuds clairs et ambigus
    for i in 0..100 {
        let ambiguity = if i % 3 == 0 { 0.9 } else { 0.1 };
        let node = Node::new(
            NodeKind::Fact,
            format!("n{i}"),
            0.5,
            ambiguity,
            vec![make_anchor("spec://e_min")],
        );
        web.add_node(node);
    }

    web.update_global_entropy();
    let report = analyze_entropy(&web);

    // ~33 nœuds sur 100 ont une ambiguïté > 0.7
    assert!(report.high_ambiguity_count > 0);
    assert!(!report.reduction_suggestions.is_empty());
    assert_eq!(report.most_ambiguous_nodes.len(), 10); // Top 10
}

// ============================================================
// Test de scalabilité (OKR O2)
// ============================================================

#[test]
fn test_scalability_10k_nodes_under_100ms() {
    let mut web = ContextWeb::new();
    let anchor = make_anchor("bench://okr");

    let start = std::time::Instant::now();

    for i in 0..10_000 {
        let node = Node::new(
            NodeKind::Fact,
            format!("nœud_{i}"),
            0.5,
            0.1,
            vec![anchor.clone()],
        );
        web.add_node(node);
    }

    let elapsed = start.elapsed();

    assert_eq!(web.node_count(), 10_000);
    assert!(
        elapsed.as_millis() < 100,
        "OKR O2 KR2.1 ÉCHEC : 10k nœuds en {}ms (cible < 100ms)",
        elapsed.as_millis()
    );

    println!(
        "✓ OKR O2 KR2.1 : 10 000 nœuds insérés en {}ms",
        elapsed.as_millis()
    );
}
