# FMS Light — Backend API

Backend Node.js + PostgreSQL untuk sistem **Web-Based Shift Starter (FMS Light)**.

## Prasyarat

- Node.js ≥ 18
- PostgreSQL ≥ 14

## Setup

```bash
# 1. Install dependensi
npm install

# 2. Konfigurasi environment
cp .env.example .env
# Edit .env sesuai kredensial database lokal Anda

# 3. Buat database PostgreSQL
createdb fms_light_db

# 4. Jalankan migrasi + seed data
node migrations/runner.js --seed

# 5. Jalankan server
npm run dev
```

## Struktur Folder

```
fms-light-backend/
├── migrations/
│   ├── 001_initial_schema.sql   ← Skema tabel, enum, trigger, index
│   └── runner.js                ← Script eksekusi migrasi
├── seeds/
│   └── 002_seed_master_data.sql ← Data P2H & Fit-to-Work dari PRD
├── src/
│   ├── config/
│   │   └── database.js          ← Pool koneksi PostgreSQL
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── vehicleController.js
│   │   └── shiftReportController.js ← Business logic utama
│   ├── middleware/
│   │   ├── authMiddleware.js    ← JWT verification
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── index.js
│   │   ├── authRoutes.js
│   │   ├── vehicleRoutes.js
│   │   └── shiftReportRoutes.js
│   └── utils/
│       └── responseHelper.js
└── server.js                    ← Entry point Express
```

## API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/v1/auth/login` | Login driver |
| GET | `/api/v1/server-time` | Waktu server (deteksi time drift) |
| GET | `/api/v1/vehicles/search?q=` | Autocomplete unit |
| GET | `/api/v1/vehicles/:unit_id` | Detail & status unit |
| POST | `/api/v1/shift-reports` | Submit laporan shift |
| POST | `/api/v1/shift-reports/sync-batch` | Sync data offline |
| GET | `/health` | Health check |
