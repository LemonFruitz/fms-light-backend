/**
 * src/routes/index.js
 * Agregator semua route API v1.
 */

const router = require('express').Router();

router.use('/auth',         require('./authRoutes'));
router.use('/vehicles',     require('./vehicleRoutes'));
router.use('/shift-reports',require('./shiftReportRoutes'));
router.use('/bd-reports',  require('./bdReportRoutes'));
router.use('/supervisor',  require('./supervisorRoutes'));
const manpowerRoutes = require('./manpowerRoutes');
router.use('/manpower', manpowerRoutes);
const maintenanceRoutes = require('./maintenanceRoutes');
router.use('/maintenance', maintenanceRoutes);
const ritasiRoutes = require('./ritasiRoutes');
router.use('/ritasi', ritasiRoutes);

// Endpoint waktu server — digunakan frontend untuk deteksi time drift (PRD Acceptance Criteria)
router.get('/server-time', (req, res) => {
  res.json({ server_time: new Date().toISOString() });
});

module.exports = router;
