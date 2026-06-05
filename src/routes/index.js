/**
 * src/routes/index.js
 * Agregator semua route API v1.
 */

const router = require('express').Router();

router.use('/auth',         require('./authRoutes'));
router.use('/vehicles',     require('./vehicleRoutes'));
router.use('/shift-reports',require('./shiftReportRoutes'));

// Endpoint waktu server — digunakan frontend untuk deteksi time drift (PRD Acceptance Criteria)
router.get('/server-time', (req, res) => {
  res.json({ server_time: new Date().toISOString() });
});

module.exports = router;
