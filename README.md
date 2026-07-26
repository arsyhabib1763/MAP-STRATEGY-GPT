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
| Thinking & Research | `google/gemini-3.5-flash` | Riset web, fakta, asumsi, risiko, dan indikator keberhasilan |
| Worker | `openai/gpt-5.2-codex` | Rubrik, hard constraint, bobot, dan horizon audit |
| Nodes & Concept Map Architect | `anthropic/claude-sonnet-5` | Directed graph berisi node dan dependency |
| Strategy Auditor | `qwen/qwen3.7-max` | Audit semantik, bottleneck, leverage, dan saran korektif |

Semua model berada di bawah batas biaya yang ditetapkan: input kurang dari
US$3 dan output kurang dari US$15 per satu juta token berdasarkan katalog
OpenRouter ketika aplikasi disusun.

Riset menggunakan server tool `openrouter:web_search` dengan pemilihan engine
otomatis dan batas hasil/konteks eksplisit. Jika server tool atau endpoint model
utama sedang gagal, pipeline beralih ke model cadangan yang tetap berada di
bawah batas biaya; untuk role riset tersedia failover native-search
`openai/gpt-4o-mini-search-preview`. Semua keluaran antar-agent memakai JSON
Schema strict agar graph dapat diproses secara deterministik.

## Audit dua lapis

1. **Mesin lokal instan** menghitung siklus, isolated node, graph density,
   critical path, beban horizon, parallel track, rata-rata confidence, impact,
   dan rasio impact terhadap effort.
2. **Auditor AI ter-buffer** berjalan sekitar 1,8 detik setelah perubahan
   terakhir untuk menilai koherensi semantik dan trade-off.

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
