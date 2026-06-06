/**
 * src/routes/supervisorRoutes.js
 */

const router = require('express').Router();
const ctrl   = require('../controllers/supervisorController');
const { authenticate } = require('../middleware/authMiddleware');

// Dashboard stats (active drivers, totals, etc.)
router.get('/dashboard-stats',                authenticate, ctrl.getDashboardStats);

// List shift reports (filter: date, status)
router.get('/shift-reports',                  authenticate, ctrl.getShiftReports);

// Validate/approve a shift report
router.patch('/shift-reports/:report_id/validate', authenticate, ctrl.validateReport);

module.exports = router;
