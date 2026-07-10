const { pool } = require('../config/database');

const listManpower = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT driver_id, name, role, equipment_class, department FROM users_driver WHERE status='Active' ORDER BY name ASC"
    );
    return res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { listManpower };
