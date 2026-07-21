-- ==============================================================
-- MIGRASI DATABASE: FMS Light - Status driver 'Inactive'
-- Versi      : 1.4.0
-- Tanggal    : 2026-07-21
-- Database   : PostgreSQL 14+
-- Deskripsi  : Menambah nilai 'Inactive' pada driver_status_enum agar
--              endpoint soft-delete driver (DELETE /api/v1/manpower/:id)
--              dapat menonaktifkan driver tanpa menghapus baris.
-- Catatan    : ALTER TYPE ... ADD VALUE TIDAK boleh berada dalam blok
--              transaksi bersama pemakaian nilainya. File ini sengaja
--              TANPA BEGIN/COMMIT agar tiap statement auto-commit.
-- Cara jalankan:
--   psql -U fms_user -d fms_light_db -f 005_add_inactive_driver_status.sql
-- ==============================================================

ALTER TYPE driver_status_enum ADD VALUE IF NOT EXISTS 'Inactive';
