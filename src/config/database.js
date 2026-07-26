/**
 * src/config/database.js
 * Konfigurasi koneksi PostgreSQL menggunakan Neon Serverless Driver.
 *
 * PENTING: Ini BUKAN koneksi TCP biasa (port 5432) — driver ini
 * mengirim query lewat HTTP/WebSocket ke endpoint Neon (port 443).
 * Dipakai karena shared hosting (Jagoan Hosting) memblokir semua
 * koneksi outbound ke port 5432, tapi port 443 (HTTPS) selalu terbuka.
 *
 * Interface (query, getClient, pool) dibuat SAMA seperti sebelumnya
 * (saat masih pakai driver 'pg' biasa) supaya semua controller yang
 * sudah ada TIDAK PERLU diubah.
 */
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
require('dotenv').config();

// Neon serverless driver butuh WebSocket constructor di environment
// Node.js biasa (browser sudah punya native WebSocket, Node.js belum).
neonConfig.webSocketConstructor = ws;

// Connection string — pakai DATABASE_URL kalau ada, fallback
// merangkai dari variabel lama (DB_HOST dkk) supaya tidak perlu
// ganti environment variables kalau belum sempat.
const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}?sslmode=require`;

// Pool dari @neondatabase/serverless mendukung transaksi
// (BEGIN/COMMIT/ROLLBACK) lewat WebSocket, beda dengan fungsi
// neon() versi HTTP-only yang tidak mendukung sesi multi-query.
const pool = new Pool({ connectionString });

pool.on('connect', () => {
  console.log('[DB] Koneksi baru ke Neon (via serverless driver) berhasil dibuat.');
});

pool.on('error', (err) => {
  // JANGAN process.exit() di sini — idle client error itu normal
  // (misal Neon compute sempat suspend), pool akan reconnect sendiri
  // di query berikutnya.
  console.error('[DB] Idle client error (non-fatal):', err.message);
});

/**
 * Helper query — selalu gunakan parameterized query ($1, $2, ...)
 * untuk mencegah SQL injection. Signature SAMA seperti pg biasa.
 */
const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error('[DB] Query error:', {
      message: err.message,
      code: err.code
    });
    throw err;
  }
};

/**
 * Untuk transaksi multi-step (misal: simpan shift_report + insert
 * FTW answers + insert P2H results dalam satu transaksi).
 * Selalu release client setelah selesai — sama seperti pola pg biasa:
 *
 *   const client = await getClient();
 *   try {
 *     await client.query('BEGIN');
 *     ...
 *     await client.query('COMMIT');
 *   } catch (e) {
 *     await client.query('ROLLBACK');
 *     throw e;
 *   } finally {
 *     client.release();
 *   }
 */
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
