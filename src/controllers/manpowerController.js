const { pool } = require('../config/database');

const listManpower = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM manpower ORDER BY 1');
    return res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Manpower error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { listManpower };
