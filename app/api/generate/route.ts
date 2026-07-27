import { NextResponse } from "next/server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const MODEL_CHAINS = {
  thinker: ["deepseek/deepseek-v4-pro", "deepseek/deepseek-v4-flash"],
  worker: ["openai/gpt-5.4-mini", "minimax/minimax-m3"],
  architect: ["minimax/minimax-m3", "openai/gpt-5.4-mini"],
  auditor: ["qwen/qwen3.7-max", "qwen/qwen3.7-plus"],
} as const;

function getKey(request: Request) {
  return request.headers.get("x-openrouter-key") || process.env.OPENROUTER_API_KEY;
}

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
  schema: Record<string, unknown>;
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
          "HTTP-Referer": "https://arsyhabib1763.github.io/MAP-STRATEGY-GPT/",
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
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          failures.push(`${model} (${searchMode}): respons kosong`);
          continue;
        }
        let parsed;
        try {
          parsed = typeof content === "string" ? JSON.parse(content) : content;
        } catch {
          failures.push(`${model} (${searchMode}): JSON tidak valid`);
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
      failures.push(
        `${model} (${searchMode}): ${message || `HTTP ${response.status}`}`,
      );
    }
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
    if (!prompt) {
      return NextResponse.json(
        { error: "INVALID_PROMPT", message: "Tuliskan strategi atau tujuan yang ingin dipetakan." },
        { status: 400 },
      );
    }

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
      user: JSON.stringify({ kind, prompt, research: thinker.data }),
    });

    const architect = await callModel({
      key,
      models: MODEL_CHAINS.architect,
      maxTokens: 12000,
      schema: graphSchema,
      system:
        "Anda adalah Nodes & Concept Map Architect. Ubah seluruh strategi terperinci, riset, dan rubrik menjadi directed strategy graph yang dapat dieksekusi. Tidak ada batas jumlah simpul: buat sebanyak yang diperlukan untuk mempertahankan setiap fase, subgoal, keputusan, risiko, mitigasi, validasi, dan hasil penting dari teks pengguna. Untuk input kompleks, lakukan dekomposisi mendalam dan jangan memadatkan detail penting hanya demi jumlah simpul sedikit. Judul maksimal 6 kata, detail konkret, koordinat boleh meluas tanpa batas kanvas tetap, durasi dalam jam, effort dan impact 1-10, confidence 0-100. Semua id unik. Setiap garis wajib memiliki relation dan label yang menjelaskan fungsi hubungan secara spesifik. Setiap simpul harus memiliki sedikitnya satu hubungan, setiap cabang harus bermuara pada sasaran, jumlah hubungan minimal nodes.length - 1, dan tidak boleh ada simpul yatim atau komponen terpisah. Pastikan setiap simpul berkontribusi pada hasil. Keluarkan hanya JSON.",
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
