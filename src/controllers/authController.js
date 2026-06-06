/**
 * src/controllers/authController.js
 *
 * Login: Driver ID + PIN (tanpa unit).
 * Unit dipilih setelah login di dashboard.
 */

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { success, error } = require('../utils/responseHelper');

// POST /api/v1/auth/login
exports.login = async (req, res, next) => {
  try {
    const { driver_id, pin } = req.body;

    if (!driver_id || !pin) {
      return res.status(400).json(error('Driver ID dan PIN wajib diisi.'));
    }

    const { rows } = await query(
      'SELECT driver_id, name, status, role, pin FROM users_driver WHERE driver_id = $1',
      [driver_id]
    );

    if (!rows.length) {
      return res.status(404).json(error('ID Karyawan tidak ditemukan.'));
    }

    const driver = rows[0];

    if (driver.status !== 'Active') {
      return res.status(403).json(error(`Akun driver berstatus "${driver.status}". Hubungi supervisor.`));
    }

    if (driver.pin !== pin) {
      return res.status(401).json(error('PIN salah. Periksa kembali.'));
    }

    const token = jwt.sign(
      { driver_id: driver.driver_id, name: driver.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return res.json(success('Login berhasil.', {
      token,
      driver: {
        driver_id: driver.driver_id,
        name: driver.name,
        role: driver.role,
      },
    }));
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/auth/validate
exports.validate = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json(error('Token tidak ditemukan.'));

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    return res.json(success('Token valid.', {
      driver_id: decoded.driver_id,
      name: decoded.name,
    }));
  } catch (err) {
    return res.status(401).json(error('Token tidak valid atau sudah kedaluwarsa.'));
  }
};
