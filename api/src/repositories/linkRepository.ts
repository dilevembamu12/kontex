/// @anchor: Repository pour les liens de la toile TTC.
/// Stockage PostgreSQL ou in-memory.

import { randomUUID } from 'node:crypto';
import type { ContextLinkInput, StoredLink } from '../services/ttcService.js';

export interface LinkRepository {
  create(input: ContextLinkInput): Promise<StoredLink>;
  findBySourceId(sourceId: string): Promise<StoredLink[]>;
  findAll(): Promise<StoredLink[]>;
  count(): Promise<number>;
  deleteByNodeIds(sourceId: string, targetId: string, relation?: string): Promise<number>;
  deleteAllForNode(nodeId: string): Promise<number>;
}

export class PostgresLinkRepository implements LinkRepository {
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

  async create(input: ContextLinkInput): Promise<StoredLink> {
    const pool = await this.getPool();
    const id = randomUUID();
    const now = new Date().toISOString();

    await pool.query(
      `INSERT INTO links (id, source_id, target_id, relation, weight, relevance_score, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, input.sourceId, input.targetId, input.relation,
       input.weight ?? 0.5, input.relevanceScore ?? 0.5, now],
    );

    return {
      id, sourceId: input.sourceId, targetId: input.targetId,
      relation: input.relation,
      weight: input.weight ?? 0.5, relevanceScore: input.relevanceScore ?? 0.5,
      createdAt: now,
    };
  }

  async findBySourceId(sourceId: string): Promise<StoredLink[]> {
    const pool = await this.getPool();
    const result = await pool.query('SELECT * FROM links WHERE source_id = $1', [sourceId]);
    return (result.rows as Array<Record<string, unknown>>).map((row) => ({
      id: row['id'] as string,
      sourceId: row['source_id'] as string,
      targetId: row['target_id'] as string,
      relation: row['relation'] as string,
      weight: row['weight'] as number,
      relevanceScore: row['relevance_score'] as number,
      createdAt: row['created_at'] as string,
    }));
  }

  async findAll(): Promise<StoredLink[]> {
    const pool = await this.getPool();
    const result = await pool.query('SELECT * FROM links ORDER BY created_at DESC');
    return (result.rows as Array<Record<string, unknown>>).map((row) => ({
      id: row['id'] as string,
      sourceId: row['source_id'] as string,
      targetId: row['target_id'] as string,
      relation: row['relation'] as string,
      weight: row['weight'] as number,
      relevanceScore: row['relevance_score'] as number,
      createdAt: row['created_at'] as string,
    }));
  }

  async count(): Promise<number> {
    const pool = await this.getPool();
    const result = await pool.query('SELECT COUNT(*) FROM links');
    return Number((result.rows[0] as Record<string, unknown>)['count']);
  }

  async deleteByNodeIds(sourceId: string, targetId: string, relation?: string): Promise<number> {
    const pool = await this.getPool();
    const result = relation
      ? await pool.query('DELETE FROM links WHERE source_id=$1 AND target_id=$2 AND relation=$3', [sourceId, targetId, relation])
      : await pool.query('DELETE FROM links WHERE source_id=$1 AND target_id=$2', [sourceId, targetId]);
    return result.rowCount ?? 0;
  }

  async deleteAllForNode(nodeId: string): Promise<number> {
    const pool = await this.getPool();
    const result = await pool.query(
      'DELETE FROM links WHERE source_id=$1 OR target_id=$1', [nodeId]
    );
    return result.rowCount ?? 0;
  }
}

export class InMemoryLinkRepository implements LinkRepository {
  private links: Map<string, StoredLink> = new Map();
  private bySource: Map<string, Set<string>> = new Map();

  async create(input: ContextLinkInput): Promise<StoredLink> {
    const id = randomUUID();
    const link: StoredLink = {
      id, sourceId: input.sourceId, targetId: input.targetId,
      relation: input.relation,
      weight: input.weight ?? 0.5, relevanceScore: input.relevanceScore ?? 0.5,
      createdAt: new Date().toISOString(),
    };
    this.links.set(id, link);
    if (!this.bySource.has(input.sourceId)) this.bySource.set(input.sourceId, new Set());
    this.bySource.get(input.sourceId)!.add(id);
    return link;
  }

  async findBySourceId(sourceId: string): Promise<StoredLink[]> {
    const ids = this.bySource.get(sourceId);
    if (!ids) return [];
    return [...ids].map((id) => this.links.get(id)!).filter(Boolean);
  }

  async findAll(): Promise<StoredLink[]> { return [...this.links.values()]; }
  async count(): Promise<number> { return this.links.size; }

  async deleteByNodeIds(sourceId: string, targetId: string, _relation?: string): Promise<number> {
    let count = 0;
    const ids = this.bySource.get(sourceId);
    if (ids) {
      for (const id of [...ids]) {
        const link = this.links.get(id);
        if (link && link.targetId === targetId) {
          this.links.delete(id); ids.delete(id); count++;
        }
      }
    }
    return count;
  }

  async deleteAllForNode(nodeId: string): Promise<number> {
    let count = 0;
    // Supprime liens sortants
    const outIds = this.bySource.get(nodeId);
    if (outIds) { for (const id of [...outIds]) { this.links.delete(id); count++; } this.bySource.delete(nodeId); }
    // Supprime liens entrants
    for (const [src, ids] of this.bySource) {
      for (const id of [...ids]) {
        const link = this.links.get(id);
        if (link && link.targetId === nodeId) { this.links.delete(id); ids.delete(id); count++; }
      }
    }
    return count;
  }
}
