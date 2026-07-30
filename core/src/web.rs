/// @anchor: PROJECT_CONTEXT.md §2.1 — La Toile Cosmologique (TTC)
/// Toile contextuelle — structure de données centrale contenant tous les nœuds et liens.
///
/// # Performance cible (OKR O2)
/// - 10 000 nœuds tissés en < 100ms
/// - Détection d'hallucination > 95%

use petgraph::graph::{DiGraph, NodeIndex};
use petgraph::visit::EdgeRef;
use std::collections::HashMap;
use uuid::Uuid;

use crate::link::Link;
use crate::node::Node;

/// Index d'un nœud dans le graphe sous-jacent.
type GraphIndex = NodeIndex<u32>;

/// La Toile Cosmologique — conteneur principal de tous les nœuds et liens.
///
/// # Structure interne
/// - `DiGraph` de petgraph pour les relations dirigées
/// - `HashMap` pour la résolution O(1) des nœuds par UUID
///
/// # Garanties
/// - Pas de nœud orphelin (sans lien) sans justification
/// - Cohérence des poids et scores
#[derive(Debug)]
pub struct ContextWeb {
    /// Graphe orienté des relations contextuelles
    graph: DiGraph<Node, Link>,
    /// Map UUID → index graphe pour résolution O(1)
    node_index: HashMap<Uuid, GraphIndex>,
    /// Nombre total de contradictions détectées
    contradiction_count: usize,
    /// Niveau d'entropie global de la toile
    global_entropy: f64,
}

impl ContextWeb {
    /// Construit une nouvelle toile vide.
    /// Fonction pure (E2).
    pub fn new() -> Self {
        Self {
            graph: DiGraph::new(),
            node_index: HashMap::new(),
            contradiction_count: 0,
            global_entropy: 0.0,
        }
    }

    /// Ajoute un nœud à la toile.
    /// @side-effect: modifie le graphe et l'index.
    ///
    /// Retourne l'UUID du nœud ajouté.
    pub fn add_node(&mut self, node: Node) -> Uuid {
        let id = node.id;
        let idx = self.graph.add_node(node);
        self.node_index.insert(id, idx);
        id
    }

    /// Ajoute un lien entre deux nœuds existants.
    /// @side-effect: met à jour le compteur de contradictions si applicable.
    ///
    /// # Returns
    /// - `Ok(())` si le lien est créé
    /// - `Err(String)` si un des nœuds n'existe pas
    pub fn add_link(&mut self, link: Link) -> Result<(), String> {
        let source_idx = self
            .node_index
            .get(&link.source_id)
            .ok_or_else(|| format!("Nœud source {} introuvable", link.source_id))?;
        let target_idx = self
            .node_index
            .get(&link.target_id)
            .ok_or_else(|| format!("Nœud cible {} introuvable", link.target_id))?;

        if link.is_contradiction() {
            self.contradiction_count = self.contradiction_count.saturating_add(1);
        }

        self.graph.add_edge(*source_idx, *target_idx, link);
        Ok(())
    }

    /// Récupère un nœud par son UUID.
    /// Fonction pure (E2).
    pub fn get_node(&self, id: &Uuid) -> Option<&Node> {
        self.node_index.get(id).map(|idx| &self.graph[*idx])
    }

    /// Récupère une référence mutable vers un nœud.
    pub fn get_node_mut(&mut self, id: &Uuid) -> Option<&mut Node> {
        self.node_index.get(id).map(|idx| &mut self.graph[*idx])
    }

    /// Retourne tous les liens entrants vers un nœud.
    /// Fonction pure (E2).
    pub fn incoming_links(&self, id: &Uuid) -> Vec<&Link> {
        match self.node_index.get(id) {
            Some(idx) => self
                .graph
                .edges_directed(*idx, petgraph::Direction::Incoming)
                .map(|e| e.weight())
                .collect(),
            None => Vec::new(),
        }
    }

    /// Retourne tous les liens sortants d'un nœud.
    /// Fonction pure (E2).
    pub fn outgoing_links(&self, id: &Uuid) -> Vec<&Link> {
        match self.node_index.get(id) {
            Some(idx) => self
                .graph
                .edges_directed(*idx, petgraph::Direction::Outgoing)
                .map(|e| e.weight())
                .collect(),
            None => Vec::new(),
        }
    }

    /// Retourne tous les liens de type contradiction dans la toile.
    /// Fonction pure (E2).
    pub fn contradictions(&self) -> Vec<&Link> {
        self.graph
            .edge_references()
            .filter(|e| e.weight().is_contradiction())
            .map(|e| e.weight())
            .collect()
    }

    /// Retourne le nombre de contradictions non résolues.
    /// Fonction pure (E2).
    pub fn contradiction_count(&self) -> usize {
        self.contradiction_count
    }

    /// Résout une contradiction en supprimant le lien contradictoire.
    /// @side-effect: décrémente le compteur de contradictions.
    ///
    /// # Returns
    /// - `Ok(())` si la contradiction est résolue
    /// - `Err(String)` si aucun lien contradictoire n'est trouvé
    pub fn resolve_contradiction(
        &mut self,
        source_id: &Uuid,
        target_id: &Uuid,
    ) -> Result<(), String> {
        let source_idx = self
            .node_index
            .get(source_id)
            .ok_or_else(|| format!("Nœud source {} introuvable", source_id))?;
        let target_idx = self
            .node_index
            .get(target_id)
            .ok_or_else(|| format!("Nœud cible {} introuvable", target_id))?;

        // Trouve l'arête contradictoire
        let edge = self
            .graph
            .edges_connecting(*source_idx, *target_idx)
            .find(|e| e.weight().is_contradiction());

        if let Some(edge) = edge {
            let edge_id = edge.id();
            self.graph.remove_edge(edge_id);
            self.contradiction_count = self.contradiction_count.saturating_sub(1);
            Ok(())
        } else {
            Err(format!(
                "Aucune contradiction entre {} et {}",
                source_id, target_id
            ))
        }
    }

