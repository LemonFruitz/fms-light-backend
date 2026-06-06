/**
 * src/controllers/supervisorController.js
 *
 * Endpoint khusus Supervisor & Foreman:
 * - Lihat daftar shift report hari ini
 * - Hitung driver aktif
 * - Validasi / approve shift report
 */

const { query } = require('../config/database');
const { success, error } = require('../utils/responseHelper');

// ─────────────────────────────────────────────
// GET /api/v1/supervisor/shift-reports
// List shift reports (default: hari ini)
// Query params: date_from, date_to, status, limit, offset
// ─────────────────────────────────────────────
exports.getShiftReports = async (req, res, next) => {
  try {
    const { date_from, date_to, date, status, limit = 500, offset = 0 } = req.query;
    const today = new Date().toISOString().slice(0, 10);
    const startDate = date_from || date || today;
    const endDate = date_to || date || today;

    let sql = `
      SELECT 
        sr.report_id, sr.driver_id, ud.name AS driver_name,
        sr.unit_id, v.vehicle_type,
        sr.fit_status, sr.p2h_status, sr.overall_status,
        sr.odometer_entered, sr.timestamp_filled, sr.timestamp_synced,
        sr.time_drift_flagged, sr.validation_status, sr.validated_by, sr.validated_at
      FROM shift_reports sr
      LEFT JOIN users_driver ud ON ud.driver_id = sr.driver_id
      LEFT JOIN vehicles v ON v.unit_id = sr.unit_id
      WHERE sr.timestamp_filled::date >= $1 AND sr.timestamp_filled::date <= $2
    `;
    const params = [startDate, endDate];
    let idx = 3;

    if (status) { sql += ` AND sr.overall_status = $${idx++}`; params.push(status); }

    sql += ` ORDER BY sr.timestamp_filled DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const { rows } = await query(sql, params);

    // Count total
    let countSql = `SELECT COUNT(*) FROM shift_reports WHERE timestamp_filled::date >= $1 AND timestamp_filled::date <= $2`;
    const countParams = [startDate, endDate];
    let cidx = 3;
    if (status) { countSql += ` AND overall_status = $${cidx++}`; countParams.push(status); }
    const { rows: countRows } = await query(countSql, countParams);

    return res.json(success('OK', {
      date: targetDate,
      reports: rows,
      total: parseInt(countRows[0].count),
    }));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/v1/supervisor/dashboard-stats
// Statistik dashboard: driver aktif, total report, BD open
// ─────────────────────────────────────────────
exports.getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Driver aktif hari ini (yang status Ready to Work)
    const activeResult = await query(
      `SELECT COUNT(DISTINCT driver_id) AS count 
       FROM shift_reports 
       WHERE timestamp_filled::date = $1 AND overall_status = 'Ready to Work'`,
      [today]
    );

    // Total report hari ini
    const totalResult = await query(
      `SELECT COUNT(*) AS count FROM shift_reports WHERE timestamp_filled::date = $1`,
      [today]
    );

    // Breakdown count (driver unfit + unit breakdown hari ini)
    const issueResult = await query(
      `SELECT 
         SUM(CASE WHEN overall_status = 'Driver Unfit' THEN 1 ELSE 0 END) AS unfit,
         SUM(CASE WHEN overall_status = 'Unit Breakdown' THEN 1 ELSE 0 END) AS breakdown
       FROM shift_reports WHERE timestamp_filled::date = $1`,
      [today]
    );

    // BD reports open
    const bdResult = await query(
      `SELECT COUNT(*) AS count FROM bd_reports WHERE status = 'Open'`
    );

    // Pending validation
    const pendingResult = await query(
      `SELECT COUNT(*) AS count FROM shift_reports 
       WHERE timestamp_filled::date = $1 AND (validation_status IS NULL OR validation_status = 'Pending')`,
      [today]
    );

    return res.json(success('OK', {
      date: today,
      active_drivers: parseInt(activeResult.rows[0].count),
      total_reports: parseInt(totalResult.rows[0].count),
      driver_unfit: parseInt(issueResult.rows[0].unfit || 0),
      unit_breakdown: parseInt(issueResult.rows[0].breakdown || 0),
      bd_open: parseInt(bdResult.rows[0].count),
      pending_validation: parseInt(pendingResult.rows[0].count),
    }));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/v1/supervisor/shift-reports/:report_id/validate
// Validasi shift report (Approved / Rejected)
// ─────────────────────────────────────────────
exports.validateReport = async (req, res, next) => {
  try {
    const { report_id } = req.params;
    const { validation_status, validated_by } = req.body;

    if (!['Approved', 'Rejected'].includes(validation_status)) {
      return res.status(400).json(error('Status harus: Approved atau Rejected.'));
    }
    if (!validated_by) {
      return res.status(400).json(error('validated_by (ID Supervisor) wajib diisi.'));
    }

    const { rows } = await query(
      `UPDATE shift_reports 
       SET validation_status = $1, validated_by = $2, validated_at = NOW()
       WHERE report_id = $3
       RETURNING report_id, validation_status, validated_by, validated_at`,
      [validation_status, validated_by, report_id]
    );

    if (!rows.length) return res.status(404).json(error('Report tidak ditemukan.'));
    return res.json(success('Validasi berhasil.', rows[0]));
  } catch (err) {
    next(err);
  }
};
