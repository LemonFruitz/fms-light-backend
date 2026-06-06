/**
 * src/controllers/bdReportController.js
 * BD report CRUD — termasuk edit oleh CCR/Supervisor
 */
const { query } = require('../config/database');
const { success, error } = require('../utils/responseHelper');

// POST /api/v1/bd-reports
exports.createBdReport = async (req, res, next) => {
  try {
    const { driver_id, unit_id, component, severity, description, location, event_time, action_taken, photo_url } = req.body;
    if (!driver_id || !unit_id || !component || !description || !location) {
      return res.status(400).json(error('Field wajib: driver_id, unit_id, component, description, location.'));
    }
    const validSev = ['Critical', 'Major', 'Minor'];
    const sev = validSev.includes(severity) ? severity : 'Minor';
    const { rows } = await query(
      `INSERT INTO bd_reports (driver_id, unit_id, component, severity, description, location, event_time, action_taken, photo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING bd_id, component, severity, status, created_at`,
      [driver_id, unit_id, component, sev, description, location, event_time||new Date().toISOString(), action_taken||null, photo_url||null]);
    if (sev === 'Critical') {
      await query(`UPDATE vehicles SET status_unit = 'Breakdown' WHERE unit_id = $1 AND status_unit = 'Ready'`, [unit_id]);
    }
    return res.status(201).json(success('Laporan breakdown berhasil disimpan.', rows[0]));
  } catch (err) { next(err); }
};

// GET /api/v1/bd-reports
exports.getBdReports = async (req, res, next) => {
  try {
    const { unit_id, driver_id, status, severity, limit = 50, offset = 0 } = req.query;
    let sql = `SELECT br.*, ud.name AS driver_name FROM bd_reports br
               LEFT JOIN users_driver ud ON ud.driver_id = br.driver_id WHERE 1=1`;
    const params = []; let idx = 1;
    if (unit_id)   { sql += ` AND br.unit_id = $${idx++}`;   params.push(unit_id); }
    if (driver_id) { sql += ` AND br.driver_id = $${idx++}`; params.push(driver_id); }
    if (status)    { sql += ` AND br.status = $${idx++}`;     params.push(status); }
    if (severity)  { sql += ` AND br.severity = $${idx++}`;   params.push(severity); }
    sql += ` ORDER BY br.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);
    const { rows } = await query(sql, params);
    let countSql = `SELECT COUNT(*) FROM bd_reports WHERE 1=1`;
    const cp = []; let ci = 1;
    if (unit_id)   { countSql += ` AND unit_id = $${ci++}`;   cp.push(unit_id); }
    if (driver_id) { countSql += ` AND driver_id = $${ci++}`; cp.push(driver_id); }
    if (status)    { countSql += ` AND status = $${ci++}`;     cp.push(status); }
    if (severity)  { countSql += ` AND severity = $${ci++}`;   cp.push(severity); }
    const { rows: cr } = await query(countSql, cp);
    return res.json(success('OK', { reports: rows, total: parseInt(cr[0].count), limit: parseInt(limit), offset: parseInt(offset) }));
  } catch (err) { next(err); }
};

// GET /api/v1/bd-reports/:bd_id
exports.getBdReportById = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT br.*, ud.name AS driver_name FROM bd_reports br
       LEFT JOIN users_driver ud ON ud.driver_id = br.driver_id WHERE br.bd_id = $1`, [req.params.bd_id]);
    if (!rows.length) return res.status(404).json(error('Laporan BD tidak ditemukan.'));
    return res.json(success('OK', rows[0]));
  } catch (err) { next(err); }
};

// PATCH /api/v1/bd-reports/:bd_id/status
exports.updateBdStatus = async (req, res, next) => {
  try {
    const { status, resolved_by, resolve_notes } = req.body;
    const valid = ['Open', 'In Progress', 'Resolved'];
    if (!valid.includes(status)) return res.status(400).json(error('Status harus: Open, In Progress, atau Resolved.'));
    const updates = ['status = $1']; const params = [status]; let idx = 2;
    if (status === 'Resolved') {
      updates.push(`resolved_at = NOW()`);
      if (resolved_by) { updates.push(`resolved_by = $${idx++}`); params.push(resolved_by); }
      if (resolve_notes) { updates.push(`resolve_notes = $${idx++}`); params.push(resolve_notes); }
    }
    params.push(req.params.bd_id);
    const { rows } = await query(`UPDATE bd_reports SET ${updates.join(', ')} WHERE bd_id = $${idx} RETURNING bd_id, status, resolved_at`, params);
    if (!rows.length) return res.status(404).json(error('Laporan BD tidak ditemukan.'));
    return res.json(success('Status berhasil diperbarui.', rows[0]));
  } catch (err) { next(err); }
};

// PATCH /api/v1/bd-reports/:bd_id/edit
// CCR/Supervisor bisa edit detail BD report (deskripsi, lokasi, severity, action, component)
exports.editBdReport = async (req, res, next) => {
  try {
    const { description, location, severity, action_taken, component } = req.body;
    const updates = []; const params = []; let idx = 1;
    if (description !== undefined) { updates.push(`description = $${idx++}`); params.push(description); }
    if (location !== undefined)    { updates.push(`location = $${idx++}`);    params.push(location); }
    if (severity !== undefined)    { updates.push(`severity = $${idx++}`);    params.push(severity); }
    if (action_taken !== undefined){ updates.push(`action_taken = $${idx++}`);params.push(action_taken); }
    if (component !== undefined)   { updates.push(`component = $${idx++}`);   params.push(component); }
    if (!updates.length) return res.status(400).json(error('Tidak ada field yang diubah.'));
    params.push(req.params.bd_id);
    const { rows } = await query(
      `UPDATE bd_reports SET ${updates.join(', ')} WHERE bd_id = $${idx} RETURNING *`, params);
    if (!rows.length) return res.status(404).json(error('Laporan BD tidak ditemukan.'));
    return res.json(success('BD report berhasil diperbarui.', rows[0]));
  } catch (err) { next(err); }
};
