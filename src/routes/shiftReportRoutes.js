/**
 * src/routes/shiftReportRoutes.js
 */

const router = require('express').Router();
const ctrl   = require('../controllers/shiftReportController');
const { authenticate } = require('../middleware/authMiddleware');

// Submit laporan shift baru (online) atau sync dari offline
router.post('/',           authenticate, ctrl.createShiftReport);

// Sync batch data offline — dipanggil PWA saat koneksi pulih
router.post('/sync-batch', authenticate, ctrl.syncOfflineBatch);

// Riwayat laporan per driver
router.get('/driver/:driver_id', authenticate, ctrl.getReportsByDriver);

// Detail satu laporan
router.get('/:report_id',  authenticate, ctrl.getReportById);

module.exports = router;
