/**
 * src/middleware/authMiddleware.js
 * Verifikasi JWT token pada setiap request terproteksi.
 */

const jwt = require('jsonwebtoken');

exports.authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token autentikasi diperlukan.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Token tidak valid atau sudah kadaluarsa.' });
  }
};
