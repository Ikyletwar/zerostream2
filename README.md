# 🎬 ZeroStream

ZeroStream adalah platform streaming anime modern dengan arsitektur tangguh berbasis Express.js, WebSockets, dan SQLite database. Platform ini dilengkapi dengan scraper adaptif multi-strategi untuk pembaruan episode otomatis dan ongoing release schedule tracker secara real-time.

## 🚀 Tech Stack

- **Backend**: Express.js (ES Module syntax), WebSockets (`ws`), SQLite (`node:sqlite` Native SQLite Sync API), Winston Logger.
- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript (Modular ES6 architecture).
- **Scraper**: Axios & Cheerio.
- **Process Manager**: PM2.

---

## 📁 Struktur Codebase

```
nimegami-PR2/
├── backend/
│   ├── db/                 # Folder Database Layer (terisolasi berdasarkan domain)
│   │   ├── connection.js   # Koneksi SQLite database instansi & schema migration
│   │   ├── anime.js        # Domain queries untuk anime
│   │   ├── episodes.js     # Domain queries untuk episodes
│   │   └── feed.js         # Domain queries untuk feed events (activity logs)
│   ├── routes/             # Router Modular API & halaman statis
│   │   ├── anime.js        # Endpoint API anime, genres, stats, feed
│   │   ├── schedule.js     # Endpoint API jadwal ongoing rilis mingguan
│   │   ├── admin.js        # Endpoint API administrasi (manual scrape, server status)
│   │   └── pages.js        # Router penyajian berkas halaman HTML statis
│   ├── config.js           # Konfigurasi Environment & design tokens
│   ├── database.js         # Re-export facade/gateway untuk seluruh query database
│   ├── logger.js           # Konfigurasi Winston Logger untuk log server
│   ├── middleware.js       # Rate limiter, cache GET request, log http duration, dll.
│   ├── scheduler.js        # Cron Job scheduler untuk trigger scraper periodik
│   ├── server.js           # Entry point inisialisasi Express & WebSocket server
│   ├── websocket.js        # WebSocket Server (realtime event broadcaster)
│   └── scraper/
│       └── incremental.js  # Scraper incremental (ongoing update & homepage)
├── frontend/
│   ├── css/
│   │   └── style.css       # Lembar gaya CSS terpadu
│   ├── js/
│   │   ├── common.js       # Global state, API client, bookmarks, watch history, dll.
│   │   ├── settings.js     # Manajemen tema (dark/light), layout, kualitas video, & preferences UI
│   │   ├── websocket.js    # Koneksi client WebSocket & penanganan event real-time
│   │   ├── home.js         # Logika interaksi halaman utama
│   │   ├── detail.js       # Logika pemutar video player, pencarian, & detail episode
│   │   ├── schedule.js     # Logika tampilan jadwal rilis mingguan
│   │   └── history.js      # Logika halaman riwayat tontonan
│   ├── index.html          # Halaman beranda
│   ├── anime.html          # Halaman streaming player
│   ├── schedule.html       # Halaman jadwal rilis
│   └── history.html        # Halaman riwayat tontonan
├── scripts/                # CLI Tools & Utilitas Administrasi
│   ├── add-missing.js      # CLI untuk menambah anime dari URL nimegami secara manual
│   ├── remove-anime.js     # CLI untuk menghapus anime dari database SQLite secara aman
│   ├── migrate.js          # CLI untuk migrasi data awal dari JSON ke SQLite
│   └── scraping/           # Kumpulan program utility scraper warisan (ESM format)
│       ├── scrap.js        # Scraper batch untuk mengambil seluruh daftar anime awal
│       ├── jsonrepair.js   # Program perbaikan string JSON scraper yang rusak/terpotong
│       ├── update-scrap.js # Program update metadata info anime yang kosong
│       └── final-scrap.js  # Scraper info detail nimegami adaptif dengan multi-parser
├── ecosystem.config.cjs    # Konfigurasi deployment PM2 (production)
├── .env.example            # Contoh berkas konfigurasi environment
├── package.json            # Daftar dependencies & scripts NPM
└── CONTRIBUTING.md         # Panduan kontribusi kode
```

---

## 🛠️ Langkah Penginstalan & Menjalankan Aplikasi

### 1. Prasyarat (Prerequisites)
Pastikan Anda menggunakan **Node.js versi 22.0.0 atau lebih baru** karena platform ini memanfaatkan API native SQLite Node (`node:sqlite`).

### 2. Install Dependencies
```bash
npm install
```

### 3. Konfigurasi Environment File
Salin file `.env.example` menjadi `.env` dan sesuaikan nilainya:
```bash
cp .env.example .env
```

### 4. Migrasi Data Awal (Opsional)
Jika Anda memiliki file data JSON hasil scraping sebelumnya (`data/anime_nimegami_adaptive.json`), jalankan migrasi berikut untuk memasukkan datanya ke dalam SQLite:
```bash
npm run db:migrate
```

### 5. Jalankan Server di Lingkungan Pengembangan (Development)
```bash
npm run dev
```
Server akan berjalan di http://localhost:3000. Setiap modifikasi file backend akan me-restart server secara otomatis (menggunakan Node `--watch`).

### 6. Jalankan Server di Lingkungan Produksi (Production dengan PM2)
```bash
npm run pm2:start
```
Gunakan perintah berikut untuk melihat log aktivitas atau menghentikan server PM2:
```bash
# Melihat log aktivitas server
npm run pm2:logs

# Menghentikan server
npm run pm2:stop

# Melakukan restart server
npm run pm2:restart
```

---

## 📡 Integrasi Real-Time WebSocket

ZeroStream mengirimkan pembaruan episode terbaru ke seluruh client yang sedang aktif secara instan tanpa perlu memuat ulang halaman.
- **Client Connection**: Client akan otomatis tersambung ke WebSocket server begitu memuat halaman apa pun.
- **Event `NEW_EPISODE`**: Terjadi ketika scraper mendeteksi adanya episode terbaru yang rilis. Client akan langsung menampilkan toast notifikasi interaktif.
- **Event `ANIME_UPDATED`**: Terjadi ketika data detail metadata suatu judul anime diperbarui.
