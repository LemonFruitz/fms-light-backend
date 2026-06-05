/**
 * migrations/runner.js
 * Menjalankan migrasi SQL secara berurutan.
 *
 * Cara pakai:
 *   node migrations/runner.js           → jalankan semua migrasi
 *   node migrations/runner.js --seed    → jalankan migrasi + seed data
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const MIGRATIONS_DIR = path.join(__dirname);
const SEEDS_DIR      = path.join(__dirname, '..', 'seeds');
const runSeeds       = process.argv.includes('--seed');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL      PRIMARY KEY,
      filename    VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(client) {
  const { rows } = await client.query('SELECT filename FROM _migrations ORDER BY id');
  return rows.map(r => r.filename);
}

async function runSqlFile(client, filePath) {
  const sql = fs.readFileSync(filePath, 'utf-8');
  await client.query(sql);
}

async function main() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const executed = await getExecutedMigrations(client);

    // Jalankan file migrasi (001_*.sql, dst.)
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      if (executed.includes(file)) {
        console.log(`[SKIP]  ${file} — sudah dijalankan sebelumnya.`);
        continue;
      }
      console.log(`[RUN]   ${file} ...`);
      await runSqlFile(client, path.join(MIGRATIONS_DIR, file));
      await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
      console.log(`[OK]    ${file} berhasil dieksekusi.`);
    }

    // Opsional: jalankan seed data
    if (runSeeds) {
      const seedFiles = fs.readdirSync(SEEDS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

      for (const file of seedFiles) {
        console.log(`[SEED]  ${file} ...`);
        await runSqlFile(client, path.join(SEEDS_DIR, file));
        console.log(`[OK]    Seed ${file} selesai.`);
      }
    }

    console.log('\n✅ Semua migrasi berhasil dijalankan.');
  } catch (err) {
    console.error('\n❌ Migrasi gagal:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
