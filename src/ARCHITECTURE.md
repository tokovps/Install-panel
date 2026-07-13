# Arsitektur Telegram Bot Murni

Sistem ini adalah bot Telegram murni yang dibangun menggunakan **Node.js**, **Telegraf**, **Express**, dan **MongoDB** tanpa ada komponen frontend.

## 📁 Struktur Direktori Proyek

```text
/
├── src/
│   ├── commands/       # Handler untuk Telegram Command (/start, /admin, /help, etc.)
│   ├── config/         # Konfigurasi sistem & database connection
│   ├── core/           # Mesin utama bot (Navigation, Editor, Page loaders, etc.)
│   ├── handlers/       # Handler events umum (text messages, dll.)
│   ├── models/         # Skema data Mongoose (User, Settings, Transaction)
│   ├── pages/          # Layout & pesan render interaktif bot (Home, Account, TopUp, etc.)
│   ├── routes/         # Router Express API (Health Check & Webhook AutoGoPay)
│   ├── services/       # Layanan backend (SSH, Installers, Payment)
│   ├── store/          # Penyimpanan session state sementara (wizard, input, dll.)
│   ├── utils/          # Logger & utilitas pembantu
│   └── index.js        # Entry point utama bot & server Express
├── package.json        # Dependensi & skrip start
└── .env.example        # Template variabel lingkungan
```

## ⚙️ Aliran Utama Sistem

### 1. Sistem Navigasi & Editor (Anchor Message)
Bot menggunakan **Anchor Message System** untuk memperbarui UI pesan tanpa mengirim pesan baru berulang kali. `EditorEngine` bertanggung jawab melakukan edit pesan interaktif dengan keyboard inline yang dipertahankan dalam stack navigasi (`NavigationEngine`).

### 2. Integrasi AutoGoPay
Semua konfigurasi AutoGoPay disimpan di MongoDB dalam koleksi `Settings`. Pembayaran diproses secara real-time menggunakan Webhook callback di endpoint `/api/webhooks/gopay`. Saat invoice berhasil dibayar, webhook mendeteksi dan secara otomatis memperbarui saldo pengguna serta mengirim notifikasi di Telegram.

### 3. Layanan Instalasi Server otomatis (SSH)
Layanan instalasi dijalankan di latar belakang menggunakan pustaka `ssh2`. Status log dikirim langsung ke obrolan Telegram pengguna melalui `ThrottledUpdater` untuk membatasi pemanggilan API Telegram agar tidak terkena limit rate.
