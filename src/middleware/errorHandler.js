/**
 * src/middleware/errorHandler.js
 * Global error handler — semua error yang di-next() berakhir di sini.
 */

module.exports = (err, req, res, next) => {
  console.error('[ERROR]', err.message);

  // Error dari express-validator
  if (err.type === 'validation') {
    return res.status(422).json({ success: false, message: 'Validasi input gagal.', errors: err.errors });
  }

  // Error PostgreSQL
  if (err.code) {
    const pgErrors = {
      '23505': 'Data duplikat — record sudah ada.',
      '23503': 'Referensi tidak valid — data terkait tidak ditemukan.',
      '23514': 'Nilai di luar rentang yang diizinkan.',
    };
    const msg = pgErrors[err.code] || `Database error: ${err.code}`;
    return res.status(409).json({ success: false, message: msg });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Terjadi kesalahan internal server.',
  });
};
