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
  connectionTimeoutMillis: 15000,
  // SSL untuk Neon/cloud DB. Set DB_SSL=true di Render. Lokal: kosongkan.
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Verifikasi koneksi saat startup
pool.on('connect', () => {
  console.log('[DB] Koneksi baru ke PostgreSQL berhasil dibuat.');
});

// PENTING: JANGAN process.exit() di sini.
// Idle client bisa error kapan saja (misal Neon compute suspend lalu
// idle connection di pool ikut terputus) — ini NORMAL dan pool.query()
// berikutnya otomatis akan buka koneksi baru. Kalau proses di-exit,
// seluruh server mati dan butuh restart manual — itu penyebab
// "ETIMEDOUT terus-menerus" yang sebenarnya server sudah crash diam-diam.
pool.on('error', (err) => {
  console.error('[DB] Idle client error (non-fatal, pool akan reconnect):', err.message);
  // Sengaja TIDAK memanggil process.exit() — biarkan pool self-heal.
});

/**
 * Helper query — selalu gunakan parameterized query ($1, $2, ...)
 * untuk mencegah SQL injection.
 * Retry sekali kalau gagal karena idle connection yang baru terputus.
 */
const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    // Kalau koneksi terputus (ECONNRESET / Connection terminated),
    // coba sekali lagi — pool akan membuat koneksi baru otomatis.
    const retryable = ['ECONNRESET', 'ETIMEDOUT', '57P01'].includes(err.code) ||
                       /Connection terminated/i.test(err.message);
    if (retryable) {
      console.warn('[DB] Query gagal, mencoba ulang sekali:', err.message);
      return await pool.query(text, params);
    }
    throw err;
  }
};

/**
 * Untuk transaksi multi-step (misal: simpan shift_report + update vehicles).
 * Selalu release client setelah selesai.
 */
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
