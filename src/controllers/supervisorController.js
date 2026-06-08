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

// GET /api/v1/supervisor/daily-trends?days=7
// Trend data harian untuk dashboard PJO
exports.getDailyTrends = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const { rows } = await query(`
      SELECT 
        d::date AS date,
        COALESCE(sr.total,0) AS total_reports,
        COALESCE(sr.rtw,0) AS rtw,
        COALESCE(sr.unfit,0) AS unfit,
        COALESCE(sr.breakdown,0) AS breakdown,
        COALESCE(sr.drivers,0) AS active_drivers
      FROM generate_series(CURRENT_DATE - $1 * INTERVAL '1 day', CURRENT_DATE, '1 day') d
      LEFT JOIN (
        SELECT timestamp_filled::date AS dt,
          COUNT(*) AS total,
          COUNT(DISTINCT driver_id) AS drivers,
          SUM(CASE WHEN overall_status='Ready to Work' THEN 1 ELSE 0 END) AS rtw,
          SUM(CASE WHEN overall_status='Driver Unfit' THEN 1 ELSE 0 END) AS unfit,
          SUM(CASE WHEN overall_status='Unit Breakdown' THEN 1 ELSE 0 END) AS breakdown
        FROM shift_reports
        WHERE timestamp_filled::date >= CURRENT_DATE - $1 * INTERVAL '1 day'
        GROUP BY dt
      ) sr ON sr.dt = d::date
      ORDER BY d`, [days]);

    // BD stats
    const { rows: bdRows } = await query(`
      SELECT created_at::date AS date, COUNT(*) AS count
      FROM bd_reports
      WHERE created_at::date >= CURRENT_DATE - $1 * INTERVAL '1 day'
      GROUP BY date ORDER BY date`, [days]);
    const bdMap = {};
    bdRows.forEach(r => { bdMap[r.date] = parseInt(r.count); });

    const trends = rows.map(r => ({
      date: r.date,
      total_reports: parseInt(r.total_reports),
      rtw: parseInt(r.rtw),
      unfit: parseInt(r.unfit),
      breakdown: parseInt(r.breakdown),
      active_drivers: parseInt(r.active_drivers),
      bd_reports: bdMap[r.date] || 0,
    }));

    return res.json(success('OK', trends));
  } catch (err) { next(err); }
};

// GET /api/v1/supervisor/equipment-summary
// Ringkasan per jenis unit untuk PJO
exports.getEquipmentSummary = async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await query(`
      SELECT 
        v.equipment_class,
        COUNT(*) AS total_units,
        SUM(CASE WHEN v.status_unit='Ready' THEN 1 ELSE 0 END) AS ready,
        SUM(CASE WHEN v.status_unit='Breakdown' THEN 1 ELSE 0 END) AS bd,
        SUM(CASE WHEN v.status_unit='Maintenance' THEN 1 ELSE 0 END) AS mt,
        COALESCE(sr.driver_count,0) AS drivers_reported,
        COALESCE(sr.avg_hm,0) AS avg_hm_per_shift
      FROM vehicles v
      LEFT JOIN (
        SELECT ud.equipment_class AS ec, COUNT(DISTINCT s.driver_id) AS driver_count,
          ROUND(AVG(CASE WHEN s.odometer_end IS NOT NULL THEN s.odometer_end - s.odometer_entered ELSE NULL END)) AS avg_hm
        FROM shift_reports s
        LEFT JOIN users_driver ud ON ud.driver_id = s.driver_id
        WHERE s.timestamp_filled::date = $1
        GROUP BY ud.equipment_class
      ) sr ON sr.ec = v.equipment_class
      WHERE v.equipment_class IS NOT NULL
      GROUP BY v.equipment_class, sr.driver_count, sr.avg_hm
      ORDER BY v.equipment_class`, [today]);
    return res.json(success('OK', rows));
  } catch (err) { next(err); }
};

// PATCH /api/v1/supervisor/shift-reports/:report_id/end-shift
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
