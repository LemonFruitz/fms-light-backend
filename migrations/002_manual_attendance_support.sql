-- ==============================================================
-- MIGRASI DATABASE: FMS Light - Dukungan Absensi Manual (CCR)
-- Versi      : 1.1.0
-- Tanggal    : 2026-07-19
-- Database   : PostgreSQL 14+
-- Deskripsi  : Menyesuaikan skema agar mendukung "Absensi Manual"
--              yang dikirim dari CCR. Alur ini tidak mengisi data
--              foto odometer, tanda tangan, maupun odometer, sehingga:
--                1. photo_odometer_url & signature_data_uri dibuat nullable.
--                2. Menambah kolom submitted_by untuk menandai sumber input.
--                3. Trigger validasi odometer dilewati untuk mode manual
--                   (odometer_entered = 0, tanpa mengubah last_odometer_value).
-- Cara jalankan:
--   psql -U fms_user -d fms_light_db -f 002_manual_attendance_support.sql
-- ==============================================================

BEGIN;

-- ─────────────────────────────────────────────
-- SECTION 1: Kolom NOT NULL menjadi nullable
-- Absensi Manual tidak mengirim foto odometer & tanda tangan.
-- ─────────────────────────────────────────────

ALTER TABLE shift_reports ALTER COLUMN photo_odometer_url DROP NOT NULL;
ALTER TABLE shift_reports ALTER COLUMN signature_data_uri DROP NOT NULL;

COMMENT ON COLUMN shift_reports.photo_odometer_url IS 'URL foto odometer. NULL diperbolehkan untuk Absensi Manual dari CCR.';
COMMENT ON COLUMN shift_reports.signature_data_uri IS 'Data URI tanda tangan driver. NULL diperbolehkan untuk Absensi Manual dari CCR.';


-- ─────────────────────────────────────────────
-- SECTION 2: Kolom submitted_by
-- Menandai sumber/kanal pengisian laporan shift.
-- Nilai 'CCR-Manual' menandakan Absensi Manual dari CCR.
-- ─────────────────────────────────────────────

ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS submitted_by VARCHAR(50);

COMMENT ON COLUMN shift_reports.submitted_by IS 'Sumber pengisian laporan (mis. "CCR-Manual" untuk Absensi Manual dari CCR). NULL = pengisian normal via PWA.';


-- ─────────────────────────────────────────────
-- SECTION 3: Update trigger validasi odometer
-- Lewati validasi & update odometer untuk Absensi Manual (CCR-Manual),
-- karena mode ini tidak mengisi odometer (odometer_entered = 0) dan
-- tidak boleh me-reset last_odometer_value unit menjadi 0.
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_validate_odometer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_last_odometer INTEGER;
BEGIN
  -- Absensi Manual dari CCR: lewati validasi & update odometer.
  IF NEW.submitted_by = 'CCR-Manual' THEN
    RETURN NEW;
  END IF;

  SELECT last_odometer_value INTO v_last_odometer
  FROM vehicles WHERE unit_id = NEW.unit_id;

  IF NEW.odometer_entered < v_last_odometer THEN
    RAISE EXCEPTION 'ODOMETER_INVALID: Nilai odometer (%) tidak boleh lebih rendah dari nilai sebelumnya (%).',
      NEW.odometer_entered, v_last_odometer;
  END IF;

  -- Simpan snapshot nilai odometer sebelumnya untuk audit
  NEW.odometer_prev = v_last_odometer;

  -- Update last_odometer_value di tabel vehicles
  UPDATE vehicles
  SET last_odometer_value = NEW.odometer_entered,
      updated_at          = NOW()
  WHERE unit_id = NEW.unit_id;

  RETURN NEW;
END;
$$;

COMMIT;
