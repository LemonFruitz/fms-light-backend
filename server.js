/**
 * server.js — Entry point aplikasi FMS Light Backend
 * Menginisialisasi Express, middleware global, dan router.
 */

require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const compression = require('compression');
const morgan     = require('morgan');

const { pool }      = require('./src/config/database');
const routes        = require('./src/routes/index');
const errorHandler  = require('./src/middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security & Utility Middleware ─────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));     // 10MB untuk signature data URI
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// ── Health Check ──────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/v1', routes);

// ── Global Error Handler ──────────────────────────────────────
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 FMS Light Backend berjalan di http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health check: http://localhost:${PORT}/health\n`);
});

module.exports = app; // untuk testing (supertest)
