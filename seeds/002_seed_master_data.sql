-- ==============================================================
-- SEED DATA: Master P2H Checklist & Fit-to-Work Questions
-- Sumber    : PRD FMS Light v1.0, Modul 2 & Modul 3
-- Cara jalankan (setelah 001_initial_schema.sql):
--   psql -U fms_user -d fms_light_db -f 002_seed_master_data.sql
-- ==============================================================

BEGIN;

-- ─────────────────────────────────────────────
-- Seed: Pertanyaan Fit-to-Work (Modul 2 PRD)
-- ─────────────────────────────────────────────

INSERT INTO fit_to_work_questions (question_text, ideal_answer, danger_level, display_order) VALUES
  ('Apakah Anda beristirahat/tidur cukup minimal 6 jam sebelum shift ini?',        TRUE,  'Kritikal', 1),
  ('Apakah Anda sedang dalam pengaruh obat-obatan yang memicu kantuk?',             FALSE, 'Kritikal', 2),
  ('Apakah Anda saat ini merasakan gejala pusing, demam, atau mual berlebih?',      FALSE, 'Kritikal', 3),
  ('Apakah Anda dalam kondisi bugar dan siap untuk mengemudikan unit?',              TRUE,  'Kritikal', 4),
  ('Apakah Anda telah mengonsumsi alkohol dalam 12 jam terakhir?',                  FALSE, 'Kritikal', 5);


-- ─────────────────────────────────────────────
-- Seed: Komponen P2H Checklist (Modul 3 PRD)
-- ─────────────────────────────────────────────

INSERT INTO p2h_check_items (component_name, check_type, classification, action_if_fail, display_order) VALUES
  -- Komponen CRITICAL (blokir unit jika rusak)
  ('Sistem Pengereman',   'Fungsi rem utama & parkir',            'CRITICAL',     'Kunci Status → Unit Breakdown. Larang unit beroperasi hingga diperbaiki teknisi.',                     1),
  ('Kemudi & Ban',        'Tekanan angin & baut roda',            'CRITICAL',     'Kunci Status → Unit Breakdown. Periksa tekanan ban dan kekencangan mur roda oleh teknisi.',            2),
  ('Sistem Kemudi',       'Kelancaran & responsivitas setir',     'CRITICAL',     'Kunci Status → Unit Breakdown. Kemudi tidak responsif berisiko fatal di jalur tambang.',               3),

  -- Komponen NON-CRITICAL (buat tiket, unit tetap boleh jalan)
  ('Cairan & Pelumas',    'Level oli mesin & air radiator',       'NON_CRITICAL', 'Izinkan Jalan, Buat Tiket Log Perbaikan. Pantau level cairan secara berkala selama operasi.',         4),
  ('Sistem Penerangan',   'Lampu senja & lampu kabin',            'NON_CRITICAL', 'Izinkan Jalan, Catat di Log Maintenance. Segera perbaiki sebelum operasi malam hari.',                 5),
  ('Kaca & Spion',        'Kondisi kaca depan & spion samping',   'NON_CRITICAL', 'Izinkan Jalan, Catat di Log Maintenance. Kaca retak parah harus segera diganti.',                     6),
  ('Klakson & Alarm',     'Fungsi klakson & backup alarm',        'NON_CRITICAL', 'Izinkan Jalan, Buat Tiket Log Perbaikan. Alarm mundur wajib berfungsi untuk keselamatan area.',       7),
  ('Kebersihan Unit',     'Kondisi kabin & tangga naik/turun',    'NON_CRITICAL', 'Izinkan Jalan, Catat di Log Maintenance. Bersihkan kabin dan pastikan tangga tidak licin.',           8);


COMMIT;
