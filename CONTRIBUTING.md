# 🤝 Panduan Kontribusi ZeroStream

Kami menyambut baik setiap kontribusi dari developer untuk meningkatkan performa, fitur, keamanan, maupun desain ZeroStream. Harap baca panduan ini sebelum mengirimkan Pull Request.

## 🚀 Standar Kualitas Kode (Coding Standards)

Untuk menjaga kebersihan dan konsistensi kode di seluruh project, pastikan Anda mengikuti pedoman berikut:

### 1. Backend Standards
- **ES Modules**: Gunakan sintaks ES Modules (`import`/`export`) secara konsisten. Jangan gunakan `require()`.
- **Domain Separation**: Tempatkan query database baru di file yang relevan di bawah `backend/db/` berdasarkan domainnya, bukan di file monolitik `database.js`.
- **Router Modular**: Daftarkan API route baru di file router modular di bawah `backend/routes/`.
- **Error Handling**: Bungkus seluruh blok kode yang rawan gagal dalam `try-catch` dan gunakan `logger` (Winston) untuk mencatat detail kesalahan.
- **JSDoc**: Selalu sertakan blok komentar JSDoc yang mendalam untuk mendokumentasikan tipe parameter dan tipe kembalian setiap fungsi yang diekspor.

### 2. Frontend Standards
- **Vanilla Modular JS**: Hindari framework JS besar. Pisahkan logika UI ke dalam modul JS yang relevan (seperti `settings.js` untuk layout & preferensi tema, `websocket.js` untuk live data).
- **Design Tokens**: Gunakan variabel CSS (`--bg-base`, `--accent-primary`, dll) yang dideklarasikan di style utama untuk menjaga konsistensi visual.
- **Micro-interactions**: Pastikan setiap state tombol (hover, active, focus, disabled) terlayani secara visual dengan transisi halus (`transition: all 0.2s ease`).

---

## 🛠️ Alur Kerja Pengembangan (Development Workflow)

1. **Fork & Clone Repository**
2. **Buat Branch Baru**
   ```bash
   git checkout -b feature/nama-fitur-baru
   ```
3. **Lakukan Perubahan & Jalankan Linter/Verifikasi**
   Pastikan aplikasi berjalan tanpa error sebelum melakukan commit:
   ```bash
   npm run dev
   ```
4. **Commit dengan Pesan yang Jelas**
   ```bash
   git commit -m "feat: menambah fitur filter genre dinamis di beranda"
   ```
5. **Push ke Branch Anda & Buat Pull Request**

---

## 🐞 Melaporkan Bug & Masalah Keamanan

- **Bug Reports**: Buka Issue baru dan sertakan detail langkah reproduksi bug, versi Node.js yang digunakan, serta log error dari Winston Logger jika ada.
- **Security Vulnerability**: Jika menemukan celah keamanan kritis, jangan laporkan di publik. Harap kirimkan laporan tertutup langsung ke tim administrator.
