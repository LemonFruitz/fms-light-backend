/**
 * src/routes/vehicleRoutes.js
 */

const router = require('express').Router();
const ctrl   = require('../controllers/vehicleController');
const { authenticate } = require('../middleware/authMiddleware');

// Autocomplete pencarian unit — digunakan di Modul 1 Login PRD
router.get('/',            authenticate, ctrl.listVehicles);
router.get('/search',      authenticate, ctrl.searchVehicles);

// Status & detail satu unit
router.get('/:unit_id',    authenticate, ctrl.getVehicleById);

// Update status unit (oleh admin/HSE)
router.patch('/:unit_id/status', authenticate, ctrl.updateVehicleStatus);

module.exports = router;
