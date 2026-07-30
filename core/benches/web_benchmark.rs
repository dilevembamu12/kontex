/// @anchor: OKR O2 — KR2.1 : 10 000 nœuds en < 100ms
/// Benchmark de performance du ContextWeb.
///
/// Usage: cargo bench

use criterion::{BenchmarkId, Criterion, criterion_group, criterion_main};
use kontex_ttc::engine::entropy::analyze_entropy;
use kontex_ttc::engine::propagation::propagate_context;
use kontex_ttc::node::{Anchor, AnchorType, Node, NodeKind};
use kontex_ttc::web::ContextWeb;
use std::time::Duration;

fn make_anchor(uri: &str) -> Anchor {
    Anchor {
        uri: uri.to_string(),
        source_type: AnchorType::Specification,
        anchored_at: chrono::Utc::now(),
    }
}

fn make_node(id: usize) -> Node {
    Node::new(
        NodeKind::Fact,
        format!("nœud_de_test_{id}"),
        0.5,
        0.1,
        vec![make_anchor(&format!("spec://test/{id}"))],
    )
}

fn benchmark_insert_nodes(c: &mut Criterion) {
    let mut group = c.benchmark_group("ContextWeb::add_node");

    for size in [100, 1_000, 10_000, 50_000] {
        group.bench_with_input(BenchmarkId::new("insert", size), &size, |b, &size| {
            b.iter(|| {
                let mut web = ContextWeb::new();
                let anchor = make_anchor("bench://scalability");
                for i in 0..size {
                    let node = Node::new(
                        NodeKind::Fact,
                        format!("n{i}"),
                        0.5,
                        0.1,
                        vec![anchor.clone()],
                    );
                    web.add_node(node);
                }
                web
            });
        });
    }

    group.finish();
}

fn benchmark_propagation(c: &mut Criterion) {
    let mut group = c.benchmark_group("propagation");

    // Construit une toile de 1000 nœuds avec des liens
    let mut web = ContextWeb::new();
    let anchor = make_anchor("bench://propagation");
    let mut node_ids = Vec::new();

    for i in 0..1000 {
        let node = Node::new(
            NodeKind::Fact,
            format!("prop_node_{i}"),
            0.5,
            0.1,
            vec![anchor.clone()],
        );
        let id = web.add_node(node);
        node_ids.push(id);
    }

    // Ajoute des liens entre nœuds consécutifs
    for i in 0..999 {
        let link = kontex_ttc::Link::new(
            node_ids[i],
            node_ids[i + 1],
            kontex_ttc::RelationKind::DependsOn,
            0.8,
            0.9,
        );
        web.add_link(link).ok();
    }

    group.bench_function("propagate_1000_nodes", |b| {
        b.iter(|| {
            propagate_context(&web, &node_ids[0], 0.01, 10);
        });
    });

    group.finish();
}

fn benchmark_entropy_analysis(c: &mut Criterion) {
    let mut group = c.benchmark_group("entropy");

    let mut web = ContextWeb::new();
    let anchor = make_anchor("bench://entropy");

    for i in 0..5000 {
        let node = Node::new(
            NodeKind::Fact,
            format!("entropy_node_{i}"),
            0.5,
            if i % 2 == 0 { 0.2 } else { 0.8 },
            vec![anchor.clone()],
        );
        web.add_node(node);
    }

    web.update_global_entropy();

    group.bench_function("analyze_5000_nodes", |b| {
        b.iter(|| {
            analyze_entropy(&web);
        });
    });

    group.finish();
}

criterion_group! {
    name = web_benches;
    config = Criterion::default()
        .sample_size(30)
        .measurement_time(Duration::from_secs(10))
        .warm_up_time(Duration::from_secs(3));
    targets = benchmark_insert_nodes, benchmark_propagation, benchmark_entropy_analysis
}

criterion_main!(web_benches);
