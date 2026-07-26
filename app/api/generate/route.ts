import { NextResponse } from "next/server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODELS = {
  thinker: "google/gemini-3.5-flash",
  worker: "openai/gpt-5.2-codex",
  architect: "anthropic/claude-sonnet-5",
  auditor: "qwen/qwen3.7-max",
} as const;

function getKey(request: Request) {
  return request.headers.get("x-openrouter-key") || process.env.OPENROUTER_API_KEY;
}

async function callModel({
  key,
  model,
  system,
  user,
  schema,
  search = false,
}: {
  key: string;
  model: string;
  system: string;
  user: string;
  schema: Record<string, unknown>;
  search?: boolean;
}) {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://sites.openai.com",
      "X-Title": "SIMPUL Strategy Studio",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_tokens: 5000,
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
    throw new Error(`${model}: ${response.status} ${detail.slice(0, 300)}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${model}: respons kosong`);
  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  return {
    data: parsed,
    usage: data.usage,
    model: data.model || model,
    annotations: data.choices?.[0]?.message?.annotations ?? [],
  };
}

const thinkerSchema = {
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

const rubricSchema = {
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

const graphSchema = {
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

const auditSchema = {
  type: "object",
  properties: {
    headline: { type: "string" },
    insights: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
  },
  required: ["headline", "insights"],
  additionalProperties: false,
};

export async function POST(request: Request) {
  try {
    const key = getKey(request);
    if (!key) {
      return NextResponse.json(
        { error: "OPENROUTER_KEY_REQUIRED", message: "Masukkan API key OpenRouter." },
        { status: 401 },
      );
    }
    const body = await request.json();
    const prompt = String(body.prompt || "").trim();
    const kind = ["daily", "flow", "goal"].includes(body.kind) ? body.kind : "goal";
    if (prompt.length < 12 || prompt.length > 3000) {
      return NextResponse.json(
        { error: "INVALID_PROMPT", message: "Jelaskan tujuan dalam 12–3000 karakter." },
        { status: 400 },
      );
    }

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
      user: JSON.stringify({ kind, prompt, research: thinker.data }),
    });

    const architect = await callModel({
      key,
      model: MODELS.architect,
      schema: graphSchema,
      system:
        "Anda adalah Nodes & Concept Map Architect. Ubah riset dan rubrik menjadi directed acyclic strategy graph yang ringkas dan dapat dieksekusi. Gunakan 5–14 simpul, judul maksimal 5 kata, detail konkret, koordinat dalam kanvas 1200x760, durasi dalam jam, effort dan impact 1–10, confidence 0–100. Semua id unik. Sisakan ruang antar simpul dan pastikan setiap simpul terhubung ke hasil. Keluarkan hanya JSON.",
      user: JSON.stringify({
        kind,
        prompt,
        research: thinker.data,
        rubric: worker.data,
      }),
    });

    const auditor = await callModel({
      key,
      model: MODELS.auditor,
      schema: auditSchema,
      system:
        "Anda adalah Strategy Auditor. Tinjau koherensi semantik dari peta, cari bottleneck, asumsi rapuh, dan leverage terbesar. Jangan mengarang skor numerik karena skor dihitung mesin deterministik. Beri headline singkat dan 2–4 insight tindakan dalam Bahasa Indonesia. Keluarkan hanya JSON.",
      user: JSON.stringify({
        prompt,
        research: thinker.data,
        rubric: worker.data,
        graph: architect.data,
      }),
    });

    const usage = [thinker, worker, architect, auditor].map((result) => ({
      role:
        result === thinker
          ? "Thinking"
          : result === worker
            ? "Worker"
            : result === architect
              ? "Architect"
              : "Auditor",
      model: result.model,
      usage: result.usage,
    }));

    return NextResponse.json({
      strategy: {
        title: architect.data.title || thinker.data.title,
        prompt,
        kind,
        nodes: architect.data.nodes,
        edges: architect.data.edges,
        sources: thinker.data.sources,
        rubric: worker.data,
      },
      semanticAudit: auditor.data,
      researchSummary: thinker.data.summary,
      usage,
      modelPlan: MODELS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
    return NextResponse.json(
      { error: "GENERATION_FAILED", message },
      { status: 500 },
    );
  }
}
