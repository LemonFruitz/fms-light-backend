const pool = require('../config/db');

// GET /api/v1/manpower
const listManpower = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT driver_id, name, role, equipment_class 
       FROM manpower 
       ORDER BY name ASC`
    );
    
    return res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('List manpower error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listManpower };
