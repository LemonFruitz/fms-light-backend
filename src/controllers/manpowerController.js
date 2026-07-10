const { pool } = require('../config/database');

const listManpower = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users_driver ORDER BY name ASC LIMIT 5'
    );
    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { listManpower };
