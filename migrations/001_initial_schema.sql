-- ==============================================================
-- MIGRASI DATABASE: FMS Light - Web-Based Shift Starter System
-- Versi      : 1.0.0
-- Tanggal    : 2026-06-05
-- Database   : PostgreSQL 14+
-- Deskripsi  : Membuat semua tabel inti, enum types, index,
--              dan constraint sesuai spesifikasi PRD FMS Light.
-- Cara jalankan:
--   psql -U fms_user -d fms_light_db -f 001_initial_schema.sql
-- ==============================================================

BEGIN;

-- ─────────────────────────────────────────────
-- SECTION 0: ENUM TYPES
-- Mendefinisikan domain nilai yang diizinkan
-- untuk menjaga integritas data di level DB.
-- ─────────────────────────────────────────────

CREATE TYPE driver_status_enum AS ENUM (
  'Active',       -- Driver aktif, boleh mengisi shift
  'Suspended',    -- Diblokir sementara oleh admin
  'Off-Duty'      -- Sedang tidak dalam jadwal kerja
);

CREATE TYPE unit_status_enum AS ENUM (
  'Ready',        -- Unit siap digunakan
  'Breakdown',    -- Unit rusak kritis, diblokir sistem
  'Maintenance'   -- Unit dalam perawatan terjadwal
);

CREATE TYPE fit_status_enum AS ENUM (
  'Fit',          -- Driver lolos skrining kesehatan
  'Unfit'         -- Driver gagal, proses dihentikan
);

CREATE TYPE p2h_status_enum AS ENUM (
  'Passed',       -- Semua komponen kritis OK
  'Failed'        -- Ada komponen kritis rusak → Breakdown
);

CREATE TYPE risk_classification_enum AS ENUM (
  'CRITICAL',     -- Komponen vital (rem, kemudi) → blokir unit
  'NON_CRITICAL'  -- Komponen minor → catat, izinkan jalan
);

CREATE TYPE sync_status_enum AS ENUM (
  'pending',      -- Tersimpan lokal, belum ter-sync ke server
  'synced',       -- Berhasil dikirim ke server
  'failed'        -- Gagal sync setelah beberapa percobaan
);


-- ─────────────────────────────────────────────
-- SECTION 1: TABEL users_driver
-- Menyimpan data identitas dan status driver/operator.
-- ─────────────────────────────────────────────

