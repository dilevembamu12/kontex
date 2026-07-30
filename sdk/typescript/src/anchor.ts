/// @anchor: Principe A — Ancrage TTC
/// AnchorProvider : résolution et validation des sources d'ancrage.
///
/// # Rôle
/// Vérifie que chaque assertion (nœud) est reliée à une source vérifiable.
/// C'est le composant clé pour le Vibe Coding sans hallucination.
///
/// # Formule TTC
/// A(f) ⟹ ∃s ∈ Sources : lien(f, s)

import type { Anchor, AnchorType, AnchorVerification } from './types.js';

/**
 * Configuration du fournisseur d'ancres.
 */
export interface AnchorProviderConfiguration {
  /** Schémas d'URI acceptés */
  readonly allowedSchemes: readonly string[];
  /** Types de sources considérées comme « officielles » */
  readonly officialSourceTypes: readonly AnchorType[];
  /** Nombre minimal de sources requis */
  readonly minimumSources: number;
}

const DEFAULT_ANCHOR_CONFIGURATION: AnchorProviderConfiguration = {
  allowedSchemes: ['http://', 'https://', 'file://', 'test://', 'spec://'],
  officialSourceTypes: ['official_documentation', 'specification'],
  minimumSources: 1,
} as const;

/**
 * Fournisseur d'ancres — valide et évalue la qualité des sources.
 *
 * # Usage
 * ```typescript
 * const provider = new AnchorProvider();
 * const result = provider.verify([{ uri: 'https://nodejs.org/api/fs.html', sourceType: 'official_documentation' }]);
 * ```
 */
export class AnchorProvider {
  private readonly configuration: AnchorProviderConfiguration;

  constructor(configuration?: Partial<AnchorProviderConfiguration>) {
    this.configuration = { ...DEFAULT_ANCHOR_CONFIGURATION, ...configuration };
  }

  /**
   * Vérifie qu'un ensemble d'ancres satisfait le Principe A.
   * Fonction pure (E2).
   */
  verify(anchors: readonly Anchor[]): AnchorVerification {
    const validAnchors = anchors.filter((a) => this.isValidUri(a.uri));
    const sourceCount = validAnchors.length;
    const isAnchored = sourceCount >= this.configuration.minimumSources;

    // Calcule la force d'ancrage
    const strength = this.computeAnchorStrength(validAnchors);

    // Détecte les catégories manquantes
    const missingCategories = this.findMissingCategories(validAnchors);

    return {
      isAnchored,
      strength,
      sourceCount,
      missingCategories,
    };
  }

  /**
   * Valide la syntaxe d'une URI.
   * Fonction pure (E2).
   */
  isValidUri(uri: string): boolean {
    if (uri.length === 0) return false;
    if (uri.includes(' ') || uri.includes('\t') || uri.includes('\n')) return false;

    // Schémas acceptés
    if (this.configuration.allowedSchemes.some((scheme) => uri.startsWith(scheme))) {
      return true;
    }

    // Chemin absolu Unix
    if (uri.startsWith('/')) return true;

    return false;
  }

  /**
   * Calcule la force d'ancrage d'un ensemble de sources.
   * Fonction pure (E2).
   *
   * Stratégie :
   * - Nombre de sources (saturation à 5)
   * - Bonus pour sources officielles
   */
  private computeAnchorStrength(anchors: readonly Anchor[]): number {
    if (anchors.length === 0) return 0;

    const countFactor = Math.min(anchors.length, 5) / 5;
    const qualityFactor = anchors.reduce((sum, a) => {
      switch (a.sourceType) {
        case 'official_documentation':
        case 'specification':
          return sum + 0.3;
        case 'test_case':
        case 'code_repository':
          return sum + 0.2;
        case 'peer_review':
          return sum + 0.15;
        default:
          return sum + 0.1;
      }
    }, 0);

    return Math.min(countFactor * 0.5 + Math.min(qualityFactor, 0.5), 1.0);
  }

  /**
   * Trouve les catégories de sources manquantes.
   * Fonction pure (E2).
   */
  private findMissingCategories(anchors: readonly Anchor[]): readonly string[] {
    const missing: string[] = [];

    if (anchors.length === 0) {
      missing.push('ANY_SOURCE');
      return missing;
    }

    const hasOfficial = anchors.some((a) =>
      this.configuration.officialSourceTypes.includes(a.sourceType),
    );

    if (!hasOfficial) {
      missing.push('OFFICIAL_SOURCE');
    }

    return missing;
  }
}
