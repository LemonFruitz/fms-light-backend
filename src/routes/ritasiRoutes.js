const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
  listRitasi,
  createRitasi,
  updateTonase,
  editRitasi,
  deleteRitasi,
  statsRitasi
} = require('../controllers/ritasiController');

router.get('/stats', authenticate, statsRitasi);
router.get('/', authenticate, listRitasi);
router.post('/', authenticate, createRitasi);
router.patch('/:id/tonase', authenticate, updateTonase);
router.patch('/:id', authenticate, editRitasi);
router.delete('/:id', authenticate, deleteRitasi);

module.exports = router;
