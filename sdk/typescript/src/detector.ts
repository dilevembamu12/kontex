/// @anchor: OKR O2 KR2.2 — Détection d'hallucination > 95%
/// HallucinationDetector : compare une réponse LLM à la toile TTC.
///
/// # Principe TTC
/// Une « hallucination » est une assertion qui :
/// 1. N'a pas d'ancre vérifiable (violation Principe A)
/// 2. Contredit un nœud existant de la toile (violation Principe C)
/// 3. A une ambiguïté excessive (violation Principe E_min)
///
/// # Stratégie de détection (Phase 0)
/// - Analyse textuelle de la réponse LLM
/// - Comparaison avec les nœuds de la toile via mots-clés
/// - Vérification d'ancrabilité des assertions

import type { ContextNode, HallucinationReport } from './types.js';
import type { WebWeaver } from './weaver.js';

/**
 * Configuration du détecteur d'hallucination.
 */
export interface DetectorConfiguration {
  /** Seuil de confiance en dessous duquel on suspecte une hallucination */
  readonly confidenceThreshold: number;
  /** Taille minimale des mots-clés pour la correspondance */
  readonly minimumKeywordLength: number;
  /** Nombre maximal de suggestions retournées */
  readonly maximumSuggestions: number;
}

const DEFAULT_DETECTOR_CONFIGURATION: DetectorConfiguration = {
  confidenceThreshold: 0.7,
  minimumKeywordLength: 4,
  maximumSuggestions: 5,
} as const;

/**
 * Détecteur d'hallucination basé sur la Toile Cosmologique.
 *
 * # Usage
 * ```typescript
 * const detector = new HallucinationDetector();
 * const report = detector.analyze(llmResponse, weaver);
 * if (report.isHallucination) {
 *   console.log('Hallucination détectée !', report.suggestions);
 * }
 * ```
 */
export class HallucinationDetector {
  private readonly configuration: DetectorConfiguration;

  constructor(configuration?: Partial<DetectorConfiguration>) {
    this.configuration = { ...DEFAULT_DETECTOR_CONFIGURATION, ...configuration };
  }

  /**
   * Analyse une réponse LLM par rapport à la toile TTC.
   * Fonction pure (E2) — ne modifie pas la toile.
   */
  analyze(llmResponse: string, weaver: WebWeaver): HallucinationReport {
    const allNodes = weaver.getAllNodes();
    const contradictingNodes: ContextNode[] = [];
    const suggestions: string[] = [];

    if (allNodes.length === 0) {
      // Toile vide : tout est potentiellement une hallucination
      return {
        isHallucination: true,
        confidence: 0.0,
        contradictingNodes: [],
        suggestions: ['La toile est vide — impossible de vérifier les assertions.'],
      };
    }

    // 1. Extrait les assertions de la réponse
    const assertions = this.extractAssertions(llmResponse);

    if (assertions.length === 0) {
      return {
        isHallucination: false,
        confidence: 0.9,
        contradictingNodes: [],
        suggestions: [],
      };
    }

    // 2. Pour chaque assertion, vérifie la cohérence avec la toile (Principe C)
    let contradictionCount = 0;
    let totalAssertions = assertions.length;

    for (const assertion of assertions) {
      const keywords = this.extractKeywords(assertion);

      for (const node of allNodes) {
        const nodeKeywords = this.extractKeywords(node.content);

        // Vérifie si les sujets sont similaires
        const commonKeywords = keywords.filter((kw) => nodeKeywords.includes(kw));

        if (commonKeywords.length >= 1) {
          // Les sujets se chevauchent — vérifie la contradiction

          // Méthode 1 : détection par négation explicite
          const assertionHasNegation = this.hasNegation(assertion);
          const nodeHasNegation = this.hasNegation(node.content);

          // Méthode 2 : détection par divergence sémantique (Jaccard partiel)
          const allUniqueWords = new Set([...keywords, ...nodeKeywords]);
          const jaccardSimilarity = commonKeywords.length / allUniqueWords.size;

          // Contradiction si :
          // - Négation divergente (l'un nie ce que l'autre affirme)
          // - OU sujets similaires (Jaccard > 0.2) mais pas identiques (Jaccard < 0.8)
          const isNegationContradiction = assertionHasNegation !== nodeHasNegation;
          const isSemanticDivergence = jaccardSimilarity > 0.3 && jaccardSimilarity < 0.8;

          if (isNegationContradiction || isSemanticDivergence) {
            // Divergence détectée — contradiction potentielle
            contradictionCount++;
            contradictingNodes.push(node);

            suggestions.push(
              `@resolution: l'assertion "${assertion.slice(0, 80)}" contredit le nœud ${node.id} ("${node.content.slice(0, 80)}") — vérifier les ancres respectives`,
            );
          }
        }
      }
    }

    // 3. Calcule le score de confiance
    const contradictionRatio = totalAssertions > 0
      ? contradictionCount / totalAssertions
      : 0;
    const confidence = Math.max(0, 1 - contradictionRatio);
    const isHallucination = confidence < this.configuration.confidenceThreshold;

    // 4. Ajoute des suggestions génériques si nécessaire
    if (suggestions.length === 0 && isHallucination) {
      suggestions.push(
        'Aucune contradiction explicite, mais la confiance est faible — ajouter plus de nœuds à la toile.',
      );
    }

    if (!isHallucination && suggestions.length === 0) {
      suggestions.push('✓ Réponse cohérente avec la toile TTC.');
    }

    return {
      isHallucination,
      confidence,
      contradictingNodes: contradictingNodes.slice(0, this.configuration.maximumSuggestions),
      suggestions: suggestions.slice(0, this.configuration.maximumSuggestions),
    };
  }

  /**
   * Extrait les assertions (phrases) d'une réponse LLM.
   * Fonction pure (E2).
   */
  private extractAssertions(text: string): string[] {
    return text
      .split(/[.!?;]\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
  }

  /**
   * Extrait les mots-clés significatifs d'un texte.
   * Fonction pure (E2).
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'le', 'la', 'les', 'des', 'une', 'est', 'pas', 'que', 'qui',
      'dans', 'sur', 'par', 'pour', 'avec', 'the', 'is', 'not', 'are',
      'this', 'that', 'and', 'for', 'from', 'was',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-zà-ÿ0-9\s]/g, '')
      .split(/\s+/)
      .filter((word) =>
        word.length >= this.configuration.minimumKeywordLength &&
        !stopWords.has(word),
      );
  }

  /**
   * Détecte la présence d'une négation dans un texte.
   * Fonction pure (E2).
   */
  private hasNegation(text: string): boolean {
    const negationPatterns = [
      /\bn['’]est pas\b/,
      /\bne pas\b/,
      /\bnot\b/,
      /\bis not\b/,
      /\bisn['’]t\b/,
      /\bfalse\b/,
      /\bfaux\b/,
      /\bjamais\b/,
    ];
    return negationPatterns.some((pattern) => pattern.test(text.toLowerCase()));
  }
}
