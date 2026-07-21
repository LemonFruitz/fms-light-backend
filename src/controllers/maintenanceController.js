/**
 * src/controllers/maintenanceController.js
 * Manajemen tiket maintenance (P2H findings NON_CRITICAL).
 */

const { pool } = require('../config/database');

// GET /api/v1/maintenance — list semua tiket
const listTickets = async (req, res) => {
  try {
    const { status, unit_id, limit } = req.query;

    const conditions = [];
    const values = [];
    let idx = 1;

    if (status)  { conditions.push(`mt.status = $${idx++}`);  values.push(status); }
    if (unit_id) { conditions.push(`mt.unit_id = $${idx++}`); values.push(unit_id); }

    let query = `
      SELECT mt.*, sr.driver_id, ud.name as driver_name, sr.unit_id
      FROM maintenance_tickets mt
      LEFT JOIN shift_reports sr ON mt.report_id = sr.report_id
      LEFT JOIN users_driver ud ON sr.driver_id = ud.driver_id
    `;
    if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` ORDER BY mt.created_at DESC`;

    const lim = parseInt(limit);
    if (Number.isInteger(lim) && lim > 0) { query += ` LIMIT $${idx++}`; values.push(lim); }

    const result = await pool.query(query, values);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/v1/maintenance/:id — update status tiket
const updateTicket = async (req, res) => {
  const { id } = req.params;
  const { status, assigned_to, resolution, resolved_by } = req.body;

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (status) {
      fields.push('status = $' + idx++); values.push(status);
      // Set resolved_at otomatis saat tiket ditutup.
      if (status === 'Resolved') fields.push('resolved_at = NOW()');
    }
    if (assigned_to) { fields.push('assigned_to = $' + idx++); values.push(assigned_to); }
    if (resolution) { fields.push('resolution = $' + idx++); values.push(resolution); }
    if (resolved_by) { fields.push('resolved_by = $' + idx++); values.push(resolved_by); }

    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields' });

    values.push(id);
    const result = await pool.query(
      'UPDATE maintenance_tickets SET ' + fields.join(', ') + ' WHERE ticket_id = $' + idx + ' RETURNING *',
      values
    );

    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { listTickets, updateTicket };
