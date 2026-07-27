import type { PlanKind } from "./strategy";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODEL_CHAINS = {
  thinker: ["deepseek/deepseek-v4-pro", "deepseek/deepseek-v4-flash"],
  worker: ["openai/gpt-5.4-mini", "minimax/minimax-m3"],
  architect: ["minimax/minimax-m3", "openai/gpt-5.4-mini"],
  auditor: ["qwen/qwen3.7-max", "qwen/qwen3.7-plus"],
} as const;

type JsonSchema = Record<string, unknown>;

function requestPlugins(searchMode: "web" | "plain") {
  return [
    ...(searchMode === "web"
      ? [{ id: "web", engine: "exa", max_results: 5 }]
      : []),
    { id: "response-healing" },
  ];
}

function reasoningParameters(model: string) {
  return model === "deepseek/deepseek-v4-pro"
    ? { reasoning: { effort: "xhigh", exclude: true } }
    : {};
}

function readableFailure(status: number, detail: string) {
  if (status === 401) return "API key OpenRouter ditolak.";
  if (status === 402) return "Saldo OpenRouter tidak mencukupi.";
  if (status === 429) return "Batas pemakaian OpenRouter sedang tercapai.";

  try {
    const parsed = JSON.parse(detail);
    return String(parsed?.error?.message || parsed?.message || `HTTP ${status}`);
  } catch {
    return detail.slice(0, 180) || `HTTP ${status}`;
  }
}

async function callModel({
  key,
  models,
  system,
  user,
  schema,
  search = false,
  maxTokens = 5000,
}: {
  key: string;
  models: readonly string[];
  system: string;
  user: string;
  schema: JsonSchema;
  search?: boolean;
  maxTokens?: number;
}) {
  const failures: string[] = [];

  const searchModes: ("web" | "plain")[] = search
    ? ["web", "plain"]
    : ["plain"];

  for (const searchMode of searchModes) {
    for (const model of models) {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.href,
          "X-Title": "SIMPUL Strategy Studio",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: maxTokens,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "strategy_payload",
              strict: true,
              schema,
            },
          },
          plugins: requestPlugins(searchMode),
          provider: { require_parameters: true },
          ...reasoningParameters(model),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const content = result.choices?.[0]?.message?.content;
        if (!content) {
          failures.push(`${model} (${searchMode}): respons kosong`);
          continue;
        }
        try {
          return typeof content === "string" ? JSON.parse(content) : content;
        } catch {
          failures.push(`${model} (${searchMode}): JSON tidak valid`);
          continue;
        }
      }

      const detail = await response.text();
      const failure = readableFailure(response.status, detail);
      if (response.status === 401 || response.status === 402) {
        throw new Error(failure);
      }
      failures.push(`${model} (${searchMode}): ${failure}`);
    }
  }

  throw new Error(
    `Semua model untuk role ini gagal. ${failures.join(" | ").slice(0, 420)}`,
  );
}

const thinkerSchema: JsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    objective: { type: "string" },
    summary: { type: "string" },
    facts: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
    constraints: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    successSignals: { type: "array", items: { type: "string" } },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          domain: { type: "string" },
        },
        required: ["title", "url", "domain"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "title",
    "objective",
    "summary",
    "facts",
    "assumptions",
    "constraints",
    "risks",
    "successSignals",
    "sources",
  ],
  additionalProperties: false,
};

const rubricSchema: JsonSchema = {
  type: "object",
  properties: {
    weights: {
      type: "object",
      properties: {
        optimality: { type: "number" },
        timeEfficiency: { type: "number" },
        success: { type: "number" },
        effortReturn: { type: "number" },
      },
      required: ["optimality", "timeEfficiency", "success", "effortReturn"],
      additionalProperties: false,
    },
    assumptions: { type: "array", items: { type: "string" } },
    hardConstraints: { type: "array", items: { type: "string" } },
    horizonDays: { type: "number" },
    auditNotes: { type: "array", items: { type: "string" } },
  },
  required: ["weights", "assumptions", "hardConstraints", "horizonDays", "auditNotes"],
  additionalProperties: false,
};

const graphSchema: JsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    nodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          detail: { type: "string" },
          kind: {
            type: "string",
            enum: ["goal", "milestone", "task", "decision", "risk"],
          },
          x: { type: "number" },
          y: { type: "number" },
          duration: { type: "number" },
          effort: { type: "number" },
          impact: { type: "number" },
          confidence: { type: "number" },
          status: { type: "string", enum: ["ready", "warning", "blocked"] },
        },
        required: [
          "id",
          "title",
          "detail",
          "kind",
          "x",
          "y",
          "duration",
          "effort",
          "impact",
          "confidence",
          "status",
        ],
        additionalProperties: false,
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          source: { type: "string" },
          target: { type: "string" },
          relation: {
            type: "string",
            enum: [
              "dependency",
              "sequence",
              "enabler",
              "validation",
              "risk_control",
              "contribution",
            ],
          },
          label: { type: "string" },
        },
        required: ["id", "source", "target", "relation", "label"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "nodes", "edges"],
  additionalProperties: false,
};

