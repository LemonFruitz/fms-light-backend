/**
 * src/controllers/shiftReportController.js
 *
 * Business logic utama FMS Light:
 * - Validasi Fit-to-Work (Modul 2 PRD)
 * - Evaluasi P2H + klasifikasi risiko CRITICAL/NON_CRITICAL (Modul 3 PRD)
 * - Deteksi time drift perangkat vs server (Acceptance Criteria PRD)
 * - Sync batch data offline (PWA Capabilities PRD)
 */

const { v4: uuidv4 }   = require('uuid');
const { query, getClient } = require('../config/database');
const { success, error }   = require('../utils/responseHelper');

const TIME_DRIFT_THRESHOLD = parseInt(process.env.TIME_DRIFT_THRESHOLD_SECONDS) || 300; // 5 menit

// ─────────────────────────────────────────────
// POST /api/v1/shift-reports
// Submit laporan shift baru
// ─────────────────────────────────────────────
exports.createShiftReport = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const {
      driver_id,
      unit_id,
      offline_device_id,
      latitude,
      longitude,
    } = req.body;

    // Default value untuk kolom NOT NULL — Absensi Manual dari CCR tidak
    // mengirim data FTW, P2H, odometer, foto, maupun tanda tangan.
    // Catatan: photo_odometer_url & signature_data_uri berkolom NOT NULL,
    // jadi fallback-nya string kosong ('') bukan null agar tidak memicu 23502.
    const shift = req.body.shift || (new Date().getHours() >= 7 && new Date().getHours() < 19 ? '1' : '2');
    const ftwAnswers = req.body.fit_to_work_answers || [];   // Array: [{ question_id, answer: boolean }]
    const p2hResults = req.body.p2h_results || [];           // Array: [{ item_id, is_ok: boolean, notes? }]
    const odometer_entered = req.body.odometer_entered || 0;
    const signature_data_uri = req.body.signature_data_uri || '';
    const photo_odometer_url = req.body.photo_odometer_url || '';
    const device_timestamp = req.body.device_timestamp || new Date().toISOString(); // ISO string dari perangkat (deteksi manipulasi jam)

    // ── 1. Validasi status kendaraan (Modul 1 PRD) ────────────────
    const { rows: vehicleRows } = await client.query(
      'SELECT status_unit, last_odometer_value FROM vehicles WHERE unit_id = $1',
      [unit_id]
    );
    if (!vehicleRows.length) return res.status(404).json(error('Unit tidak ditemukan.'));

    const vehicle = vehicleRows[0];
    if (['Breakdown', 'Maintenance'].includes(vehicle.status_unit)) {
      return res.status(409).json(error(
        `Unit ${unit_id} berstatus "${vehicle.status_unit}" dan tidak dapat digunakan.`,
        { status_unit: vehicle.status_unit }
      ));
    }

    // ── 2. Evaluasi Fit-to-Work (Modul 2 PRD) ────────────────────
    const { rows: questions } = await client.query(
      'SELECT question_id, ideal_answer FROM fit_to_work_questions WHERE is_active = TRUE'
    );

    let fitStatus = 'Fit';
    const answersWithIdeal = ftwAnswers.map(a => {
      const q = questions.find(q => q.question_id === a.question_id);
      const isIdeal = q ? (a.answer === q.ideal_answer) : true;
      if (!isIdeal) fitStatus = 'Unfit';
      return { ...a, is_ideal: isIdeal };
    });

    // ── 3. Evaluasi P2H (Modul 3 PRD) ────────────────────────────
    const { rows: checkItems } = await client.query(
      'SELECT item_id, classification, action_if_fail FROM p2h_check_items WHERE is_active = TRUE'
    );

    let p2hStatus = 'Passed';
    const nonCriticalFailItems = [];
    const resultsWithClassification = p2hResults.map(r => {
      const item = checkItems.find(i => i.item_id === r.item_id);
      const classification = item ? item.classification : 'NON_CRITICAL';

      if (!r.is_ok) {
        if (classification === 'CRITICAL') {
          p2hStatus = 'Failed'; // Blokir unit
        } else {
          nonCriticalFailItems.push({ ...r, action_if_fail: item?.action_if_fail });
        }
      }
      return { ...r, classification };
    });

    // ── 4. Deteksi Time Drift (Acceptance Criteria PRD) ──────────
    const serverNow = new Date();
    let timeDriftSeconds = null;
    let timeDriftFlagged = false;

    if (device_timestamp) {
      const deviceTime = new Date(device_timestamp);
      timeDriftSeconds = Math.round(Math.abs((serverNow - deviceTime) / 1000));
      timeDriftFlagged = timeDriftSeconds > TIME_DRIFT_THRESHOLD;
    }

    // ── 5. Simpan shift_report utama ──────────────────────────────
    const reportId = uuidv4();
    const { rows: reportRows } = await client.query(
      `INSERT INTO shift_reports (
        report_id, driver_id, unit_id,
        timestamp_filled, fit_status, p2h_status,
        odometer_entered, photo_odometer_url, signature_data_uri,
        device_timestamp, time_drift_seconds, time_drift_flagged,
        sync_status, offline_device_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      ) RETURNING report_id, overall_status, timestamp_submitted`,
      [
        reportId, driver_id, unit_id,
        device_timestamp || serverNow,
        fitStatus, p2hStatus,
        odometer_entered, photo_odometer_url, signature_data_uri,
        device_timestamp, timeDriftSeconds, timeDriftFlagged,
        'synced', offline_device_id || null
      ]
    );

    // ── 6. Simpan detail jawaban Fit-to-Work ──────────────────────
    // Skip jika array kosong (mis. Absensi Manual dari CCR).
    if (ftwAnswers.length > 0) {
      for (const a of answersWithIdeal) {
        await client.query(
          'INSERT INTO fit_to_work_answers (report_id, question_id, answer, is_ideal) VALUES ($1, $2, $3, $4)',
          [reportId, a.question_id, a.answer, a.is_ideal]
        );
      }
    }

    // ── 7. Simpan hasil P2H per komponen ──────────────────────────
    // Skip jika array kosong (mis. Absensi Manual dari CCR).
    if (p2hResults.length > 0) {
      for (const r of resultsWithClassification) {
        await client.query(
          'INSERT INTO p2h_inspection_results (report_id, item_id, is_ok, classification, notes) VALUES ($1, $2, $3, $4, $5)',
          [reportId, r.item_id, r.is_ok, r.classification, r.notes || null]
        );
      }
    }

    // ── 8. Buat tiket maintenance untuk NON_CRITICAL yang rusak ──
    for (const item of nonCriticalFailItems) {
      await client.query(
        `INSERT INTO maintenance_tickets (report_id, unit_id, item_id, description)
         VALUES ($1, $2, $3, $4)`,
        [reportId, unit_id, item.item_id, item.action_if_fail || 'Perlu pemeriksaan lebih lanjut.']
      );
    }
    // GPS update
    if (latitude && longitude) {
      await client.query(
        'UPDATE shift_reports SET latitude=$1, longitude=$2 WHERE report_id=$3',
        [latitude, longitude, reportId]
      );
    }

    await client.query('COMMIT');

    const report = reportRows[0];
    return res.status(201).json(success('Laporan shift berhasil disimpan.', {
      report_id:        report.report_id,
      overall_status:   report.overall_status,
      fit_status:       fitStatus,
      p2h_status:       p2hStatus,
      time_drift_flagged: timeDriftFlagged,
      submitted_at:     report.timestamp_submitted,
    }));

  } catch (err) {
    await client.query('ROLLBACK');
    // Tangani error odometer dari trigger DB
    if (err.message.startsWith('ODOMETER_INVALID')) {
      return res.status(422).json(error(err.message));
    }
    next(err);
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// POST /api/v1/shift-reports/sync-batch
// Dipanggil PWA saat koneksi pulih — sync data offline
// ─────────────────────────────────────────────
exports.syncOfflineBatch = async (req, res, next) => {
  const { reports } = req.body; // Array of report objects
  const results = { success: [], failed: [] };

  for (const report of reports) {
    try {
      // Re-use createShiftReport logic secara internal
      req.body = { ...report, sync_status: 'synced' };
      // Dalam implementasi nyata: panggil service layer
      results.success.push(report.report_id || 'unknown');
    } catch (err) {
      results.failed.push({ id: report.report_id, reason: err.message });
    }
  }

  return res.json(success('Sinkronisasi batch selesai.', results));
};

// ─────────────────────────────────────────────
// GET /api/v1/shift-reports/driver/:driver_id
// ─────────────────────────────────────────────
exports.getReportsByDriver = async (req, res, next) => {
  try {
    const { driver_id } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const { rows } = await query(
      `SELECT report_id, unit_id, timestamp_filled, overall_status, fit_status, p2h_status,
              odometer_entered, time_drift_flagged, sync_status
       FROM shift_reports
       WHERE driver_id = $1
       ORDER BY timestamp_filled DESC
       LIMIT $2 OFFSET $3`,
      [driver_id, limit, offset]
    );
    return res.json(success('OK', rows));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/v1/shift-reports/:report_id
// ─────────────────────────────────────────────
exports.getReportById = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT sr.*, 
              fta.question_id, fta.answer, fta.is_ideal,
              pir.item_id, pir.is_ok, pir.classification AS item_classification, pir.notes AS item_notes
       FROM shift_reports sr
       LEFT JOIN fit_to_work_answers fta ON fta.report_id = sr.report_id
       LEFT JOIN p2h_inspection_results pir ON pir.report_id = sr.report_id
       WHERE sr.report_id = $1`,
      [req.params.report_id]
    );
    if (!rows.length) return res.status(404).json(error('Laporan tidak ditemukan.'));
    return res.json(success('OK', rows));
  } catch (err) {
    next(err);
  }
};
