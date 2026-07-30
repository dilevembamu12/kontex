-- @anchor: PROJECT_CONTEXT.md §3.1 — PostgreSQL + pgvector
-- @anchor: pgvector — https://github.com/pgvector/pgvector
-- Schéma initial de la base KontEx — Toile Cosmologique.
--
-- Tables :
--   nodes     — Nœuds de la toile (faits, règles, code, documentation)
--   links     — Liens pondérés entre nœuds
--   anchors   — Sources d'ancrage (Principe A)
--   contradictions — Suivi des contradictions détectées (Principe C)

-- Activation de pgvector
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Table nodes
-- ============================================================
CREATE TABLE nodes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kind        VARCHAR(20) NOT NULL CHECK (kind IN ('fact', 'rule', 'code', 'documentation')),
    content     TEXT NOT NULL,
    weight      REAL NOT NULL DEFAULT 0.5 CHECK (weight >= 0 AND weight <= 1),
    ambiguity   REAL NOT NULL DEFAULT 0.5 CHECK (ambiguity >= 0 AND ambiguity <= 1),
    -- Embedding vectoriel pour la recherche sémantique (pgvector)
    embedding   VECTOR(1536),
    -- Métadonnées JSON
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les recherches par type
CREATE INDEX idx_nodes_kind ON nodes(kind);
-- Index pour les recherches plein texte
CREATE INDEX idx_nodes_content ON nodes USING GIN (to_tsvector('french', content));
-- Index vectoriel pour la similarité sémantique
CREATE INDEX idx_nodes_embedding ON nodes USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================
-- Table anchors
-- ============================================================
CREATE TABLE anchors (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id     UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    uri         TEXT NOT NULL,
    source_type VARCHAR(30) NOT NULL CHECK (source_type IN (
        'official_documentation', 'test_case', 'specification',
        'code_repository', 'peer_review', 'other'
    )),
    description TEXT,
    is_valid    BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_anchors_node ON anchors(node_id);
CREATE INDEX idx_anchors_source_type ON anchors(source_type);

-- ============================================================
-- Table links
-- ============================================================
CREATE TABLE links (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id       UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id       UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    relation        VARCHAR(20) NOT NULL CHECK (relation IN (
        'depends_on', 'contradicts', 'refines', 'exemplifies', 'references', 'custom'
    )),
    weight          REAL NOT NULL DEFAULT 0.5 CHECK (weight >= 0 AND weight <= 1),
    relevance_score REAL NOT NULL DEFAULT 0.5 CHECK (relevance_score >= 0 AND relevance_score <= 1),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Évite les doublons de liens
    UNIQUE (source_id, target_id, relation)
);

CREATE INDEX idx_links_source ON links(source_id);
CREATE INDEX idx_links_target ON links(target_id);
CREATE INDEX idx_links_relation ON links(relation);

-- ============================================================
-- Table contradictions (Principe C)
-- ============================================================
CREATE TABLE contradictions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    link_id         UUID REFERENCES links(id) ON DELETE SET NULL,
    node_a_id       UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    node_b_id       UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
    resolution_note TEXT,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contradictions_status ON contradictions(status);

-- ============================================================
-- Vue : taux d'ancrage
-- ============================================================
CREATE VIEW node_anchor_summary AS
SELECT
    n.id,
    n.kind,
    n.content,
    n.weight,
    n.ambiguity,
    COUNT(a.id) AS anchor_count,
    CASE WHEN COUNT(a.id) > 0 THEN true ELSE false END AS is_anchored,
    -- Force d'ancrage simplifiée
    LEAST(
        (LEAST(COUNT(a.id), 5)::REAL / 5.0) * 0.5 +
        LEAST(
            COUNT(CASE WHEN a.source_type IN ('official_documentation', 'specification') THEN 1 END)::REAL * 0.3 +
            COUNT(CASE WHEN a.source_type IN ('test_case', 'code_repository') THEN 1 END)::REAL * 0.2 +
            COUNT(CASE WHEN a.source_type = 'peer_review' THEN 1 END)::REAL * 0.15 +
            COUNT(CASE WHEN a.source_type = 'other' THEN 1 END)::REAL * 0.1,
            0.5
        ),
        1.0
    ) AS anchor_strength
FROM nodes n
LEFT JOIN anchors a ON a.node_id = n.id
GROUP BY n.id, n.kind, n.content, n.weight, n.ambiguity;

-- ============================================================
-- Fonction : propagation de contexte (BFS pondéré simplifié)
-- ============================================================
CREATE OR REPLACE FUNCTION propagate_context(
    source_node_id UUID,
    max_depth INT DEFAULT 5,
    threshold REAL DEFAULT 0.01
) RETURNS TABLE (
    node_id UUID,
    score REAL,
    depth INT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE propagation AS (
        -- Base : nœud source avec score 1.0
        SELECT
            l.target_id AS node_id,
            (l.weight * l.relevance_score)::REAL AS score,
            1 AS depth
        FROM links l
        WHERE l.source_id = source_node_id
          AND l.weight * l.relevance_score >= threshold

        UNION ALL

        -- Récurrence : propagation aux voisins
        SELECT
            l.target_id AS node_id,
            (p.score * l.weight * l.relevance_score)::REAL AS score,
            p.depth + 1 AS depth
        FROM propagation p
        JOIN links l ON l.source_id = p.node_id
        WHERE p.depth < max_depth
          AND p.score * l.weight * l.relevance_score >= threshold
    )
    SELECT DISTINCT ON (p.node_id)
        p.node_id,
        p.score,
        p.depth
    FROM propagation p
    ORDER BY p.node_id, p.score DESC;
END;
$$;
