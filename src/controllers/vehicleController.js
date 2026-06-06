/**
 * src/controllers/vehicleController.js
 */

const { query } = require('../config/database');
const { success, error } = require('../utils/responseHelper');

// GET /api/v1/vehicles
exports.listVehicles = async (req, res, next) => {
  try {
    const { equipment_class } = req.query;
    let sql = `SELECT unit_id, vehicle_type, equipment_class, status_unit, last_odometer_value
               FROM vehicles WHERE 1=1`;
    const params = [];
    if (equipment_class && equipment_class !== 'ALL') {
      sql += ` AND equipment_class = $1`;
      params.push(equipment_class);
    }
    sql += ` ORDER BY unit_id`;
    const { rows } = await query(sql, params);
    return res.json(success('OK', rows));
  } catch (err) { next(err); }
};

// GET /api/v1/vehicles/search?q=
exports.searchVehicles = async (req, res, next) => {
  try {
    const q = `%${(req.query.q || '').toUpperCase()}%`;
    const { rows } = await query(
      `SELECT unit_id, vehicle_type, status_unit, last_odometer_value
       FROM vehicles WHERE UPPER(unit_id) LIKE $1 OR UPPER(vehicle_type) LIKE $1
       ORDER BY unit_id LIMIT 20`, [q]
    );
    return res.json(success('OK', rows));
  } catch (err) { next(err); }
};

// GET /api/v1/vehicles/active-drivers
// Unit mana yang sedang dipakai driver hari ini
exports.getActiveDrivers = async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT DISTINCT ON (sr.unit_id)
        sr.unit_id, sr.driver_id, ud.name AS driver_name, sr.timestamp_filled
      FROM shift_reports sr
      LEFT JOIN users_driver ud ON ud.driver_id = sr.driver_id
      WHERE sr.timestamp_filled::date = CURRENT_DATE
        AND sr.overall_status = 'Ready to Work'
      ORDER BY sr.unit_id, sr.timestamp_filled DESC
    `);
    return res.json(success('OK', rows));
  } catch (err) { next(err); }
};

// GET /api/v1/vehicles/status-log?unit_id=&limit=
exports.getStatusLog = async (req, res, next) => {
  try {
    const { unit_id, limit = 100 } = req.query;
    let sql = `SELECT sl.*, ud.name AS changed_by_name
               FROM unit_status_log sl
               LEFT JOIN users_driver ud ON ud.driver_id = sl.changed_by
               WHERE 1=1`;
    const params = [];
    let idx = 1;
    if (unit_id) { sql += ` AND sl.unit_id = $${idx++}`; params.push(unit_id); }
    sql += ` ORDER BY sl.time_start DESC LIMIT $${idx++}`;
    params.push(limit);
    const { rows } = await query(sql, params);
    return res.json(success('OK', rows));
  } catch (err) { next(err); }
};

// GET /api/v1/vehicles/:unit_id
exports.getVehicleById = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM vehicles WHERE unit_id = $1', [req.params.unit_id]);
    if (!rows.length) return res.status(404).json(error('Unit tidak ditemukan.'));
    const vehicle = rows[0];
    if (['Breakdown', 'Maintenance'].includes(vehicle.status_unit)) {
      return res.status(409).json(error(
        `Unit berstatus "${vehicle.status_unit}". Pengisian shift tidak dapat dilanjutkan.`,
        { status_unit: vehicle.status_unit }
      ));
    }
    return res.json(success('OK', vehicle));
  } catch (err) { next(err); }
};

// PATCH /api/v1/vehicles/:unit_id/status
// + Log ke unit_status_log + tutup entry BD/MT sebelumnya kalau kembali Ready
exports.updateVehicleStatus = async (req, res, next) => {
  try {
    const { status_unit, notes, changed_by } = req.body;
    const unit_id = req.params.unit_id;

    // Ambil status lama
    const old = await query('SELECT status_unit FROM vehicles WHERE unit_id = $1', [unit_id]);
    if (!old.rows.length) return res.status(404).json(error('Unit tidak ditemukan.'));
    const oldStatus = old.rows[0].status_unit;

    // Update status
    const { rows } = await query(
      `UPDATE vehicles SET status_unit = $1 WHERE unit_id = $2 RETURNING unit_id, status_unit`,
      [status_unit, unit_id]
    );

    // Kalau kembali ke Ready → tutup entry BD/MT yang masih open
    if (status_unit === 'Ready' && oldStatus !== 'Ready') {
      await query(
        `UPDATE unit_status_log
         SET time_end = NOW(), duration_minutes = ROUND(EXTRACT(EPOCH FROM (NOW() - time_start)) / 60, 1)
         WHERE unit_id = $1 AND time_end IS NULL`,
        [unit_id]
      );
    }

    // Log entry baru (kalau bukan Ready→Ready)
    if (oldStatus !== status_unit) {
      await query(
        `INSERT INTO unit_status_log (unit_id, status_from, status_to, changed_by, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [unit_id, oldStatus, status_unit, changed_by || null, notes || null]
      );
    }

    return res.json(success('Status unit berhasil diperbarui.', rows[0]));
  } catch (err) { next(err); }
};