const auditSchema: JsonSchema = {
  type: "object",
  properties: {
    headline: { type: "string" },
    insights: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" },
    },
  },
  required: ["headline", "insights"],
  additionalProperties: false,
};

export async function generateStrategyInBrowser({
  key,
  prompt,
  kind,
}: {
  key: string;
  prompt: string;
  kind: PlanKind;
}) {
  const thinker = await callModel({
    key,
    models: MODEL_CHAINS.thinker,
    search: true,
    maxTokens: 40000,
    schema: thinkerSchema,
    system:
      "Anda adalah Thinking & Research Agent. Teliti tujuan pengguna memakai sumber primer/tepercaya. Pisahkan fakta, asumsi, batasan, risiko, dan indikator keberhasilan. Jangan tampilkan chain-of-thought. Keluarkan hanya JSON sesuai schema, dalam Bahasa Indonesia yang jelas untuk pengguna awam.",
    user: `Jenis rencana: ${kind}\nPermintaan pengguna: ${prompt}`,
  });

  const worker = await callModel({
    key,
    models: MODEL_CHAINS.worker,
    maxTokens: 6000,
    schema: rubricSchema,
    system:
      "Anda adalah Worker & Evaluation-Engine Agent. Rancang rubrik penilaian kasus-spesifik yang dapat dihitung deterministik. Bobot harus berjumlah tepat 1. Gunakan empat dimensi: optimality, timeEfficiency, success, effortReturn. Tentukan horizon, asumsi, hard constraints, dan catatan audit. Keluarkan hanya JSON.",
    user: JSON.stringify({ kind, prompt, research: thinker }),
  });

  const architect = await callModel({
    key,
    models: MODEL_CHAINS.architect,
    maxTokens: 12000,
    schema: graphSchema,
    system:
      "Anda adalah Nodes & Concept Map Architect. Ubah seluruh strategi terperinci, riset, dan rubrik menjadi directed strategy graph yang dapat dieksekusi. Tidak ada batas jumlah simpul: buat sebanyak yang diperlukan untuk mempertahankan setiap fase, subgoal, keputusan, risiko, mitigasi, validasi, dan hasil penting dari teks pengguna. Untuk input kompleks, lakukan dekomposisi mendalam dan jangan memadatkan detail penting hanya demi jumlah simpul sedikit. Judul maksimal 6 kata, detail konkret, koordinat boleh meluas tanpa batas kanvas tetap, durasi dalam jam, effort dan impact 1-10, confidence 0-100. Semua id unik. Setiap garis wajib memiliki relation dan label yang menjelaskan fungsi hubungan secara spesifik. Setiap simpul harus memiliki sedikitnya satu hubungan, setiap cabang harus bermuara pada sasaran, jumlah hubungan minimal nodes.length - 1, dan tidak boleh ada simpul yatim atau komponen terpisah. Pastikan setiap simpul berkontribusi pada hasil. Keluarkan hanya JSON.",
    user: JSON.stringify({ kind, prompt, research: thinker, rubric: worker }),
  });

  const auditor = await callModel({
    key,
    models: MODEL_CHAINS.auditor,
    schema: auditSchema,
    maxTokens: 1000,
    system:
      "Anda adalah Strategy Auditor. Tinjau koherensi semantik dari peta, cari bottleneck, asumsi rapuh, dan leverage terbesar. Jangan mengarang skor numerik karena skor dihitung mesin deterministik. Beri headline singkat dan 2–4 insight tindakan dalam Bahasa Indonesia. Keluarkan hanya JSON.",
    user: JSON.stringify({
      prompt,
      research: thinker,
      rubric: worker,
      graph: architect,
    }),
  });

  return {
    strategy: {
      title: architect.title || thinker.title,
      prompt,
      kind,
      nodes: architect.nodes,
      edges: architect.edges,
      sources: thinker.sources,
      rubric: worker,
    },
    semanticAudit: auditor,
  };
}

export async function auditStrategyInBrowser({
  key,
  payload,
}: {
  key: string;
  payload: unknown;
}) {
  return callModel({
    key,
    models: MODEL_CHAINS.auditor,
    schema: auditSchema,
    maxTokens: 900,
    system:
      "Anda adalah Strategy Auditor. Bandingkan perubahan struktur dengan objektif dan rubrik. Jangan ubah skor deterministik. Keluarkan JSON ringkas berisi headline string dan insights array 2-4 item. Fokus pada trade-off dan tindakan korektif. Bahasa Indonesia.",
    user: JSON.stringify(payload),
  });
}
