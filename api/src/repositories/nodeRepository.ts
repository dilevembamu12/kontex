/// @anchor: PostgreSQL pg — https://node-postgres.com/
/// Repository pour les nœuds de la toile TTC.

import { randomUUID } from 'node:crypto';
import type { AnchorInput, ContextNodeInput, StoredNode } from '../services/ttcService.js';

/**
 * Interface commune pour le stockage des nœuds (PostgreSQL ou in-memory).
 */
export interface NodeRepository {
  create(input: ContextNodeInput): Promise<StoredNode>;
  findById(id: string): Promise<StoredNode | null>;
  findAll(): Promise<StoredNode[]>;
  count(): Promise<number>;
}

/**
 * Repository PostgreSQL pour les nœuds.
 */
export class PostgresNodeRepository implements NodeRepository {
  private pool: import('pg').Pool | null = null;

  private async getPool(): Promise<import('pg').Pool> {
    if (!this.pool) {
      const { default: pg } = await import('pg');
      this.pool = new pg.Pool({
        connectionString: process.env['DATABASE_URL'] ?? 'postgresql://kontex:kontex@localhost:5432/kontex',
        max: 10,
        connectionTimeoutMillis: 3000,
      });
    }
    return this.pool;
  }

  async create(input: ContextNodeInput): Promise<StoredNode> {
    const pool = await this.getPool();
    const id = randomUUID();
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO nodes (id, kind, content, weight, ambiguity, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, input.kind, input.content, input.weight ?? 0.5, input.ambiguity ?? 0.5,
       JSON.stringify(input.metadata ?? {}), now, now],
    );

    // Insert anchors
    for (const anchor of input.anchors) {
      await pool.query(
        `INSERT INTO anchors (node_id, uri, source_type, description)
         VALUES ($1, $2, $3, $4)`,
        [id, anchor.uri, anchor.sourceType, anchor.description ?? null],
      );
    }

    return {
      id,
      kind: input.kind,
      content: input.content,
      weight: input.weight ?? 0.5,
      ambiguity: input.ambiguity ?? 0.5,
      anchors: input.anchors,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };
  }

  async findById(id: string): Promise<StoredNode | null> {
    const pool = await this.getPool();
    const result = await pool.query('SELECT * FROM nodes WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0] as Record<string, unknown>;
    const anchorsResult = await pool.query('SELECT * FROM anchors WHERE node_id = $1', [id]);

    return {
      id: row['id'] as string,
      kind: row['kind'] as string,
      content: row['content'] as string,
      weight: row['weight'] as number,
      ambiguity: row['ambiguity'] as number,
      anchors: anchorsResult.rows.map((a: Record<string, unknown>) => {
        const desc = a['description'] as string | null;
        return {
          uri: a['uri'] as string,
          sourceType: (a['source_type'] as string) as AnchorInput['sourceType'],
          ...(desc ? { description: desc } : {}),
        } satisfies AnchorInput;
      }),
      metadata: (row['metadata'] as Record<string, string>) ?? {},
      createdAt: row['created_at'] as string,
      updatedAt: row['updated_at'] as string,
    };
  }

  async findAll(): Promise<StoredNode[]> {
    const pool = await this.getPool();
    const nodesResult = await pool.query('SELECT * FROM nodes ORDER BY created_at DESC');
    const anchorsResult = await pool.query('SELECT * FROM anchors');

    const anchorsByNode = new Map<string, AnchorInput[]>();
    for (const a of anchorsResult.rows as Array<Record<string, unknown>>) {
      const nid = a['node_id'] as string;
      if (!anchorsByNode.has(nid)) anchorsByNode.set(nid, []);
      const desc = a['description'] as string | null;
      anchorsByNode.get(nid)!.push({
        uri: a['uri'] as string,
        sourceType: (a['source_type'] as string) as AnchorInput['sourceType'],
        ...(desc ? { description: desc } : {}),
      } satisfies AnchorInput);
    }

    return (nodesResult.rows as Array<Record<string, unknown>>).map((row) => ({
      id: row['id'] as string,
      kind: row['kind'] as string,
      content: row['content'] as string,
      weight: row['weight'] as number,
      ambiguity: row['ambiguity'] as number,
      anchors: anchorsByNode.get(row['id'] as string) ?? [],
      metadata: (row['metadata'] as Record<string, string>) ?? {},
      createdAt: row['created_at'] as string,
      updatedAt: row['updated_at'] as string,
    }));
  }

  async count(): Promise<number> {
    const pool = await this.getPool();
    const result = await pool.query('SELECT COUNT(*) FROM nodes');
    return Number((result.rows[0] as Record<string, unknown>)['count']);
  }
}

/**
 * Repository in-memory (fallback développement).
 */
export class InMemoryNodeRepository implements NodeRepository {
  private nodes: Map<string, StoredNode> = new Map();

  async create(input: ContextNodeInput): Promise<StoredNode> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const node: StoredNode = {
      id, kind: input.kind, content: input.content,
      weight: input.weight ?? 0.5, ambiguity: input.ambiguity ?? 0.5,
      anchors: input.anchors, metadata: input.metadata ?? {},
      createdAt: now, updatedAt: now,
    };
    this.nodes.set(id, node);
    return node;
  }

  async findById(id: string): Promise<StoredNode | null> { return this.nodes.get(id) ?? null; }
  async findAll(): Promise<StoredNode[]> { return [...this.nodes.values()]; }
  async count(): Promise<number> { return this.nodes.size; }
}
