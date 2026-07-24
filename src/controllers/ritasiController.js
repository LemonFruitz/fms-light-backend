const { pool } = require('../config/database');

// GET /api/v1/ritasi
const listRitasi = async (req, res) => {
  try {
    const { tanggal, shift, status, limit = 200 } = req.query;
    let conditions = [];
    let values = [];
    let idx = 1;

    if (tanggal) { conditions.push('r.tanggal = $' + idx++); values.push(tanggal); }
    if (shift) { conditions.push('r.shift = $' + idx++); values.push(shift); }
    if (status) { conditions.push('r.status = $' + idx++); values.push(status); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await pool.query(
      `SELECT 
        r.*,
        rs.name as checker_rs_name,
        tb.name as checker_tb_name
       FROM ritasi_hauling r
       LEFT JOIN users_driver rs ON r.checker_rs = rs.driver_id
       LEFT JOIN users_driver tb ON r.checker_tb = tb.driver_id
       ${where}
       ORDER BY r.jam_sample DESC
       LIMIT $${idx}`,
      [...values, parseInt(limit)]
    );

    return res.json({ success: true, data: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('listRitasi error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/v1/ritasi
const createRitasi = async (req, res) => {
  try {
    const {
      unit_id, jam_sample, loading_area,
      dumping_area, foto_url, shift, catatan, checker_rs
    } = req.body;

    if (!unit_id) {
      return res.status(400).json({ success: false, message: 'Unit ID wajib diisi' });
    }

    const h = new Date().getHours();
    const autoShift = (h >= 7 && h < 19) ? '1' : '2';

    const result = await pool.query(
      `INSERT INTO ritasi_hauling
       (unit_id, jam_sample, loading_area, dumping_area, foto_url,
        shift, catatan, checker_rs, status, tanggal)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending Timbangan', CURRENT_DATE)
       RETURNING *`,
      [
        unit_id,
        jam_sample || new Date().toISOString(),
        loading_area || null,
        dumping_area || null,
        foto_url || null,
        shift || autoShift,
        catatan || null,
        checker_rs || null
      ]
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('createRitasi error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/v1/ritasi/:id/tonase
const updateTonase = async (req, res) => {
  const { id } = req.params;
  const { tonase, checker_tb } = req.body;

  try {
    if (!tonase || parseFloat(tonase) <= 0) {
      return res.status(400).json({ success: false, message: 'Tonase harus lebih dari 0' });
    }

    const result = await pool.query(
      `UPDATE ritasi_hauling
       SET tonase = $1, checker_tb = $2, status = 'Completed', updated_at = NOW()
       WHERE ritasi_id = $3
       RETURNING *`,
      [parseFloat(tonase), checker_tb || null, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('updateTonase error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/v1/ritasi/:id
const deleteRitasi = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM ritasi_hauling WHERE ritasi_id = $1 RETURNING ritasi_id',
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    }
    return res.json({ success: true, message: 'Data berhasil dihapus' });
  } catch (error) {
    console.error('deleteRitasi error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/v1/ritasi/stats — summary untuk CCR dashboard
const statsRitasi = async (req, res) => {
  try {
    const { tanggal, shift } = req.query;
    const today = tanggal || new Date().toISOString().slice(0, 10);

    let conditions = ['tanggal = $1'];
    let values = [today];
    let idx = 2;

    if (shift) { conditions.push('shift = $' + idx++); values.push(shift); }

    const where = 'WHERE ' + conditions.join(' AND ');

    const result = await pool.query(
      `SELECT
        COUNT(*) as total_ritasi,
        COUNT(CASE WHEN status = 'Pending Timbangan' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed,
        COALESCE(SUM(tonase), 0) as total_tonase,
        COUNT(DISTINCT unit_id) as total_unit
       FROM ritasi_hauling ${where}`,
      values
    );

    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { listRitasi, createRitasi, updateTonase, deleteRitasi, statsRitasi };
