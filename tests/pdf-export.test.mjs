import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import test from "node:test";
import { createStrategyPdf } from "../app/lib/export-pdf.js";

function fixture() {
  const nodes = Array.from({ length: 18 }, (_, index) => ({
    id: `node-${index + 1}`,
    title: index === 17 ? "Target besar tercapai" : `Langkah strategis ${index + 1}`,
    detail:
      "Hasil konkret, indikator selesai, pemilik langkah, dan bukti keberhasilan yang dapat diperiksa.",
    kind:
      index === 17
        ? "goal"
        : index % 7 === 0
          ? "decision"
          : index % 5 === 0
            ? "milestone"
            : index % 6 === 0
              ? "risk"
              : "task",
    x: 70 + Math.floor(index / 6) * 590,
    y: 70 + (index % 6) * 180,
    duration: 2 + index,
    effort: 2 + (index % 8),
    impact: 4 + (index % 7),
    confidence: 55 + (index % 40),
    status: index % 6 === 0 ? "warning" : "ready",
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    id: `edge-${index + 1}`,
    source: nodes[index].id,
    target: node.id,
    relation: index % 4 === 0 ? "validation" : "dependency",
    label:
      index % 4 === 0
        ? "Hasil sebelumnya harus divalidasi"
        : "Menjadi prasyarat langkah berikutnya",
  }));
  return {
    strategy: {
      id: "fixture",
      title: "Mega strategi pengembangan program akademik",
      prompt:
        "Bangun strategi terperinci untuk merancang, menguji, menjalankan, dan mengevaluasi program akademik lintas tim selama satu tahun. Pertahankan setiap risiko, dependensi, subgoal, dan indikator yang disebutkan.",
      kind: "goal",
      nodes,
      edges,
      sources: [
        {
          title: "Project Management Institute",
          url: "https://www.pmi.org/",
          domain: "pmi.org",
        },
      ],
      rubric: {
        weights: {
          optimality: 0.3,
          timeEfficiency: 0.25,
          success: 0.3,
          effortReturn: 0.15,
        },
        assumptions: [],
        hardConstraints: [],
        horizonDays: 365,
      },
      createdAt: new Date().toISOString(),
    },
    audit: {
      score: 82,
      optimality: 86,
      timeEfficiency: 79,
      success: 84,
      effortReturn: 76,
      criticalPathHours: 142,
      totalEffort: 97,
      parallelTracks: 3,
      cycleCount: 0,
      headline: "Strategi kuat dengan dua area yang perlu diberi buffer.",
      insights: [
        "Perjelas pemilik pada jalur validasi.",
        "Tambahkan buffer sebelum milestone akhir.",
        "Pertahankan tugas dengan rasio dampak terhadap effort tertinggi.",
      ],
      calculatedAt: new Date().toISOString(),
    },
  };
}

test("creates a multi-page strategy map and audit PDF", async () => {
  const { strategy, audit } = fixture();
  const pdf = createStrategyPdf(strategy, audit);
  const bytes = Buffer.from(pdf.output("arraybuffer"));
  assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
  assert.ok(bytes.length > 12_000);
  assert.ok(pdf.getNumberOfPages() >= 4);

  if (process.env.SIMPUL_PDF_FIXTURE) {
    await mkdir(dirname(process.env.SIMPUL_PDF_FIXTURE), { recursive: true });
    await writeFile(process.env.SIMPUL_PDF_FIXTURE, bytes);
  }
});
