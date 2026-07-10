const express = require('express');
const router = express.Router();
const { listManpower } = require('../controllers/manpowerController');

router.get('/', listManpower);

module.exports = router;
