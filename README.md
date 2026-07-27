# SIMPUL — AI Strategy Studio

SIMPUL adalah aplikasi web touchscreen-first untuk menyusun, memvisualisasikan,
dan mengaudit strategi. Aplikasi mendukung tiga bentuk rencana:

- rencana berbasis waktu untuk rutinitas harian atau mingguan;
- rencana berbasis alur untuk menyelesaikan masalah;
- goal besar dengan milestone dan multi-subgoal.

## Cara kerja agent

Satu permintaan melewati empat role dengan model berbeda:

| Role | Model OpenRouter | Tanggung jawab |
| --- | --- | --- |
| Thinking & Research | `deepseek/deepseek-v4-pro` (`xhigh` / max reasoning) | Riset web, fakta, asumsi, risiko, dan indikator keberhasilan ($0.435 / $0.87 per 1M token) |
| Worker | `openai/gpt-5.4-mini` | Rubrik, hard constraint, bobot, dan horizon audit ($0.75 / $4.50) |
| Nodes & Concept Map Architect | `minimax/minimax-m3` | Directed graph besar dan terhubung dengan biaya token rendah ($0.30 / $1.20) |
| Strategy Auditor | `qwen/qwen3.7-max` | Audit semantik, bottleneck, leverage, dan saran korektif |

Semua model non-auditor berada di bawah batas biaya yang ditetapkan: input maksimal
US$1.50 dan output maksimal US$8 per satu juta token berdasarkan katalog
OpenRouter ketika aplikasi disusun.

Riset menggunakan plugin web OpenRouter dengan engine Exa yang model-agnostik.
Jika pencarian atau endpoint utama gagal, pipeline mencoba DeepSeek V4 Flash,
lalu melakukan percobaan terakhir tanpa web agar role tidak menjatuhkan seluruh
pipeline. Semua keluaran antar-agent memakai JSON
Schema strict dan response healing agar graph dapat diproses secara
deterministik sekaligus lebih tahan terhadap JSON model yang tidak sempurna.

## Mega Strategy Canvas

- Tidak ada batas keras jumlah node pada editor maupun skema Architect Agent.
  Canvas membesar otomatis dan tata letak deterministik memecah strategi panjang
  menjadi kolom serta baris yang tetap terbaca.
- Prompt awal tidak memiliki batas karakter dari aplikasi. Pengguna dapat
  menempel strategi terperinci atau mengimpor berkas `.txt`/`.md`.
- Setiap garis mempunyai tipe relasi dan keterangan otomatis yang dapat diedit.
- Graph diperiksa otomatis agar tidak ada node yatim atau komponen terpisah;
  setiap cabang diarahkan kembali ke sasaran.
- Node dapat diduplikasi, dipecah menjadi langkah-langkah, diubah tipe/statusnya,
  lalu disusun ulang memakai layer dependensi dan pengurangan crossing.
- Garis memakai jalur ortogonal dengan sudut membulat agar mudah dilacak.
- Perangkat sentuh menggunakan pinch dua jari untuk zoom dan satu jari pada
  ruang kosong untuk menggeser canvas.
- Ekspor PDF memuat ringkasan, prompt lengkap, audit terakhir, seluruh strategy
  map pada tepat satu halaman poster A1/A0, serta sumber riset.
- Ekspor tambahan tersedia sebagai poster SVG vektor, laporan Word DOCX, dan
  backup JSON.

## Audit dua lapis

1. **Mesin lokal instan** menghitung siklus, isolated node, graph density,
   critical path, beban horizon, parallel track, rata-rata confidence, impact,
   dan rasio impact terhadap effort.
2. **Auditor AI ter-buffer** berjalan sekitar 1,8 detik setelah perubahan
   terakhir (adaptif terhadap ukuran peta) untuk menilai koherensi semantik dan
   trade-off.

Skor akhir merupakan rata-rata berbobot dari:

- optimalitas struktur;
- efisiensi waktu;
- peluang keberhasilan;
- rasio effort terhadap hasil.

Bobot dibuat khusus per kasus oleh Worker Agent dan dinormalisasi sebelum
dipakai. Jika tidak ada OpenRouter key, seluruh editor dan mesin audit lokal
tetap berfungsi dalam mode demo.

## Menjalankan lokal

Gunakan Node.js 22.13+ dan pnpm:

```bash
pnpm install
pnpm exec vinext dev
```

Buka `http://localhost:3000`.

OpenRouter key dapat:

- dimasukkan melalui dialog Setup (tersimpan hanya di `sessionStorage`); atau
- dipasang sebagai environment variable `OPENROUTER_API_KEY` pada server.

Jangan menaruh key di source code atau browser `localStorage`.

## Validasi

```bash
pnpm exec tsc --noEmit
pnpm exec vinext build
node --test tests/rendered-html.test.mjs
```

Build menghasilkan worker Cloudflare-compatible di `dist/server/index.js`.

## GitHub Pages

Build statis untuk pengujian perangkat sentuh:

```bash
pnpm run build:pages
```

Hasilnya berada di `docs/` dan dapat diterbitkan dari branch `main` dengan
source `/docs`. Pada domain `github.io`, pipeline OpenRouter berjalan langsung
dari browser ke OpenRouter. API key hanya disimpan di `sessionStorage` dan tidak
ditulis ke source, artifact, atau GitHub.
