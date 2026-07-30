/// @anchor: PROJECT_CONTEXT.md §2 — Théorie de la Toile Cosmologique (TTC)
/// @anchor: PROJECT_CONTEXT.md §3.1 — Core Engine Rust
///
/// KontEx TTC Engine — Moteur de la Toile Cosmologique.
///
/// # Modules
/// - `node` : Nœuds de la toile (faits, règles, code, documentation)
/// - `link` : Liens pondérés entre nœuds
/// - `web` : La toile contextuelle (graphe orienté)
/// - `engine` : Les 4 principes TTC (Ancrage, Cohérence, Propagation, Entropie)
/// - `verifier` : Validation des sources d'ancrage
///
/// # Performance (OKR O2)
/// - 10 000 nœuds tissés en < 100ms
/// - Taux de détection d'hallucination > 95%

#[cfg(feature = "napi")]
pub mod bridge;
pub mod engine;
pub mod link;
pub mod node;
pub mod verifier;
pub mod web;

// Réexportation des types principaux pour une API ergonomique
pub use link::{Link, RelationKind};
pub use node::{Anchor, AnchorType, Node, NodeKind};
pub use web::ContextWeb;

/// Version du moteur TTC.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Préambule TTC affiché au chargement du moteur.
pub fn ttc_banner() -> String {
    format!(
        "KontEx TTC Engine v{VERSION} — Théorie de la Toile Cosmologique\n\
         Principes : Ancrage (A), Cohérence (C), Propagation (P), Entropie Minimale (E_min)\n\
         Architecture : Nœuds → Liens → Toile → Moteur TTC"
    )
}
