-- ==============================================================
-- MIGRASI DATABASE: FMS Light - Kolom tambahan maintenance_tickets
-- Versi      : 1.3.0
-- Tanggal    : 2026-07-21
-- Database   : PostgreSQL 14+
-- Deskripsi  : Menambah kolom untuk manajemen tiket maintenance
--              (endpoint GET/PATCH /api/v1/maintenance).
--              Catatan: status, resolved_by, resolved_at sudah ada sejak
--              migrasi 001 — ALTER di bawah pakai IF NOT EXISTS sehingga
--              yang sudah ada di-skip. Yang benar-benar baru: assigned_to
--              dan resolution.
-- Cara jalankan:
--   psql -U fms_user -d fms_light_db -f 004_maintenance_ticket_fields.sql
-- ==============================================================

BEGIN;

ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Open';
ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(100);
ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS resolution TEXT;
ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(100);
ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

COMMENT ON COLUMN maintenance_tickets.assigned_to IS 'Nama/ID mekanik atau tim yang ditugaskan menangani tiket.';
COMMENT ON COLUMN maintenance_tickets.resolution IS 'Deskripsi tindakan perbaikan yang dilakukan saat tiket ditutup.';

COMMIT;
