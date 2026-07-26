import { NextResponse } from "next/server";

const MODEL = "qwen/qwen3.7-max";

export async function POST(request: Request) {
  try {
    const key =
      request.headers.get("x-openrouter-key") || process.env.OPENROUTER_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "OPENROUTER_KEY_REQUIRED" },
        { status: 401 },
      );
    }
    const payload = await request.json();
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "X-Title": "SIMPUL Strategy Studio",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "Anda adalah Strategy Auditor. Bandingkan perubahan struktur dengan objektif dan rubrik. Jangan ubah skor deterministik. Keluarkan JSON ringkas berisi headline string dan insights array 2-4 item. Fokus pada trade-off dan tindakan korektif. Bahasa Indonesia.",
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
        temperature: 0.15,
        max_tokens: 900,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "audit",
            strict: true,
            schema: {
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
            },
          },
        },
        provider: { require_parameters: true },
      }),
    });
    if (!response.ok) {
      throw new Error(`Audit gagal (${response.status})`);
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return NextResponse.json({
      ...(typeof content === "string" ? JSON.parse(content) : content),
      model: data.model || MODEL,
      usage: data.usage,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "AUDIT_FAILED",
        message: error instanceof Error ? error.message : "Audit gagal.",
      },
      { status: 500 },
    );
  }
}
