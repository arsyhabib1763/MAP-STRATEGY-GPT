import type { PlanKind } from "./strategy";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODELS = {
  thinker: "google/gemini-3.5-flash",
  worker: "openai/gpt-5.2-codex",
  architect: "anthropic/claude-sonnet-5",
  auditor: "qwen/qwen3.7-max",
} as const;

type JsonSchema = Record<string, unknown>;

async function callModel({
  key,
  model,
  system,
  user,
  schema,
  search = false,
  maxTokens = 5000,
}: {
  key: string;
  model: string;
  system: string;
  user: string;
  schema: JsonSchema;
  search?: boolean;
  maxTokens?: number;
}) {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "SIMPUL Strategy Studio",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "strategy_payload",
          strict: true,
          schema,
        },
      },
      provider: { require_parameters: true },
      ...(search
        ? {
            tools: [
              {
                type: "openrouter:web_search",
                parameters: {
                  engine: "parallel",
                  max_results: 6,
                  max_total_results: 10,
                  max_characters: 3500,
                },
              },
            ],
          }
        : {}),
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${model}: ${response.status} ${detail.slice(0, 220)}`);
  }
  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${model}: respons kosong`);
  return typeof content === "string" ? JSON.parse(content) : content;
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
      minItems: 5,
      maxItems: 14,
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
          label: { type: "string" },
        },
        required: ["id", "source", "target", "label"],
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
    model: MODELS.thinker,
    search: true,
    schema: thinkerSchema,
    system:
      "Anda adalah Thinking & Research Agent. Teliti tujuan pengguna memakai sumber primer/tepercaya. Pisahkan fakta, asumsi, batasan, risiko, dan indikator keberhasilan. Jangan tampilkan chain-of-thought. Keluarkan hanya JSON sesuai schema, dalam Bahasa Indonesia yang jelas untuk pengguna awam.",
    user: `Jenis rencana: ${kind}\nPermintaan pengguna: ${prompt}`,
  });

  const worker = await callModel({
    key,
    model: MODELS.worker,
    schema: rubricSchema,
    system:
      "Anda adalah Worker & Evaluation-Engine Agent. Rancang rubrik penilaian kasus-spesifik yang dapat dihitung deterministik. Bobot harus berjumlah tepat 1. Gunakan empat dimensi: optimality, timeEfficiency, success, effortReturn. Tentukan horizon, asumsi, hard constraints, dan catatan audit. Keluarkan hanya JSON.",
    user: JSON.stringify({ kind, prompt, research: thinker }),
  });

  const architect = await callModel({
    key,
    model: MODELS.architect,
    schema: graphSchema,
    system:
      "Anda adalah Nodes & Concept Map Architect. Ubah riset dan rubrik menjadi directed acyclic strategy graph yang ringkas dan dapat dieksekusi. Gunakan 5–14 simpul, judul maksimal 5 kata, detail konkret, koordinat dalam kanvas 1200x760, durasi dalam jam, effort dan impact 1–10, confidence 0–100. Semua id unik. Sisakan ruang antar simpul dan pastikan setiap simpul terhubung ke hasil. Keluarkan hanya JSON.",
    user: JSON.stringify({ kind, prompt, research: thinker, rubric: worker }),
  });

  const auditor = await callModel({
    key,
    model: MODELS.auditor,
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
    model: MODELS.auditor,
    schema: auditSchema,
    maxTokens: 900,
    system:
      "Anda adalah Strategy Auditor. Bandingkan perubahan struktur dengan objektif dan rubrik. Jangan ubah skor deterministik. Keluarkan JSON ringkas berisi headline string dan insights array 2-4 item. Fokus pada trade-off dan tindakan korektif. Bahasa Indonesia.",
    user: JSON.stringify(payload),
  });
}
