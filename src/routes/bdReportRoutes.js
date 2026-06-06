/**
 * src/routes/bdReportRoutes.js
 */

const router = require('express').Router();
const ctrl   = require('../controllers/bdReportController');
const { authenticate } = require('../middleware/authMiddleware');

// Submit laporan BD baru (driver)
router.post('/',              authenticate, ctrl.createBdReport);

// List semua BD reports (supervisor monitoring)
router.get('/',               authenticate, ctrl.getBdReports);

// Detail satu laporan
router.get('/:bd_id',         authenticate, ctrl.getBdReportById);

// Update status (supervisor: Open → In Progress → Resolved)
router.patch('/:bd_id/status', authenticate, ctrl.updateBdStatus);

module.exports = router;
