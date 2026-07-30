/// @anchor: PROJECT_CONTEXT.md §3.2 — anchor-verifier
/// Vérificateur d'ancrage — validation de la qualité des sources.

use crate::node::Anchor;

/// Résultat de validation d'une ancre (source).
#[derive(Debug, Clone)]
pub struct SourceValidation {
    /// L'URI est-elle syntaxiquement valide ?
    pub is_valid_uri: bool,
    /// L'URI est-elle accessible ? (Phase 1+)
    pub is_reachable: bool,
    /// Niveau de confiance dans cette source ∈ [0.0, 1.0]
    pub confidence: f64,
    /// Diagnostic
    pub message: String,
}

/// Valide une ancre (source) selon des heuristiques syntaxiques.
/// Fonction pure (E2).
///
/// En Phase 0 : validation syntaxique uniquement.
/// En Phase 1+ : vérification HTTP/FS réelle.
pub fn validate_anchor(anchor: &Anchor) -> SourceValidation {
    let is_valid_uri = is_valid_uri(&anchor.uri);
    // Phase 0 : on suppose toutes les URIs valides comme accessibles
    let is_reachable = is_valid_uri;

    let confidence = if is_valid_uri { 0.8 } else { 0.0 };

    let message = if is_valid_uri {
        format!("Source valide : {} (type: {:?})", anchor.uri, anchor.source_type)
    } else {
        format!("Source invalide : {} — URI mal formée", anchor.uri)
    };

    SourceValidation {
        is_valid_uri,
        is_reachable,
        confidence,
        message,
    }
}

/// Vérifie si une chaîne ressemble à une URI valide.
/// Supporte : http(s), file, test, spec
/// Fonction pure (E2).
fn is_valid_uri(uri: &str) -> bool {
    if uri.is_empty() {
        return false;
    }

    // Schémas acceptés
    let valid_schemes = ["http://", "https://", "file://", "test://", "spec://"];

    if valid_schemes.iter().any(|scheme| uri.starts_with(scheme)) {
        // Vérification basique : pas d'espaces
        if uri.contains(char::is_whitespace) {
            return false;
        }
        return true;
    }

    // Les chemins absolus Unix sont acceptés
    if uri.starts_with('/') {
        return !uri.contains(char::is_whitespace);
    }

    false
}
