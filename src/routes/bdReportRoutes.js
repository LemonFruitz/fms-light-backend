/**
 * src/routes/bdReportRoutes.js
 */
const router = require('express').Router();
const ctrl   = require('../controllers/bdReportController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/',                    authenticate, ctrl.createBdReport);
router.get('/',                     authenticate, ctrl.getBdReports);
router.get('/:bd_id',               authenticate, ctrl.getBdReportById);
router.patch('/:bd_id/status',       authenticate, ctrl.updateBdStatus);
router.patch('/:bd_id/edit',         authenticate, ctrl.editBdReport);

module.exports = router;
