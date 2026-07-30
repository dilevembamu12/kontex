/// @anchor: PostgreSQL + pgvector — PROJECT_CONTEXT.md §3.1 Context Store
/// Module de connexion à la base de données KontEx.
///
/// Utilise le pool natif `pg` pour les connexions.

import { environment } from './environment.js';

/**
 * Interface pour le client de base de données.
 * Permet le polymorphisme entre PostgreSQL réel et fallback in-memory.
 */
export interface DatabaseClient {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * Crée le client PostgreSQL réel.
 */
async function createPostgresClient(): Promise<DatabaseClient> {
  // Import dynamique pour éviter l'erreur si pg n'est pas installé
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — pg est optionnel, installé en production
    const pg = await import('pg');
    const { Pool } = pg.default;

    const pool = new Pool({
      connectionString: environment.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Validation de la connexion
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    console.log('[KontEx::DB] Connexion PostgreSQL établie');

    return {
      async query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }> {
        const result = await pool.query(sql, params);
        return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
      },
      async connect() {
        await pool.query('SELECT 1');
      },
      async disconnect() {
        await pool.end();
      },
    };
  } catch (error: unknown) {
    console.warn('[KontEx::DB] PostgreSQL indisponible — fallback in-memory activé');
    if (error instanceof Error) {
      console.warn(`  Cause : ${error.message}`);
    }
    return createInMemoryClient();
  }
}

/**
 * Client in-memory pour le développement sans PostgreSQL.
 */
function createInMemoryClient(): DatabaseClient {
  const store = new Map<string, unknown[]>();

  return {
    async query<T>(sql: string, _params?: unknown[]): Promise<{ rows: T[]; rowCount: number }> {
      // Simulation basique : retourne les données du store
      const tableName = extractTableName(sql);
      const rows = (store.get(tableName) ?? []) as T[];
      return { rows, rowCount: rows.length };
    },
    async connect() { /* no-op */ },
    async disconnect() { /* no-op */ },
  };
}

function extractTableName(sql: string): string {
  const match = sql.match(/FROM\s+(\w+)/i);
  return match?.[1] ?? 'unknown';
}

let dbClient: DatabaseClient | null = null;

/**
 * Retourne le client de base de données (singleton).
 */
export async function getDatabase(): Promise<DatabaseClient> {
  if (!dbClient) {
    dbClient = await createPostgresClient();
  }
  return dbClient;
}
