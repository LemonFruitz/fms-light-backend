/**
 * src/routes/vehicleRoutes.js
 */

const router = require('express').Router();
const ctrl   = require('../controllers/vehicleController');
const { authenticate } = require('../middleware/authMiddleware');

// List semua unit (filter by equipment_class)
router.get('/',                authenticate, ctrl.listVehicles);

// Unit mana yang dipakai driver hari ini
router.get('/active-drivers',  authenticate, ctrl.getActiveDrivers);

// Log perubahan status (history BD/MT)
router.get('/status-log',      authenticate, ctrl.getStatusLog);

// Autocomplete pencarian unit
router.get('/search',          authenticate, ctrl.searchVehicles);

// Detail satu unit
router.get('/:unit_id',        authenticate, ctrl.getVehicleById);

// Update status unit + auto-log
router.patch('/:unit_id/status', authenticate, ctrl.updateVehicleStatus);

module.exports = router;
