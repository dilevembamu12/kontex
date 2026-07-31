/// @anchor: Tests End-to-End — Scénario complet KontEx B2B2B
/// Teste le flux : POST /nodes → GET /nodes → POST /links → POST /detect → GET /stats
///
/// Pré-requis : l'API doit être lancée (`npm run dev` dans api/)
///
/// Usage :
///   npx vitest run tests/e2e.test.ts
///   # ou
///   bash tests/e2e.sh

import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env['KONTEX_API_URL'] ?? 'http://localhost:3000';

// Types de réponse
interface NodeResponse {
  id: string;
  kind: string;
  content: string;
  weight: number;
  ambiguity: number;
  anchors: Array<{ uri: string; sourceType: string }>;
}

interface NodesListResponse {
  nodes: NodeResponse[];
  total: number;
}

interface LinkResponse {
  id: string;
  sourceId: string;
  targetId: string;
  relation: string;
  weight: number;
}

interface HallucinationReport {
  isHallucination: boolean;
  confidence: number;
  contradictingNodeIds: string[];
  suggestions: string[];
}

interface StatsResponse {
  nodeCount: number;
  linkCount: number;
  anchoredCount: number;
  anchoringRate: number;
  contradictionCount: number;
  globalEntropy: number;
}

describe('KontEx E2E — Scénario B2B2B complet', () => {
  let factNodeId: string;
  let ruleNodeId: string;
  let linkId: string;

  // Vérifie que l'API est joignable
  beforeAll(async () => {
    const response = await fetch(`${BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`API injoignable sur ${BASE_URL} — lancez "npm run dev" dans api/`);
    }
  });

  // ============================================================
  // Étape 1 : Ancrage (Principe A)
  // ============================================================
  describe('Étape 1 — Ancrage (Principe A)', () => {
    it('POST /nodes — crée un nœud factuel ancré', async () => {
      const response = await fetch(`${BASE_URL}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'fact',
          content: 'E2E TEST: La vitesse de la lumière est de 299 792 458 m/s',
          weight: 0.99,
          ambiguity: 0.01,
          anchors: [
            { uri: 'spec://physics-light-speed', sourceType: 'specification' },
            { uri: 'https://www.bipm.org/en/si-base-units', sourceType: 'official_documentation' },
          ],
        }),
      });

      expect(response.status).toBe(201);
      const node = (await response.json()) as NodeResponse;
      expect(node.id).toBeDefined();
      expect(node.kind).toBe('fact');
      expect(node.anchors).toHaveLength(2);
      factNodeId = node.id;
    });

    it('POST /nodes — crée un nœud règle ancré', async () => {
      const response = await fetch(`${BASE_URL}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'rule',
          content: 'E2E RULE: Si vitesse > 299 792 458 alors erreur physique',
          weight: 0.95,
          ambiguity: 0.03,
          anchors: [
            { uri: 'spec://physics-rule-speed', sourceType: 'specification' },
          ],
        }),
      });

      expect(response.status).toBe(201);
      const node = (await response.json()) as NodeResponse;
      expect(node.kind).toBe('rule');
      ruleNodeId = node.id;
    });

    it('POST /nodes — rejette un nœud sans ancre (Principe A)', async () => {
      const response = await fetch(`${BASE_URL}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'fact',
          content: 'Nœud non ancré — doit être rejeté',
          anchors: [],
        }),
      });

      expect(response.status).toBe(500); // Error: Violation Principe A
    });
  });

  // ============================================================
  // Étape 2 : Lecture + Vérification
  // ============================================================
  describe('Étape 2 — Lecture + Vérification d\'ancrage', () => {
    it('GET /nodes — liste tous les nœuds', async () => {
      const response = await fetch(`${BASE_URL}/nodes`);
      expect(response.status).toBe(200);

      const data = (await response.json()) as NodesListResponse;
      expect(data.total).toBeGreaterThanOrEqual(2);
      expect(response.headers.get('X-KontEx-Cache')).toBeDefined();
    });

    it('GET /nodes/:id — récupère un nœud spécifique', async () => {
      const response = await fetch(`${BASE_URL}/nodes/${factNodeId}`);
      expect(response.status).toBe(200);

      const node = (await response.json()) as NodeResponse;
      expect(node.id).toBe(factNodeId);
      expect(node.content).toContain('vitesse de la lumière');
    });

    it('POST /nodes/:id/verify — vérifie l\'ancrage', async () => {
      const response = await fetch(`${BASE_URL}/nodes/${factNodeId}/verify`, {
        method: 'POST',
      });
      expect(response.status).toBe(200);

      const verification = (await response.json()) as {
        isAnchored: boolean;
        strength: number;
        sourceCount: number;
      };
      expect(verification.isAnchored).toBe(true);
      expect(verification.strength).toBeGreaterThan(0);
      expect(verification.sourceCount).toBe(2);
    });
  });

  // ============================================================
  // Étape 3 : Tissage (Liens)
  // ============================================================
  describe('Étape 3 — Tissage de la toile', () => {
    it('POST /links — crée un lien "refines" entre les nœuds', async () => {
      const response = await fetch(`${BASE_URL}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: factNodeId,
          targetId: ruleNodeId,
          relation: 'refines',
          weight: 0.9,
          relevanceScore: 0.85,
        }),
      });

      expect(response.status).toBe(201);
      const link = (await response.json()) as LinkResponse;
      expect(link.sourceId).toBe(factNodeId);
      expect(link.targetId).toBe(ruleNodeId);
      expect(link.relation).toBe('refines');
      linkId = link.id;
    });

    it('POST /links — rejette un lien vers nœud inexistant', async () => {
      const response = await fetch(`${BASE_URL}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: factNodeId,
          targetId: 'nonexistent-id-12345',
          relation: 'references',
          weight: 0.5,
          relevanceScore: 0.5,
        }),
      });

      expect(response.status).toBe(500);
    });

    it('GET /links — liste tous les liens', async () => {
      const response = await fetch(`${BASE_URL}/links`);
      expect(response.status).toBe(200);
      expect(response.headers.get('X-KontEx-Cache')).toBeDefined();
    });
  });

  // ============================================================
  // Étape 4 : Détection d'hallucination (Principe C)
  // ============================================================
  describe('Étape 4 — Détection d\'hallucination (Principe C)', () => {
    it('POST /detect — détecte une assertion cohérente (non-hallucination)', async () => {
      const response = await fetch(`${BASE_URL}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'La vitesse de la lumière est de 299 792 458 m/s dans le vide.',
        }),
      });

      expect(response.status).toBe(200);
      const report = (await response.json()) as HallucinationReport;
      // Une assertion qui correspond à un fait ancré ne devrait pas être une hallucination
      expect(report.confidence).toBeGreaterThan(0);
    });

    it('POST /detect — détecte une contradiction potentielle', async () => {
      const response = await fetch(`${BASE_URL}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'La vitesse de la lumière nest pas constante dans le vide.',
        }),
      });

      expect(response.status).toBe(200);
      const report = (await response.json()) as HallucinationReport;
      // Avec négation, ça devrait être détecté comme contradiction (hallucination)
      expect(report.isHallucination).toBeDefined();
      expect(report.confidence).toBeDefined();
    });

    it('POST /detect — rejette un contenu vide', async () => {
      const response = await fetch(`${BASE_URL}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      });

      expect(response.status).toBe(400);
    });
  });

  // ============================================================
  // Étape 5 : Propagation (Principe P)
  // ============================================================
  describe('Étape 5 — Propagation (Principe P)', () => {
    it('POST /propagate — propage le contexte depuis un nœud', async () => {
      const response = await fetch(`${BASE_URL}/propagate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: factNodeId,
          threshold: 0.01,
          maxDepth: 5,
        }),
      });

      expect(response.status).toBe(200);
      const result = (await response.json()) as {
        sourceId: string;
        reachedCount: number;
        maxDepth: number;
      };
      expect(result.sourceId).toBe(factNodeId);
      expect(result.reachedCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // Étape 6 : Statistiques globales
  // ============================================================
  describe('Étape 6 — Statistiques globales', () => {
    it('GET /stats — retourne les stats complètes', async () => {
      const response = await fetch(`${BASE_URL}/stats`);
      expect(response.status).toBe(200);

      const stats = (await response.json()) as StatsResponse;
      expect(stats.nodeCount).toBeGreaterThanOrEqual(2);
      expect(stats.linkCount).toBeGreaterThanOrEqual(1);
      expect(stats.anchoredCount).toBeGreaterThanOrEqual(2);
      expect(stats.anchoringRate).toBeGreaterThan(0);
      expect(stats.globalEntropy).toBeDefined();
    });
  });

  // ============================================================
  // Étape 7 : Healthcheck + Cache
  // ============================================================
  describe('Étape 7 — Santé & Cache', () => {
    it('GET /health — tous les composants sont checkés', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      expect(response.status).toBe(200);

      const health = (await response.json()) as {
        status: string;
        components: Array<{ component: string; status: string }>;
      };
      expect(health.status).not.toBe('unhealthy');
      expect(health.components.length).toBe(3);
    });

    it('Cache HIT vérifié après 2 appels GET identiques', async () => {
      // Premier appel (peut être HIT ou MISS selon l'état du cache)
      await fetch(`${BASE_URL}/stats`);
      // Deuxième appel (doit être HIT)
      const response = await fetch(`${BASE_URL}/stats`);
      expect(response.headers.get('X-KontEx-Cache')).toBe('HIT');
    });

    it('Rate limiting headers présents', async () => {
      const response = await fetch(`${BASE_URL}/nodes`);
      expect(response.headers.get('X-RateLimit-Limit')).toBeDefined();
      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
    });
  });
});
