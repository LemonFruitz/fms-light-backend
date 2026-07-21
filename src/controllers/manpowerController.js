const { pool } = require('../config/database');

const listManpower = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT driver_id, name, role, equipment_class, department FROM users_driver WHERE status='Active' ORDER BY name ASC"
    );
    return res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/v1/manpower — tambah driver baru
const createDriver = async (req, res) => {
  const { driver_id, name, role, pin, equipment_class, department, phone } = req.body;
  try {
    // Auto-generate ID kalau kosong
    const id = driver_id || 'TEMP' + String(Date.now()).slice(-4);
    const result = await pool.query(
      'INSERT INTO users_driver (driver_id, name, role, pin, equipment_class, department, phone, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [id, name, role || 'Driver', pin || '0000', equipment_class, department, phone || null, 'Active']
    );
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(400).json({ success: false, message: 'Driver ID sudah ada' });
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/v1/manpower/:id — edit driver
const updateDriver = async (req, res) => {
  const { id } = req.params;
  const { name, role, equipment_class, department, phone, status } = req.body;
  try {
    const fields = []; const values = []; let idx = 1;
    if (name) { fields.push('name = $' + idx++); values.push(name); }
    if (role) { fields.push('role = $' + idx++); values.push(role); }
    if (equipment_class) { fields.push('equipment_class = $' + idx++); values.push(equipment_class); }
    if (department) { fields.push('department = $' + idx++); values.push(department); }
    if (phone !== undefined) { fields.push('phone = $' + idx++); values.push(phone); }
    if (status) { fields.push('status = $' + idx++); values.push(status); }
    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields' });
    fields.push('updated_at = NOW()');
    values.push(id);
    const result = await pool.query(
      'UPDATE users_driver SET ' + fields.join(', ') + ' WHERE driver_id = $' + idx + ' RETURNING *', values
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/v1/manpower/:id/pin — ganti PIN
const changePin = async (req, res) => {
  const { id } = req.params;
  const { new_pin } = req.body;
  try {
    if (!new_pin || new_pin.length !== 4 || !/^\d{4}$/.test(new_pin))
      return res.status(400).json({ success: false, message: 'PIN harus 4 digit angka' });
    const result = await pool.query(
      'UPDATE users_driver SET pin = $1, updated_at = NOW() WHERE driver_id = $2 RETURNING driver_id, name', [new_pin, id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, message: 'PIN berhasil diubah', data: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/v1/manpower/:id — nonaktifkan driver (soft delete)
const deleteDriver = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE users_driver SET status = 'Inactive', updated_at = NOW() WHERE driver_id = $1 RETURNING *", [id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, message: 'Driver dinonaktifkan' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { listManpower, createDriver, updateDriver, changePin, deleteDriver };
