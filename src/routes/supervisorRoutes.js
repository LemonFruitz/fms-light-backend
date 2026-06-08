/**
 * src/routes/supervisorRoutes.js
 */
const router = require('express').Router();
const ctrl   = require('../controllers/supervisorController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/dashboard-stats',                      authenticate, ctrl.getDashboardStats);
router.get('/daily-trends',                         authenticate, ctrl.getDailyTrends);
router.get('/equipment-summary',                    authenticate, ctrl.getEquipmentSummary);
router.get('/shift-reports',                        authenticate, ctrl.getShiftReports);
router.patch('/shift-reports/:report_id/validate',  authenticate, ctrl.validateReport);
router.patch('/shift-reports/:report_id/end-shift', authenticate, ctrl.endShift);

module.exports = router;
