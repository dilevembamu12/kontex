#!/usr/bin/env npx tsx
/// Backfill embeddings pour les nœuds existants dans PostgreSQL
/// Utilise le générateur configuré (Gemini, OpenAI, Ollama) ou fallback hash.

import { getEmbeddingGenerator, toPgVector } from '../src/services/embeddingService.js';
import { initEmbeddingGenerator } from '../src/services/embeddingService.js';
import pg from 'pg';

async function main() {
  // Initialise le générateur depuis la config
  await initEmbeddingGenerator();
  const generator = await getEmbeddingGenerator();
  console.log(`[Backfill] Générateur : ${generator.constructor.name} (dim=${generator.dim})`);

  const pool = new pg.Pool({
    connectionString: process.env['DATABASE_URL'] ?? 'postgresql://kontex:kontex@localhost:5432/kontex',
  });

  const { rows } = await pool.query(
    'SELECT id, content FROM nodes ORDER BY created_at',
  );
  console.log(`Nœuds à traiter : ${rows.length}`);

  let updated = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const emb = await generator.embed(row.content as string);
      const vec = toPgVector(emb);
      await pool.query(
        'UPDATE nodes SET embedding = $1::vector WHERE id = $2',
        [vec, row.id],
      );
      updated++;
      console.log(`  ✅ ${updated + failed}/${rows.length} — ${(row.id as string).slice(0, 8)}...`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message.slice(0, 80) : String(err);
      console.log(`  ⚠️ ${updated + failed}/${rows.length} — ${(row.id as string).slice(0, 8)}... échec: ${msg}`);
    }
  }

  await pool.end();
  console.log(`✅ Backfill terminé — ${updated} embeddings régénérés avec ${generator.constructor.name}.`);
}

main().catch((err) => {
  console.error('Erreur backfill:', err);
  process.exit(1);
});
