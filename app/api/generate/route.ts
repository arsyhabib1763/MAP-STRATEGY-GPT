import { NextResponse } from "next/server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODEL_CHAINS = {
  thinker: [
    "google/gemini-3.5-flash",
    "openai/gpt-4o-mini-search-preview",
  ],
  worker: ["openai/gpt-5.2-codex", "google/gemini-3.5-flash-lite"],
  architect: ["anthropic/claude-sonnet-5", "google/gemini-3.6-flash"],
  auditor: ["qwen/qwen3.7-max", "qwen/qwen3.7-plus"],
} as const;

function getKey(request: Request) {
  return request.headers.get("x-openrouter-key") || process.env.OPENROUTER_API_KEY;
}

async function callModel({
  key,
  models,
  system,
  user,
  schema,
  search = false,
}: {
  key: string;
  models: readonly string[];
  system: string;
  user: string;
  schema: Record<string, unknown>;
  search?: boolean;
}) {
  const failures: string[] = [];

  for (const model of models) {
    const searchParameters =
      model === "openai/gpt-4o-mini-search-preview"
        ? { web_search_options: { search_context_size: "medium" } }
        : {
            tools: [
              {
                type: "openrouter:web_search",
                parameters: {
                  engine: "auto",
                  max_results: 5,
                  max_total_results: 8,
                  max_uses: 2,
                  search_context_size: "low",
                },
              },
            ],
          };

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://simpul-strategy-studio.arsyhabib1763.chatgpt.site",
        "X-Title": "SIMPUL Strategy Studio",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
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
        ...(search ? searchParameters : {}),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        failures.push(`${model}: respons kosong`);
        continue;
      }
      let parsed;
      try {
        parsed = typeof content === "string" ? JSON.parse(content) : content;
      } catch {
        failures.push(`${model}: JSON tidak valid`);
        continue;
      }
      return {
        data: parsed,
        usage: data.usage,
        model: data.model || model,
        annotations: data.choices?.[0]?.message?.annotations ?? [],
      };
    }

    const detail = await response.text();
    let message = detail.slice(0, 180);
    try {
      const parsed = JSON.parse(detail);
      message = String(parsed?.error?.message || parsed?.message || message);
    } catch {
      // Keep the plain response text.
    }
    if (response.status === 401) throw new Error("API key OpenRouter ditolak.");
    if (response.status === 402) {
      throw new Error("Saldo OpenRouter tidak mencukupi.");
    }
    failures.push(`${model}: ${message || `HTTP ${response.status}`}`);
  }

  throw new Error(
    `Semua model untuk role ini gagal. ${failures.join(" | ").slice(0, 420)}`,
  );
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
      models: MODEL_CHAINS.thinker,
      search: true,
      schema: thinkerSchema,
      system:
        "Anda adalah Thinking & Research Agent. Teliti tujuan pengguna memakai sumber primer/tepercaya. Pisahkan fakta, asumsi, batasan, risiko, dan indikator keberhasilan. Jangan tampilkan chain-of-thought. Keluarkan hanya JSON sesuai schema, dalam Bahasa Indonesia yang jelas untuk pengguna awam.",
      user: `Jenis rencana: ${kind}\nPermintaan pengguna: ${prompt}`,
    });

    const worker = await callModel({
      key,
      models: MODEL_CHAINS.worker,
      schema: rubricSchema,
      system:
        "Anda adalah Worker & Evaluation-Engine Agent. Rancang rubrik penilaian kasus-spesifik yang dapat dihitung deterministik. Bobot harus berjumlah tepat 1. Gunakan empat dimensi: optimality, timeEfficiency, success, effortReturn. Tentukan horizon, asumsi, hard constraints, dan catatan audit. Keluarkan hanya JSON.",
      user: JSON.stringify({ kind, prompt, research: thinker.data }),
    });

    const architect = await callModel({
      key,
      models: MODEL_CHAINS.architect,
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
      models: MODEL_CHAINS.auditor,
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
      modelPlan: MODEL_CHAINS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
    return NextResponse.json(
      { error: "GENERATION_FAILED", message },
      { status: 500 },
    );
  }
}