CREATE TABLE users_driver (
  driver_id       VARCHAR(50)         PRIMARY KEY,
  name            VARCHAR(100)        NOT NULL,
  license_type    VARCHAR(20),                              -- SIM A, SIM B1, SIM B2, dll.
  license_expiry  DATE,                                     -- Tanggal kadaluarsa SIM
  phone           VARCHAR(20),
  department      VARCHAR(100),
  status          driver_status_enum  NOT NULL DEFAULT 'Active',
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  users_driver             IS 'Data master driver/operator armada.';
COMMENT ON COLUMN users_driver.driver_id   IS 'ID Karyawan unik (misal: EMP-001).';
COMMENT ON COLUMN users_driver.status      IS 'Status keaktifan driver: Active, Suspended, Off-Duty.';


-- ─────────────────────────────────────────────
-- SECTION 2: TABEL vehicles
-- Menyimpan data master kendaraan/unit armada.
-- ─────────────────────────────────────────────

CREATE TABLE vehicles (
  unit_id              VARCHAR(50)       PRIMARY KEY,
  vehicle_type         VARCHAR(50)       NOT NULL,          -- Dump Truck, Excavator, Grader, dll.
  license_plate        VARCHAR(20)       UNIQUE,
  year_manufacture     SMALLINT,
  last_odometer_value  INTEGER           NOT NULL DEFAULT 0, -- KM atau HM terakhir tercatat
  status_unit          unit_status_enum  NOT NULL DEFAULT 'Ready',
  notes                TEXT,                                 -- Catatan kondisi atau lokasi unit
  created_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  vehicles                      IS 'Data master unit kendaraan/alat berat armada.';
COMMENT ON COLUMN vehicles.last_odometer_value  IS 'Nilai odometer/hour-meter terakhir. Digunakan untuk validasi input shift berikutnya (tidak boleh lebih rendah).';
COMMENT ON COLUMN vehicles.status_unit          IS 'Status unit: Ready, Breakdown, Maintenance. Jika Breakdown/Maintenance, sistem memblokir pengisian shift baru.';


-- ─────────────────────────────────────────────
-- SECTION 3: TABEL p2h_check_items
-- Master checklist komponen P2H beserta klasifikasi risiko.
-- Isi tabel ini via seeds/002_p2h_items.sql
-- ─────────────────────────────────────────────

CREATE TABLE p2h_check_items (
  item_id         SERIAL              PRIMARY KEY,
  component_name  VARCHAR(100)        NOT NULL,             -- Nama komponen (misal: "Sistem Pengereman")
  check_type      VARCHAR(100)        NOT NULL,             -- Jenis pengecekan (misal: "Fungsi rem utama & parkir")
  classification  risk_classification_enum NOT NULL,
  action_if_fail  TEXT                NOT NULL,             -- Deskripsi aksi sistem jika komponen rusak
  display_order   SMALLINT            NOT NULL DEFAULT 0,   -- Urutan tampil di form
  is_active       BOOLEAN             NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE p2h_check_items IS 'Master checklist komponen P2H. CRITICAL = blokir unit jika rusak. NON_CRITICAL = catat di log, unit tetap boleh jalan.';


-- ─────────────────────────────────────────────
-- SECTION 4: TABEL fit_to_work_questions
-- Master pertanyaan skrining kesehatan Fit-to-Work.
-- ─────────────────────────────────────────────

CREATE TABLE fit_to_work_questions (
  question_id     SERIAL              PRIMARY KEY,
  question_text   TEXT                NOT NULL,
  ideal_answer    BOOLEAN             NOT NULL,             -- TRUE = "Ya" adalah jawaban ideal
  danger_level    VARCHAR(20)         NOT NULL DEFAULT 'Kritikal',
  display_order   SMALLINT            NOT NULL DEFAULT 0,
  is_active       BOOLEAN             NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  fit_to_work_questions            IS 'Master pertanyaan kuesioner kesehatan driver sebelum shift.';
COMMENT ON COLUMN fit_to_work_questions.ideal_answer IS 'Jawaban yang diharapkan. TRUE = driver harus menjawab Ya, FALSE = driver harus menjawab Tidak.';


-- ─────────────────────────────────────────────
-- SECTION 5: TABEL shift_reports
-- Laporan utama per shift. Satu baris = satu serah terima shift.
-- ─────────────────────────────────────────────

CREATE TABLE shift_reports (
  report_id             VARCHAR(100)      PRIMARY KEY,       -- UUID v4, dibuat di aplikasi
  driver_id             VARCHAR(50)       NOT NULL REFERENCES users_driver(driver_id) ON DELETE RESTRICT,
  unit_id               VARCHAR(50)       NOT NULL REFERENCES vehicles(unit_id) ON DELETE RESTRICT,

  -- Waktu pengisian
  timestamp_filled      TIMESTAMPTZ       NOT NULL,          -- Waktu asli pengisian (bisa offline)
  timestamp_submitted   TIMESTAMPTZ       NOT NULL DEFAULT NOW(), -- Waktu data diterima server
  timestamp_synced      TIMESTAMPTZ,                         -- Waktu berhasil di-sync dari offline

  -- Status akhir
  fit_status            fit_status_enum   NOT NULL,
  p2h_status            p2h_status_enum   NOT NULL,
  overall_status        VARCHAR(20)       GENERATED ALWAYS AS (
                          CASE
                            WHEN fit_status = 'Fit' AND p2h_status = 'Passed' THEN 'Ready to Work'
                            WHEN fit_status = 'Unfit'                          THEN 'Driver Unfit'
                            ELSE                                                    'Unit Breakdown'
                          END
                        ) STORED,                           -- Kolom kalkulasi otomatis

  -- Data telemetri aktual
  odometer_entered      INTEGER           NOT NULL,
  odometer_prev         INTEGER,                             -- Snapshot nilai sebelumnya untuk audit
  photo_odometer_url    TEXT              NOT NULL,
  signature_data_uri    TEXT              NOT NULL,

  -- Deteksi manipulasi waktu (Acceptance Criteria PRD)
  device_timestamp      TIMESTAMPTZ,                        -- Waktu dari perangkat pengguna
  time_drift_seconds    INTEGER,                            -- Selisih device_timestamp vs server time
  time_drift_flagged    BOOLEAN           NOT NULL DEFAULT FALSE,

  -- Sinkronisasi offline
  sync_status           sync_status_enum  NOT NULL DEFAULT 'synced',
  offline_device_id     VARCHAR(100),                       -- Identifier perangkat yang mengisi offline

  created_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  shift_reports                   IS 'Laporan utama starting shift. Satu baris = satu sesi pengisian checklist oleh satu driver pada satu unit.';
COMMENT ON COLUMN shift_reports.overall_status    IS 'Status akhir kalkulasi otomatis: Ready to Work / Driver Unfit / Unit Breakdown.';
COMMENT ON COLUMN shift_reports.time_drift_flagged IS 'TRUE jika selisih waktu device vs server melebihi threshold (indikasi manipulasi jam perangkat).';
COMMENT ON COLUMN shift_reports.sync_status       IS 'Status sinkronisasi data offline: pending (belum sync), synced, failed.';


-- ─────────────────────────────────────────────
-- SECTION 6: TABEL fit_to_work_answers
-- Detail jawaban kuesioner kesehatan per laporan shift.
-- ─────────────────────────────────────────────

CREATE TABLE fit_to_work_answers (
  answer_id     BIGSERIAL     PRIMARY KEY,
  report_id     VARCHAR(100)  NOT NULL REFERENCES shift_reports(report_id) ON DELETE CASCADE,
  question_id   INTEGER       NOT NULL REFERENCES fit_to_work_questions(question_id),
  answer        BOOLEAN       NOT NULL,   -- TRUE = "Ya", FALSE = "Tidak"
  is_ideal      BOOLEAN       NOT NULL,   -- TRUE jika jawaban sesuai ideal_answer
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  UNIQUE (report_id, question_id)         -- Satu laporan hanya boleh satu jawaban per pertanyaan
);

COMMENT ON TABLE fit_to_work_answers IS 'Jawaban detail kuesioner Fit-to-Work per shift report. Digunakan untuk audit trail kesehatan driver.';


-- ─────────────────────────────────────────────
-- SECTION 7: TABEL p2h_inspection_results
-- Detail hasil pengecekan P2H per komponen per laporan shift.
-- ─────────────────────────────────────────────

CREATE TABLE p2h_inspection_results (
  result_id       BIGSERIAL               PRIMARY KEY,
  report_id       VARCHAR(100)            NOT NULL REFERENCES shift_reports(report_id) ON DELETE CASCADE,
  item_id         INTEGER                 NOT NULL REFERENCES p2h_check_items(item_id),
  is_ok           BOOLEAN                 NOT NULL,         -- TRUE = OK/Baik, FALSE = Rusak
  classification  risk_classification_enum NOT NULL,        -- Di-snapshot dari p2h_check_items saat pengisian
  notes           TEXT,                                     -- Catatan kondisi spesifik dari driver
  created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),

  UNIQUE (report_id, item_id)
);

COMMENT ON TABLE p2h_inspection_results IS 'Hasil detail inspeksi fisik P2H per komponen. Kolom classification di-snapshot untuk mencegah perubahan master data mempengaruhi data historis.';


-- ─────────────────────────────────────────────
-- SECTION 8: TABEL maintenance_tickets
-- Tiket perbaikan otomatis untuk komponen NON-CRITICAL yang rusak.
-- ─────────────────────────────────────────────

CREATE TABLE maintenance_tickets (
  ticket_id     BIGSERIAL     PRIMARY KEY,
  report_id     VARCHAR(100)  NOT NULL REFERENCES shift_reports(report_id),
  unit_id       VARCHAR(50)   NOT NULL REFERENCES vehicles(unit_id),
  item_id       INTEGER       NOT NULL REFERENCES p2h_check_items(item_id),
  description   TEXT          NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'Open',       -- Open, In Progress, Resolved
  resolved_at   TIMESTAMPTZ,
  resolved_by   VARCHAR(50)   REFERENCES users_driver(driver_id),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE maintenance_tickets IS 'Tiket log perbaikan yang dibuat otomatis sistem untuk komponen NON-CRITICAL yang dilaporkan rusak. Unit tetap boleh beroperasi.';


-- ─────────────────────────────────────────────
-- SECTION 9: INDEXES
-- Optimasi performa query di area dengan koneksi lambat.
-- ─────────────────────────────────────────────

-- shift_reports — query paling sering: cari by driver, unit, status, tanggal
CREATE INDEX idx_shift_reports_driver_id        ON shift_reports (driver_id);
CREATE INDEX idx_shift_reports_unit_id          ON shift_reports (unit_id);
CREATE INDEX idx_shift_reports_timestamp_filled ON shift_reports (timestamp_filled DESC);
CREATE INDEX idx_shift_reports_overall_status   ON shift_reports (overall_status);
CREATE INDEX idx_shift_reports_sync_status      ON shift_reports (sync_status) WHERE sync_status = 'pending';

-- Composite index: laporan terbaru per unit (untuk validasi odometer)
CREATE INDEX idx_shift_reports_unit_time        ON shift_reports (unit_id, timestamp_filled DESC);

-- vehicles — cari unit yang siap digunakan
CREATE INDEX idx_vehicles_status_unit           ON vehicles (status_unit);

-- maintenance_tickets — cari tiket terbuka per unit
CREATE INDEX idx_maintenance_tickets_unit_open  ON maintenance_tickets (unit_id, status) WHERE status = 'Open';

-- p2h_inspection_results — audit trail komponen kritis yang gagal
CREATE INDEX idx_p2h_results_report_id          ON p2h_inspection_results (report_id);
CREATE INDEX idx_p2h_results_critical_fail      ON p2h_inspection_results (classification, is_ok) WHERE classification = 'CRITICAL' AND is_ok = FALSE;


-- ─────────────────────────────────────────────
-- SECTION 10: TRIGGERS
-- Otomatisasi update timestamp dan sinkronisasi status unit.
-- ─────────────────────────────────────────────

-- Trigger function: perbarui kolom updated_at secara otomatis
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_driver_updated_at
  BEFORE UPDATE ON users_driver
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();


-- Trigger function: saat shift_report baru masuk dan p2h_status = 'Failed',
-- otomatis update vehicles.status_unit menjadi 'Breakdown'.
-- (Business Rule: Modul 3 PRD — Komponen CRITICAL rusak = kunci unit)
CREATE OR REPLACE FUNCTION trigger_update_vehicle_on_breakdown()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.p2h_status = 'Failed' THEN
    UPDATE vehicles
    SET status_unit = 'Breakdown',
        updated_at  = NOW()
    WHERE unit_id = NEW.unit_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_shift_report_breakdown
  AFTER INSERT ON shift_reports
  FOR EACH ROW EXECUTE FUNCTION trigger_update_vehicle_on_breakdown();


-- Trigger function: validasi odometer — nilai baru tidak boleh
-- lebih rendah dari nilai shift sebelumnya (mencegah manipulasi).
CREATE OR REPLACE FUNCTION trigger_validate_odometer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_last_odometer INTEGER;
BEGIN
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

CREATE TRIGGER trg_validate_odometer
  BEFORE INSERT ON shift_reports
  FOR EACH ROW EXECUTE FUNCTION trigger_validate_odometer();

COMMIT;

-- ─────────────────────────────────────────────
-- Verifikasi: pastikan semua tabel terbuat
-- ─────────────────────────────────────────────
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' ORDER BY table_name;
