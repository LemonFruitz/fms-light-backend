/**
 * src/routes/maintenanceRoutes.js
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { listTickets, updateTicket } = require('../controllers/maintenanceController');

router.get('/', authenticate, listTickets);
router.patch('/:id', authenticate, updateTicket);

module.exports = router;
