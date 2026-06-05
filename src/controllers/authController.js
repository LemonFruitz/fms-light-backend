/**
 * src/controllers/authController.js
 * Login driver dan validasi token.
 */

const jwt             = require('jsonwebtoken');
const { query }       = require('../config/database');
const { success, error } = require('../utils/responseHelper');

// POST /api/v1/auth/login
// Body: { driver_id, unit_id }
exports.login = async (req, res, next) => {
  try {
    const { driver_id, unit_id } = req.body;

    const { rows } = await query(
      'SELECT driver_id, name, status FROM users_driver WHERE driver_id = $1',
      [driver_id]
    );

    if (!rows.length) {
      return res.status(404).json(error('ID Karyawan tidak ditemukan.'));
    }

    const driver = rows[0];
    if (driver.status !== 'Active') {
      return res.status(403).json(error(`Akun driver berstatus "${driver.status}". Hubungi supervisor.`));
    }

    const token = jwt.sign(
      { driver_id: driver.driver_id, name: driver.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return res.json(success('Login berhasil.', {
      token,
      driver: { driver_id: driver.driver_id, name: driver.name },
      unit_id,
    }));
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/auth/validate
exports.validateToken = (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json(error('Token tidak ada.'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return res.json(success('Token valid.', { driver_id: decoded.driver_id, name: decoded.name }));
  } catch {
    return res.status(403).json(error('Token tidak valid atau kadaluarsa.'));
  }
};
