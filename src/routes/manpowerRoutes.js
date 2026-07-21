const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { listManpower, createDriver, updateDriver, changePin, deleteDriver } = require('../controllers/manpowerController');

router.get('/', listManpower);
router.post('/', authenticate, createDriver);
router.patch('/:id', authenticate, updateDriver);
router.patch('/:id/pin', authenticate, changePin);
router.delete('/:id', authenticate, deleteDriver);

module.exports = router;
