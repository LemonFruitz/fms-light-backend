/**
 * src/controllers/supervisorController.js
 * Supervisor + Admin CCR endpoints
 */
const { query } = require('../config/database');
const { success, error } = require('../utils/responseHelper');

// GET /api/v1/supervisor/shift-reports
// Supports: date_from, date_to, shift (1 or 2), status
exports.getShiftReports = async (req, res, next) => {
  try {
    const { date_from, date_to, date, shift, status, limit = 500, offset = 0 } = req.query;
    const today = new Date().toISOString().slice(0,10);
    const startDate = date_from || date || today;
    const endDate = date_to || date || today;

    let sql = `
      SELECT sr.report_id, sr.driver_id, ud.name AS driver_name, ud.equipment_class,
        sr.unit_id, v.vehicle_type, sr.fit_status, sr.p2h_status, sr.overall_status,
        sr.odometer_entered, sr.odometer_end, sr.shift_ended_at,
        sr.timestamp_filled, sr.timestamp_synced,
        sr.time_drift_flagged, sr.validation_status, sr.validated_by, sr.validated_at
      FROM shift_reports sr
      LEFT JOIN users_driver ud ON ud.driver_id = sr.driver_id
      LEFT JOIN vehicles v ON v.unit_id = sr.unit_id
      WHERE sr.timestamp_filled::date >= $1 AND sr.timestamp_filled::date <= $2`;
    const params = [startDate, endDate];
    let idx = 3;

    // Filter by shift time range
    if (shift === '1') { sql += ` AND EXTRACT(HOUR FROM sr.timestamp_filled) >= 7 AND EXTRACT(HOUR FROM sr.timestamp_filled) < 19`; }
    if (shift === '2') { sql += ` AND (EXTRACT(HOUR FROM sr.timestamp_filled) >= 19 OR EXTRACT(HOUR FROM sr.timestamp_filled) < 7)`; }
    if (status) { sql += ` AND sr.overall_status = $${idx++}`; params.push(status); }
    if (req.query.driver_id) { sql += ` AND sr.driver_id = $${idx++}`; params.push(req.query.driver_id); }

    sql += ` ORDER BY sr.timestamp_filled DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);
    const { rows } = await query(sql, params);

    let countSql = `SELECT COUNT(*) FROM shift_reports WHERE timestamp_filled::date >= $1 AND timestamp_filled::date <= $2`;
    const cp = [startDate, endDate]; let ci = 3;
    if (shift === '1') { countSql += ` AND EXTRACT(HOUR FROM timestamp_filled) >= 7 AND EXTRACT(HOUR FROM timestamp_filled) < 19`; }
    if (shift === '2') { countSql += ` AND (EXTRACT(HOUR FROM timestamp_filled) >= 19 OR EXTRACT(HOUR FROM timestamp_filled) < 7)`; }
    if (status) { countSql += ` AND overall_status = $${ci++}`; cp.push(status); }
    const { rows: cr } = await query(countSql, cp);

    return res.json(success('OK', { date_from: startDate, date_to: endDate, reports: rows, total: parseInt(cr[0].count) }));
  } catch (err) { next(err); }
};

// GET /api/v1/supervisor/dashboard-stats
exports.getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0,10);
    const [activeR, totalR, issueR, bdR, pendR] = await Promise.all([
      query(`SELECT COUNT(DISTINCT driver_id) AS count FROM shift_reports WHERE timestamp_filled::date = $1 AND overall_status = 'Ready to Work'`, [today]),
      query(`SELECT COUNT(*) AS count FROM shift_reports WHERE timestamp_filled::date = $1`, [today]),
      query(`SELECT SUM(CASE WHEN overall_status='Driver Unfit' THEN 1 ELSE 0 END) AS unfit, SUM(CASE WHEN overall_status='Unit Breakdown' THEN 1 ELSE 0 END) AS breakdown FROM shift_reports WHERE timestamp_filled::date = $1`, [today]),
      query(`SELECT COUNT(*) AS count FROM bd_reports WHERE status = 'Open'`),
      query(`SELECT COUNT(*) AS count FROM shift_reports WHERE timestamp_filled::date = $1 AND (validation_status IS NULL OR validation_status = 'Pending')`, [today]),
    ]);
    return res.json(success('OK', {
      date: today,
      active_drivers: parseInt(activeR.rows[0].count),
      total_reports: parseInt(totalR.rows[0].count),
      driver_unfit: parseInt(issueR.rows[0].unfit||0),
      unit_breakdown: parseInt(issueR.rows[0].breakdown||0),
      bd_open: parseInt(bdR.rows[0].count),
      pending_validation: parseInt(pendR.rows[0].count),
    }));
  } catch (err) { next(err); }
};

// PATCH /api/v1/supervisor/shift-reports/:report_id/validate
exports.validateReport = async (req, res, next) => {
  try {
    const { report_id } = req.params;
    const { validation_status, validated_by } = req.body;
    if (!['Approved','Rejected'].includes(validation_status)) return res.status(400).json(error('Status harus: Approved atau Rejected.'));
    if (!validated_by) return res.status(400).json(error('validated_by wajib diisi.'));
    const { rows } = await query(
      `UPDATE shift_reports SET validation_status=$1, validated_by=$2, validated_at=NOW()
       WHERE report_id=$3 RETURNING report_id, validation_status, validated_by, validated_at`,
      [validation_status, validated_by, report_id]);
    if (!rows.length) return res.status(404).json(error('Report tidak ditemukan.'));
    return res.json(success('Validasi berhasil.', rows[0]));
  } catch (err) { next(err); }
};

// PATCH /api/v1/supervisor/shift-reports/:report_id/end-shift
// Driver/CCR input HM akhir shift
exports.endShift = async (req, res, next) => {
  try {
    const { report_id } = req.params;
    const { odometer_end } = req.body;
    if (!odometer_end || odometer_end <= 0) return res.status(400).json(error('Angka HM/Odometer akhir wajib diisi.'));
    const { rows } = await query(
      `UPDATE shift_reports SET odometer_end=$1, shift_ended_at=NOW()
       WHERE report_id=$2 RETURNING report_id, odometer_entered, odometer_end, shift_ended_at`,
      [odometer_end, report_id]);
    if (!rows.length) return res.status(404).json(error('Report tidak ditemukan.'));
    return res.json(success('HM akhir shift berhasil disimpan.', rows[0]));
  } catch (err) { next(err); }
};
