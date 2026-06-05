/**
 * src/config/database.js
 * Konfigurasi koneksi PostgreSQL menggunakan connection pool (pg-pool).
 * Pool memungkinkan efisiensi koneksi pada skenario multi-user lapangan.
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'fms_light_db',
  user:     process.env.DB_USER     || 'fms_user',
  password: process.env.DB_PASSWORD,
  min:      parseInt(process.env.DB_POOL_MIN) || 2,
  max:      parseInt(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 5000,
  // SSL untuk Neon/cloud DB. Set DB_SSL=true di Render. Lokal: kosongkan.
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Verifikasi koneksi saat startup
pool.on('connect', () => {
  // Winston logger belum tersedia di sini, gunakan console
  console.log('[DB] Koneksi baru ke PostgreSQL berhasil dibuat.');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
  process.exit(-1);
});

/**
 * Helper query — selalu gunakan parameterized query ($1, $2, ...)
 * untuk mencegah SQL injection.
 */
const query = (text, params) => pool.query(text, params);

/**
 * Untuk transaksi multi-step (misal: simpan shift_report + update vehicles).
 * Selalu release client setelah selesai.
 */
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
