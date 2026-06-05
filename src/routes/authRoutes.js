/**
 * src/routes/authRoutes.js
 */

const router = require('express').Router();
const ctrl   = require('../controllers/authController');

// Login driver — return JWT token
router.post('/login', ctrl.login);

// Validasi token (dipakai PWA untuk cek sesi masih aktif)
router.get('/validate', ctrl.validateToken);

module.exports = router;