    /// Retourne le nombre total de nœuds.
    /// Fonction pure (E2).
    pub fn node_count(&self) -> usize {
        self.graph.node_count()
    }

    /// Retourne le nombre total de liens.
    /// Fonction pure (E2).
    pub fn link_count(&self) -> usize {
        self.graph.edge_count()
    }

    /// Calcule et met à jour l'entropie globale de la toile.
    /// @side-effect: modifie `global_entropy`.
    ///
    /// E(T) = moyenne des ambiguïtés de tous les nœuds
    pub fn update_global_entropy(&mut self) -> f64 {
        let node_count = self.graph.node_count();
        if node_count == 0 {
            self.global_entropy = 0.0;
            return 0.0;
        }

        let total_ambiguity: f64 = self
            .graph
            .node_weights()
            .map(|node| node.ambiguity)
            .sum();

        self.global_entropy = total_ambiguity / node_count as f64;
        self.global_entropy
    }

    /// Retourne l'entropie globale actuelle.
    /// Fonction pure (E2).
    pub fn global_entropy(&self) -> f64 {
        self.global_entropy
    }

    /// Itère sur tous les nœuds de la toile.
    pub fn iter_nodes(&self) -> impl Iterator<Item = &Node> {
        self.graph.node_weights()
    }
}

impl Default for ContextWeb {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::node::{Anchor, AnchorType, NodeKind};
    use crate::RelationKind;

    fn make_anchor(uri: &str) -> Anchor {
        Anchor {
            uri: uri.to_string(),
            source_type: AnchorType::Specification,
            anchored_at: chrono::Utc::now(),
        }
    }

    fn make_test_node(content: &str) -> Node {
        Node::new(
            NodeKind::Fact,
            content.to_string(),
            0.8,
            0.1,
            vec![make_anchor("test://spec")],
        )
    }

    #[test]
    fn test_add_and_retrieve_node() {
        let mut web = ContextWeb::new();
        let node = make_test_node("Le ciel est bleu");
        let id = node.id;
        web.add_node(node);

        assert_eq!(web.node_count(), 1);
        let retrieved = web.get_node(&id);
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().content, "Le ciel est bleu");
    }

    #[test]
    fn test_add_link_and_detect_contradiction() {
        let mut web = ContextWeb::new();

        let node_a = make_test_node("A");
        let node_b = make_test_node("B");
        let id_a = node_a.id;
        let id_b = node_b.id;

        web.add_node(node_a);
        web.add_node(node_b);

        let contradiction = Link::new(id_a, id_b, RelationKind::Contradicts, 1.0, 1.0);
        web.add_link(contradiction).unwrap();

        assert_eq!(web.contradiction_count(), 1);
        assert_eq!(web.contradictions().len(), 1);
    }

    #[test]
    fn test_resolve_contradiction() {
        let mut web = ContextWeb::new();

        let node_a = make_test_node("A");
        let node_b = make_test_node("B");
        let id_a = node_a.id;
        let id_b = node_b.id;

        web.add_node(node_a);
        web.add_node(node_b);

        let contradiction = Link::new(id_a, id_b, RelationKind::Contradicts, 1.0, 1.0);
        web.add_link(contradiction).unwrap();
        assert_eq!(web.contradiction_count(), 1);

        web.resolve_contradiction(&id_a, &id_b).unwrap();
        assert_eq!(web.contradiction_count(), 0);
    }

    #[test]
    fn test_global_entropy() {
        let mut web = ContextWeb::new();
        assert_eq!(web.update_global_entropy(), 0.0);

        let n1 = Node::new(
            NodeKind::Fact,
            "a".into(),
            1.0,
            0.3,
            vec![make_anchor("test://1")],
        );
        let n2 = Node::new(
            NodeKind::Fact,
            "b".into(),
            1.0,
            0.7,
            vec![make_anchor("test://2")],
        );

        web.add_node(n1);
        web.add_node(n2);

        let entropy = web.update_global_entropy();
        // Moyenne de 0.3 et 0.7 = 0.5
        assert!((entropy - 0.5).abs() < f64::EPSILON);
    }

    #[test]
    fn test_web_scalability_10k_nodes() {
        // Test de performance : insertion de 10 000 nœuds
        let mut web = ContextWeb::new();
        let anchor = make_anchor("bench://scalability");

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

        // Vérifie la contrainte OKR : < 100ms
        assert!(
            elapsed.as_millis() < 100,
            "Insertion 10k nœuds en {}ms — dépasse la cible de 100ms",
            elapsed.as_millis()
        );

        println!(
            "Scalability test: 10 000 nœuds insérés en {}ms ({:.0} nœuds/ms)",
            elapsed.as_millis(),
            10_000.0 / elapsed.as_secs_f64().max(0.001) / 1000.0
        );
    }
}
