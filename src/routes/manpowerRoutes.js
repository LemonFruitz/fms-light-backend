const express = require('express');
const router = express.Router();
const { listManpower } = require('../controllers/manpowerController');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, listManpower);

module.exports = router;
