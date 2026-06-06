/**
 * src/controllers/bdReportController.js
 *
 * Endpoint untuk laporan breakdown mandiri selama shift.
 * Driver bisa submit kapan saja, Supervisor bisa lihat & update status.
 */

const { query } = require('../config/database');
const { success, error } = require('../utils/responseHelper');

// ─────────────────────────────────────────────
// POST /api/v1/bd-reports
// Buat laporan BD baru
// ─────────────────────────────────────────────
exports.createBdReport = async (req, res, next) => {
  try {
    const {
      driver_id,
      unit_id,
      component,
      severity,
      description,
      location,
      event_time,
      action_taken,
      photo_url,
    } = req.body;

    // Validasi wajib
    if (!driver_id || !unit_id || !component || !description || !location) {
      return res.status(400).json(error('Field wajib: driver_id, unit_id, component, description, location.'));
    }

    const validSeverity = ['Critical', 'Major', 'Minor'];
    const sev = validSeverity.includes(severity) ? severity : 'Minor';

    const { rows } = await query(
      `INSERT INTO bd_reports 
        (driver_id, unit_id, component, severity, description, location, event_time, action_taken, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING bd_id, component, severity, status, created_at`,
      [
        driver_id, unit_id, component, sev, description, location,
        event_time || new Date().toISOString(),
        action_taken || null,
        photo_url || null,
      ]
    );

    // Jika severity Critical, otomatis update status unit ke Breakdown
    if (sev === 'Critical') {
      await query(
        `UPDATE vehicles SET status_unit = 'Breakdown' WHERE unit_id = $1 AND status_unit = 'Ready'`,
        [unit_id]
      );
    }

    return res.status(201).json(success('Laporan breakdown berhasil disimpan.', rows[0]));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/v1/bd-reports
// List semua BD reports (bisa filter: unit_id, driver_id, status, severity)
// Untuk Supervisor monitoring
// ─────────────────────────────────────────────
exports.getBdReports = async (req, res, next) => {
  try {
    const { unit_id, driver_id, status, severity, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT br.*, ud.name AS driver_name
      FROM bd_reports br
      LEFT JOIN users_driver ud ON ud.driver_id = br.driver_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (unit_id)   { sql += ` AND br.unit_id = $${idx++}`;   params.push(unit_id); }
    if (driver_id) { sql += ` AND br.driver_id = $${idx++}`; params.push(driver_id); }
    if (status)    { sql += ` AND br.status = $${idx++}`;     params.push(status); }
    if (severity)  { sql += ` AND br.severity = $${idx++}`;   params.push(severity); }

    sql += ` ORDER BY br.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const { rows } = await query(sql, params);

    // Count total
    let countSql = `SELECT COUNT(*) FROM bd_reports WHERE 1=1`;
    const countParams = [];
    let cidx = 1;
    if (unit_id)   { countSql += ` AND unit_id = $${cidx++}`;   countParams.push(unit_id); }
    if (driver_id) { countSql += ` AND driver_id = $${cidx++}`; countParams.push(driver_id); }
    if (status)    { countSql += ` AND status = $${cidx++}`;     countParams.push(status); }
    if (severity)  { countSql += ` AND severity = $${cidx++}`;   countParams.push(severity); }

    const { rows: countRows } = await query(countSql, countParams);

    return res.json(success('OK', {
      reports: rows,
      total: parseInt(countRows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    }));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/v1/bd-reports/:bd_id
// Detail satu laporan
// ─────────────────────────────────────────────
exports.getBdReportById = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT br.*, ud.name AS driver_name
       FROM bd_reports br
       LEFT JOIN users_driver ud ON ud.driver_id = br.driver_id
       WHERE br.bd_id = $1`,
      [req.params.bd_id]
    );
    if (!rows.length) return res.status(404).json(error('Laporan BD tidak ditemukan.'));
    return res.json(success('OK', rows[0]));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/v1/bd-reports/:bd_id/status
// Update status (Supervisor: Open → In Progress → Resolved)
// ─────────────────────────────────────────────
exports.updateBdStatus = async (req, res, next) => {
  try {
    const { status, resolved_by, resolve_notes } = req.body;
    const validStatus = ['Open', 'In Progress', 'Resolved'];
    if (!validStatus.includes(status)) {
      return res.status(400).json(error('Status harus: Open, In Progress, atau Resolved.'));
    }

    const updates = ['status = $1'];
    const params = [status];
    let idx = 2;

    if (status === 'Resolved') {
      updates.push(`resolved_at = NOW()`);
      if (resolved_by) { updates.push(`resolved_by = $${idx++}`); params.push(resolved_by); }
      if (resolve_notes) { updates.push(`resolve_notes = $${idx++}`); params.push(resolve_notes); }
    }

    params.push(req.params.bd_id);
    const { rows } = await query(
      `UPDATE bd_reports SET ${updates.join(', ')} WHERE bd_id = $${idx} RETURNING bd_id, status, resolved_at`,
      params
    );

    if (!rows.length) return res.status(404).json(error('Laporan BD tidak ditemukan.'));
    return res.json(success('Status berhasil diperbarui.', rows[0]));
  } catch (err) {
    next(err);
  }
};
