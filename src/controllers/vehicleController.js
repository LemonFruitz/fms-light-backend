/**
 * src/controllers/vehicleController.js
 * Manajemen data unit kendaraan — termasuk autocomplete (Modul 1 PRD).
 */

const { query }          = require('../config/database');
const { success, error } = require('../utils/responseHelper');

// GET /api/v1/vehicles/search?q=DT-001
// Autocomplete berbasis DB — dioptimasi untuk area minim sinyal (query cepat)
exports.searchVehicles = async (req, res, next) => {
  try {
    const q = `%${(req.query.q || '').toUpperCase()}%`;
    const { rows } = await query(
      `SELECT unit_id, vehicle_type, status_unit, last_odometer_value
       FROM vehicles
       WHERE UPPER(unit_id) LIKE $1 OR UPPER(vehicle_type) LIKE $1
       ORDER BY unit_id
       LIMIT 20`,
      [q]
    );
    return res.json(success('OK', rows));
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/vehicles/:unit_id
exports.getVehicleById = async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM vehicles WHERE unit_id = $1',
      [req.params.unit_id]
    );
    if (!rows.length) return res.status(404).json(error('Unit tidak ditemukan.'));

    const vehicle = rows[0];
    // Blokir akses jika unit Under Maintenance (Modul 1 PRD)
    if (['Breakdown', 'Maintenance'].includes(vehicle.status_unit)) {
      return res.status(409).json(error(
        `Unit berstatus "${vehicle.status_unit}". Pengisian shift tidak dapat dilanjutkan.`,
        { status_unit: vehicle.status_unit }
      ));
    }
    return res.json(success('OK', vehicle));
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/vehicles/:unit_id/status
exports.updateVehicleStatus = async (req, res, next) => {
  try {
    const { status_unit, notes } = req.body;
    const { rows } = await query(
      `UPDATE vehicles SET status_unit = $1, notes = $2, updated_at = NOW()
       WHERE unit_id = $3 RETURNING unit_id, status_unit`,
      [status_unit, notes || null, req.params.unit_id]
    );
    if (!rows.length) return res.status(404).json(error('Unit tidak ditemukan.'));
    return res.json(success('Status unit berhasil diperbarui.', rows[0]));
  } catch (err) {
    next(err);
  }
};
