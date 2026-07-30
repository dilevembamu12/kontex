/// @anchor: Tests unitaires du SDK KontEx
/// Valide les 4 modules : client, anchor, weaver, detector.
/// Chaque test vérifie un principe TTC.

import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { AnchorProvider } from '../src/anchor.js';
import { WebWeaver, NodeBuilder, WeaveError } from '../src/weaver.js';
import { HallucinationDetector } from '../src/detector.js';
import type { Anchor, ContextLink } from '../src/types.js';

// ============================================================
// AnchorProvider — Principe A (Ancrage)
// ============================================================

describe('AnchorProvider — Principe A', () => {
  const provider = new AnchorProvider();

  it('détecte un nœud sans ancre', () => {
    const result = provider.verify([]);
    expect(result.isAnchored).toBe(false);
    expect(result.strength).toBe(0);
    expect(result.missingCategories).toContain('ANY_SOURCE');
  });

  it('valide une ancre officielle', () => {
    const anchors: readonly Anchor[] = [
      { uri: 'https://nodejs.org/api/fs.html', sourceType: 'official_documentation' },
    ];
    const result = provider.verify(anchors);
    expect(result.isAnchored).toBe(true);
    expect(result.strength).toBeGreaterThan(0.3);
  });

  it('rejette une URI invalide', () => {
    expect(provider.isValidUri('')).toBe(false);
    expect(provider.isValidUri('pas une url')).toBe(false);
    expect(provider.isValidUri('https://example.com')).toBe(true);
    expect(provider.isValidUri('spec://test')).toBe(true);
  });

  it('détecte les sources officielles manquantes', () => {
    const anchors: readonly Anchor[] = [
      { uri: 'test://random-blog-post', sourceType: 'other' },
    ];
    const result = provider.verify(anchors);
    expect(result.missingCategories).toContain('OFFICIAL_SOURCE');
  });
});

// ============================================================
// WebWeaver — Construction de toile
// ============================================================

describe('WebWeaver', () => {
  const weaver = new WebWeaver();

  it('construit un nœud ancré via NodeBuilder', () => {
    const node = new NodeBuilder('fact', 'La Terre est ronde')
      .withAnchor({ uri: 'spec://nasa', sourceType: 'specification' })
      .withWeight(0.9)
      .withAmbiguity(0.05)
      .build();

    expect(node.kind).toBe('fact');
    expect(node.weight).toBe(0.9);
    expect(node.anchors).toHaveLength(1);
    expect(node.id).toBeTruthy();
  });

  it('rejette un nœud sans ancre (Principe A)', () => {
    expect(() => {
      new NodeBuilder('fact', 'assertion sans preuve').build();
    }).toThrow(WeaveError);
  });

  it('rejette un poids invalide', () => {
    expect(() => {
      new NodeBuilder('fact', 'x')
        .withAnchor({ uri: 'test://x', sourceType: 'specification' })
        .withWeight(1.5)
        .build();
    }).toThrow(WeaveError);
  });

  it('ajoute et retrouve des nœuds dans la toile', () => {
    const localWeaver = new WebWeaver();
    const node = new NodeBuilder('fact', 'Le soleil est une étoile')
      .withAnchor({ uri: 'spec://astronomy', sourceType: 'specification' })
      .build();

    localWeaver.addNode(node);
    expect(localWeaver.nodeCount).toBe(1);
    expect(localWeaver.getNode(node.id)).toBeDefined();
  });

  it('rejette un nœud qui viole le Principe A', () => {
    const localWeaver = new WebWeaver();
    const node: ContextNode = {
      id: 'test-id',
      kind: 'fact',
      content: 'sans ancre',
      weight: 0.5,
      ambiguity: 0.5,
      anchors: [], // Violation Principe A
      metadata: new Set(),
      createdAt: new Date().toISOString(),
    };

    expect(() => localWeaver.addNode(node)).toThrow(WeaveError);
  });

  it('calcule la force de propagation', () => {
    const localWeaver = new WebWeaver();
    const a = new NodeBuilder('fact', 'A')
      .withAnchor({ uri: 'spec://a', sourceType: 'specification' })
      .build();
    const b = new NodeBuilder('fact', 'B')
      .withAnchor({ uri: 'spec://b', sourceType: 'specification' })
      .build();

    localWeaver.addNode(a);
    localWeaver.addNode(b);

    const link: ContextLink = {
      id: randomUUID(),
      sourceId: a.id,
      targetId: b.id,
      relation: 'depends_on',
      weight: 0.8,
      relevanceScore: 0.9,
    };

    localWeaver.addLink(link);

    const force = localWeaver.computePropagationForce(a.id, b.id);
    expect(force).toBeCloseTo(0.72, 5); // 0.8 × 0.9
  });
});

// ============================================================
// HallucinationDetector — Détection d'hallucination
// ============================================================

describe('HallucinationDetector', () => {
  const detector = new HallucinationDetector();

  it('détecte une hallucination quand la toile est vide', () => {
    const weaver = new WebWeaver();
    const report = detector.analyze('La Terre est plate', weaver);
    expect(report.isHallucination).toBe(true);
    expect(report.confidence).toBe(0);
  });

  it('détecte une contradiction avec la toile (Principe C)', () => {
    const weaver = new WebWeaver();

    // Nœud dans la toile : vérité établie
    const truthNode = new NodeBuilder('fact', 'La Terre est ronde')
      .withAnchor({ uri: 'spec://nasa', sourceType: 'specification' })
      .withAmbiguity(0.05)
      .build();
    weaver.addNode(truthNode);

    // Réponse LLM : contradiction
    const report = detector.analyze('La Terre est plate. Elle ne tourne pas.', weaver);

    // La réponse contredit le nœud — doit être détectée
    expect(report.confidence).toBeLessThan(1.0);
  });

  it('valide une réponse cohérente avec la toile', () => {
    const weaver = new WebWeaver();

    const node = new NodeBuilder('fact', 'Le soleil est une étoile')
      .withAnchor({ uri: 'spec://astronomy', sourceType: 'specification' })
      .build();
    weaver.addNode(node);

    const report = detector.analyze('Le soleil brille dans le ciel', weaver);

    // Réponse non contradictoire — confiance élevée
    expect(report.isHallucination).toBe(false);
  });

  it('fournit des suggestions en cas d\'hallucination', () => {
    const weaver = new WebWeaver();

    const node = new NodeBuilder('fact', 'La gravité existe')
      .withAnchor({ uri: 'spec://physics', sourceType: 'specification' })
      .build();
    weaver.addNode(node);

    const report = detector.analyze('La gravité est fausse. Les objets ne tombent pas.', weaver);

    expect(report.suggestions.length).toBeGreaterThan(0);
    expect(report.suggestions[0]).toContain('@resolution');
  });
});
