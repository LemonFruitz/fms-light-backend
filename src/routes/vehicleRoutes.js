/**
 * src/routes/vehicleRoutes.js
 */
const router = require('express').Router();
const ctrl   = require('../controllers/vehicleController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/',                  authenticate, ctrl.listVehicles);
router.get('/active-drivers',    authenticate, ctrl.getActiveDrivers);
router.get('/status-log',        authenticate, ctrl.getStatusLog);
router.get('/search',            authenticate, ctrl.searchVehicles);
router.get('/:unit_id',          authenticate, ctrl.getVehicleById);
router.patch('/:unit_id/status', authenticate, ctrl.updateVehicleStatus);
router.patch('/:unit_id/notes',  authenticate, ctrl.updateVehicleNotes);

// CRUD unit
router.post('/',            authenticate, ctrl.createVehicle);
router.patch('/:id/edit',   authenticate, ctrl.editVehicle);
router.delete('/:id',       authenticate, ctrl.deleteVehicle);

module.exports = router;
