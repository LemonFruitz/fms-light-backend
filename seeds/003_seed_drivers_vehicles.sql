-- ==============================================================
-- SEED DATA: Master Driver & Vehicle (PELENGKAP)
-- Sumber    : Pelengkap untuk FMS Light — seed asli (002) tidak
--             berisi driver/unit, sehingga tabel login kosong.
-- Konteks   : Contoh data armada bergaya PT HTE (Site HSM).
-- Cara jalan : psql -U fms_user -d fms_light_db -f 003_seed_drivers_vehicles.sql
--             (atau jalankan via Render Shell setelah migrasi)
-- Catatan    : Enum status driver = Active | Suspended | Off-Duty
--             Enum status unit   = Ready  | Breakdown | Maintenance
-- ==============================================================

BEGIN;

-- ─────────────────────────────────────────────
-- Master Driver / Operator
-- driver_id dipakai sebagai "ID Karyawan" saat login.
-- ─────────────────────────────────────────────
INSERT INTO users_driver (driver_id, name, license_type, license_expiry, phone, department, status) VALUES
  ('EMP-001', 'Muslimin',            'SIM B2', '2027-12-31', '0812-0000-0001', 'Hauling',  'Active'),
  ('EMP-002', 'Andi Saputra',        'SIM B2', '2027-06-30', '0812-0000-0002', 'Hauling',  'Active'),
  ('EMP-003', 'Budi Hartono',        'SIM B1', '2026-11-15', '0812-0000-0003', 'Mining',   'Active'),
  ('EMP-004', 'Candra Wijaya',       'SIM B2', '2026-09-01', '0812-0000-0004', 'Hauling',  'Active'),
  ('EMP-005', 'Dedi Kurniawan',      'SIM B2', '2028-01-20', '0812-0000-0005', 'HRM',      'Active'),
  ('EMP-006', 'Eko Prasetyo',        'SIM B2', '2027-03-10', '0812-0000-0006', 'Hauling',  'Suspended'), -- contoh akun diblokir
  ('EMP-007', 'Fajar Nugroho',       'SIM B1', '2027-08-05', '0812-0000-0007', 'Mining',   'Off-Duty')   -- contoh akun off-duty
ON CONFLICT (driver_id) DO NOTHING;


-- ─────────────────────────────────────────────
-- Master Vehicle / Unit
-- unit_id dipakai sebagai "Nomor Lambung" saat login.
-- status_unit 'Maintenance'/'Breakdown' akan diblokir backend.
-- ─────────────────────────────────────────────
INSERT INTO vehicles (unit_id, vehicle_type, license_plate, year_manufacture, last_odometer_value, status_unit, notes) VALUES
  ('HDTS-001', 'Dump Truck Shacman X3000', 'DD-1001-XX', 2023, 45200, 'Ready',       'Unit hauling utama, kondisi prima'),
  ('HDTS-002', 'Dump Truck Shacman X3000', 'DD-1002-XX', 2023, 38950, 'Ready',       'Unit hauling cadangan'),
  ('HDTD-010', 'Dump Truck DongFeng K50Y', 'DD-2010-XX', 2022, 61230, 'Ready',       NULL),
  ('HDTD-011', 'Dump Truck DongFeng K50Y', 'DD-2011-XX', 2022, 58700, 'Breakdown',   'Rem belakang dalam perbaikan'), -- contoh unit breakdown
  ('HEXV-005', 'Excavator',                NULL,         2021,  9820, 'Ready',       'Loadex terpasang'),
  ('HEXV-020', 'Excavator',                NULL,         2024,  3120, 'Maintenance', 'Service 250 jam terjadwal'),     -- contoh unit maintenance
  ('DT-041',   'Dump Truck',               'DD-3041-XX', 2020, 88400, 'Ready',       NULL),
  ('DT-042',   'Dump Truck',               'DD-3042-XX', 2020, 91250, 'Ready',       NULL)
ON CONFLICT (unit_id) DO NOTHING;

COMMIT;

-- ──────────────────────────────────────────────────────────────
-- KREDENSIAL UJI COBA LOGIN (sesuai backend: driver_id + unit_id)
-- ──────────────────────────────────────────────────────────────
--   ✅ Berhasil  : EMP-001 + HDTS-001   (driver Active, unit Ready)
--   ⛔ Diblokir  : EMP-006 + HDTS-001   (driver Suspended)
--   ⛔ Diblokir  : EMP-001 + HDTD-011   (unit Breakdown)
--   ⛔ Tdk ada   : EMP-999 + HDTS-001   (driver tidak terdaftar)
-- ──────────────────────────────────────────────────────────────
