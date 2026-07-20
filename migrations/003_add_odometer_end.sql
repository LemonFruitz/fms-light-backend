-- ==============================================================
-- MIGRASI DATABASE: FMS Light - Kolom odometer_end
-- Versi      : 1.2.0
-- Tanggal    : 2026-07-20
-- Database   : PostgreSQL 14+
-- Deskripsi  : Menambah kolom odometer_end pada shift_reports untuk
--              menyimpan nilai odometer akhir shift. Digunakan oleh
--              endpoint edit shift report (PATCH /:id/edit).
-- Cara jalankan:
--   psql -U fms_user -d fms_light_db -f 003_add_odometer_end.sql
-- ==============================================================

BEGIN;

ALTER TABLE shift_reports ADD COLUMN IF NOT EXISTS odometer_end INTEGER;

COMMENT ON COLUMN shift_reports.odometer_end IS 'Nilai odometer/hour-meter akhir shift. Nullable; diisi/diedit setelah shift selesai.';

COMMIT;
