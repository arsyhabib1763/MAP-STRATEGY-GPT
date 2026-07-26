export type PlanKind = "daily" | "flow" | "goal";
export type NodeKind = "goal" | "milestone" | "task" | "decision" | "risk";
export type NodeStatus = "ready" | "warning" | "blocked";
export type EdgeRelation =
  | "dependency"
  | "sequence"
  | "enabler"
  | "validation"
  | "risk_control"
  | "contribution";

export const EDGE_RELATION_LABEL: Record<EdgeRelation, string> = {
  dependency: "Prasyarat",
  sequence: "Urutan",
  enabler: "Pengungkit",
  validation: "Validasi",
  risk_control: "Kontrol risiko",
  contribution: "Kontribusi",
};

export type StrategyNode = {
  id: string;
  title: string;
  detail: string;
  kind: NodeKind;
  x: number;
  y: number;
  duration: number;
  effort: number;
  impact: number;
  confidence: number;
  status?: NodeStatus;
};

export type StrategyEdge = {
  id: string;
  source: string;
  target: string;
  relation: EdgeRelation;
  label: string;
};

export type Source = {
  title: string;
  url: string;
  domain: string;
};

export type AuditRubric = {
  weights: {
    optimality: number;
    timeEfficiency: number;
    success: number;
    effortReturn: number;
  };
  assumptions: string[];
  hardConstraints: string[];
  horizonDays: number;
};

export type AuditResult = {
  score: number;
  optimality: number;
  timeEfficiency: number;
  success: number;
  effortReturn: number;
  criticalPathHours: number;
  totalEffort: number;
  parallelTracks: number;
  cycleCount: number;
  headline: string;
  insights: string[];
  calculatedAt: string;
};

export type StrategyDocument = {
  id: string;
  title: string;
  prompt: string;
  kind: PlanKind;
  nodes: StrategyNode[];
  edges: StrategyEdge[];
  sources: Source[];
  rubric: AuditRubric;
  createdAt: string;
};

export const DEFAULT_RUBRIC: AuditRubric = {
  weights: {
    optimality: 0.3,
    timeEfficiency: 0.25,
    success: 0.3,
    effortReturn: 0.15,
  },
  assumptions: [
    "Waktu fokus tersedia 6 jam per minggu.",
    "Progres ditinjau setiap hari Minggu.",
    "Target dapat diuji dengan bukti yang terukur.",
  ],
  hardConstraints: [
    "Tidak ada tugas yang dimulai sebelum prasyaratnya selesai.",
    "Beban satu hari tidak melebihi kapasitas pengguna.",
  ],
  horizonDays: 42,
};

export const DEMO_STRATEGY: StrategyDocument = {
  id: "demo-scholarship",
  title: "Strategi beasiswa semester depan",
  prompt:
    "Susun strategi 6 minggu untuk meningkatkan peluang mendapatkan beasiswa akademik.",
  kind: "goal",
  createdAt: "2026-07-27T00:00:00.000Z",
  rubric: DEFAULT_RUBRIC,
  sources: [
    {
      title: "SMART Goals: A How to Guide",
      domain: "ucop.edu",
      url: "https://www.ucop.edu/local-human-resources/_files/performance-appraisal/How%20to%20write%20SMART%20Goals%20v2.pdf",
    },
    {
      title: "Implementation intentions and goal achievement",
      domain: "apa.org",
      url: "https://psycnet.apa.org/record/2006-09000-003",
    },
    {
      title: "Critical Path Method",
      domain: "pmi.org",
      url: "https://www.pmi.org/learning/library/critical-path-method-calculations-scheduling-8040",
    },
  ],
  nodes: [
    {
      id: "goal",
      title: "Menang beasiswa",
      detail: "Aplikasi lengkap, relevan, dan dikirim ≥48 jam sebelum tenggat.",
      kind: "goal",
      x: 510,
      y: 70,
      duration: 2,
      effort: 3,
      impact: 10,
      confidence: 74,
      status: "ready",
    },
    {
      id: "requirements",
      title: "Petakan persyaratan",
      detail: "Buat matriks syarat, bukti, bobot, dan tenggat.",
      kind: "task",
      x: 100,
      y: 230,
      duration: 3,
      effort: 2,
      impact: 8,
      confidence: 94,
      status: "ready",
    },
    {
      id: "gap",
      title: "Audit kesenjangan",
      detail: "Bandingkan profil saat ini dengan kriteria penilaian.",
      kind: "decision",
      x: 390,
      y: 230,
      duration: 2,
      effort: 3,
      impact: 9,
      confidence: 81,
      status: "ready",
    },
    {
      id: "portfolio",
      title: "Bangun bukti prestasi",
      detail: "Pilih dua bukti berdampak yang dapat diselesaikan dalam 4 minggu.",
      kind: "milestone",
      x: 690,
      y: 230,
      duration: 18,
      effort: 8,
      impact: 10,
      confidence: 68,
      status: "warning",
    },
    {
      id: "mentor",
      title: "Kunci rekomendasi",
      detail: "Hubungi calon pemberi rekomendasi dengan paket konteks singkat.",
      kind: "task",
      x: 100,
      y: 420,
      duration: 4,
      effort: 4,
      impact: 8,
      confidence: 76,
      status: "ready",
    },
    {
      id: "essay",
      title: "Tulis narasi utama",
      detail: "Hubungkan tujuan, bukti, dampak, dan rencana kontribusi.",
      kind: "task",
      x: 390,
      y: 420,
      duration: 10,
      effort: 7,
      impact: 10,
      confidence: 72,
      status: "ready",
    },
    {
      id: "review",
      title: "Uji dengan reviewer",
      detail: "Dapatkan dua putaran umpan balik memakai rubrik seleksi.",
      kind: "milestone",
      x: 690,
      y: 420,
      duration: 8,
      effort: 5,
      impact: 9,
      confidence: 64,
      status: "warning",
    },
    {
      id: "risk",
      title: "Risiko: bukti terlambat",
      detail: "Siapkan bukti alternatif dan batas keputusan pada minggu ke-3.",
      kind: "risk",
      x: 930,
      y: 300,
      duration: 2,
      effort: 2,
      impact: 7,
      confidence: 57,
      status: "warning",
    },
    {
      id: "submit",
      title: "Kirim & verifikasi",
      detail: "Final check, unggah, simpan bukti pengiriman, dan follow-up.",
      kind: "task",
      x: 510,
      y: 600,
      duration: 3,
      effort: 3,
      impact: 9,
      confidence: 92,
      status: "ready",
    },
  ],
  edges: [
    { id: "e1", source: "requirements", target: "gap", relation: "validation", label: "Menjadi dasar audit" },
    { id: "e2", source: "gap", target: "portfolio", relation: "enabler", label: "Menentukan bukti prioritas" },
    { id: "e3", source: "requirements", target: "mentor", relation: "dependency", label: "Menentukan kebutuhan rekomendasi" },
    { id: "e4", source: "gap", target: "essay", relation: "enabler", label: "Mengarahkan narasi" },
    { id: "e5", source: "portfolio", target: "review", relation: "validation", label: "Bukti diuji reviewer" },
    { id: "e6", source: "essay", target: "review", relation: "validation", label: "Narasi diuji reviewer" },
    { id: "e7", source: "portfolio", target: "risk", relation: "risk_control", label: "Memunculkan risiko keterlambatan" },
    { id: "e8", source: "mentor", target: "submit", relation: "dependency", label: "Rekomendasi wajib tersedia" },
    { id: "e9", source: "review", target: "submit", relation: "sequence", label: "Finalisasi setelah review" },
    { id: "e10", source: "risk", target: "submit", relation: "risk_control", label: "Risiko harus dikendalikan" },
    { id: "e11", source: "submit", target: "goal", relation: "contribution", label: "Menghasilkan aplikasi kompetitif" },
  ],
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function deriveNodeStatus(node: StrategyNode): NodeStatus {
  if (
    node.confidence < 35 ||
    (node.kind === "risk" && node.impact >= 8 && node.confidence < 55)
  ) {
    return "blocked";
  }
  if (
    node.confidence < 68 ||
    (node.effort >= 8 && node.impact <= 6) ||
    node.duration <= 0
  ) {
    return "warning";
  }
  return "ready";
}

export function nodePriorityScore(node: StrategyNode) {
  const expectedImpact = node.impact * (node.confidence / 100);
  const cost = Math.max(1, node.effort * 0.7 + Math.sqrt(Math.max(0, node.duration)));
  return Math.round(clamp(38 + (expectedImpact / cost) * 13));
}

export function inferEdgeRelation(
  source: StrategyNode,
  target: StrategyNode,
): Pick<StrategyEdge, "relation" | "label"> {
  if (source.kind === "risk" || target.kind === "risk") {
    return {
      relation: "risk_control",
      label:
        source.kind === "risk"
          ? "Risiko harus dikendalikan sebelum langkah ini"
          : "Langkah ini memunculkan risiko yang perlu dikendalikan",
    };
  }
  if (target.kind === "decision") {
    return { relation: "validation", label: "Memberi bukti untuk keputusan" };
  }
  if (source.kind === "decision") {
    return { relation: "enabler", label: "Keputusan ini mengarahkan langkah berikutnya" };
  }
  if (target.kind === "goal") {
    return { relation: "contribution", label: "Berkontribusi langsung pada hasil" };
  }
  if (source.kind === "milestone" || target.kind === "milestone") {
    return { relation: "sequence", label: "Membuka tahap strategi berikutnya" };
  }
  return { relation: "dependency", label: "Menjadi prasyarat untuk langkah berikutnya" };
}

export function arrangeStrategyNodes(
  nodes: StrategyNode[],
  edges: StrategyEdge[],
): StrategyNode[] {
  if (!nodes.length) return [];
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  edges.forEach((edge) => {
    if (!incoming.has(edge.source) || !incoming.has(edge.target)) return;
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  });

  const levels = new Map<string, number>();
  const queue = nodes
    .filter((node) => incoming.get(node.id) === 0)
    .map((node) => node.id);
  queue.forEach((id) => levels.set(id, 0));
  let cursor = 0;
  while (cursor < queue.length) {
    const id = queue[cursor++];
    const nextLevel = (levels.get(id) ?? 0) + 1;
    for (const next of outgoing.get(id) ?? []) {
      levels.set(next, Math.max(levels.get(next) ?? 0, nextLevel));
      incoming.set(next, (incoming.get(next) ?? 1) - 1);
      if (incoming.get(next) === 0) queue.push(next);
    }
  }

  const fallbackLevel = Math.max(0, ...levels.values()) + 1;
  nodes.forEach((node) => {
    if (!levels.has(node.id)) levels.set(node.id, fallbackLevel);
  });

  const grouped = new Map<number, StrategyNode[]>();
  nodes.forEach((node) => {
    const level = levels.get(node.id) ?? 0;
    grouped.set(level, [...(grouped.get(level) ?? []), node]);
  });

  const levelStart = new Map<number, number>();
  let nextX = 70;
  [...grouped.keys()]
    .sort((a, b) => a - b)
    .forEach((level) => {
      levelStart.set(level, nextX);
      const subColumns = Math.max(1, Math.ceil((grouped.get(level)?.length ?? 1) / 6));
      nextX += subColumns * 290;
    });

  return nodes.map((node) => {
    const level = levels.get(node.id) ?? 0;
    const siblings = grouped.get(level) ?? [node];
    const index = siblings.findIndex((item) => item.id === node.id);
    const subColumn = Math.floor(index / 6);
    const row = index % 6;
    return {
      ...node,
      x: (levelStart.get(level) ?? 70) + subColumn * 290,
      y: 80 + row * 180,
    };
  });
}

export function getStrategyCanvasSize(nodes: StrategyNode[]) {
  return {
    width: Math.max(1200, ...nodes.map((node) => node.x + 330)),
    height: Math.max(760, ...nodes.map((node) => node.y + 250)),
  };
}

function countCycles(nodes: StrategyNode[], edges: StrategyEdge[]) {
  const adjacency = new Map<string, string[]>();
  nodes.forEach((node) => adjacency.set(node.id, []));
  edges.forEach((edge) => adjacency.get(edge.source)?.push(edge.target));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  let cycles = 0;

  function walk(id: string) {
    if (visiting.has(id)) {
      cycles += 1;
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    (adjacency.get(id) ?? []).forEach(walk);
    visiting.delete(id);
    visited.add(id);
  }

  nodes.forEach((node) => walk(node.id));
  return cycles;
}

function calculateCriticalPath(nodes: StrategyNode[], edges: StrategyEdge[]) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  const distance = new Map<string, number>();
  nodes.forEach((node) => {
    incoming.set(node.id, 0);
    outgoing.set(node.id, []);
    distance.set(node.id, node.duration);
  });
  edges.forEach((edge) => {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  });
  const queue = nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
  let seen = 0;
  while (queue.length) {
    const current = queue.shift()!;
    seen += 1;
    for (const next of outgoing.get(current) ?? []) {
      const currentNode = nodeById.get(current);
      const nextNode = nodeById.get(next);
      if (currentNode && nextNode) {
        distance.set(
          next,
          Math.max(
            distance.get(next) ?? nextNode.duration,
            (distance.get(current) ?? currentNode.duration) + nextNode.duration,
          ),
        );
      }
      incoming.set(next, (incoming.get(next) ?? 1) - 1);
      if (incoming.get(next) === 0) queue.push(next);
    }
  }
  if (seen !== nodes.length) return nodes.reduce((sum, node) => sum + node.duration, 0);
  return Math.max(0, ...distance.values());
}

export function auditStrategy(
  nodes: StrategyNode[],
  edges: StrategyEdge[],
  rubric: AuditRubric = DEFAULT_RUBRIC,
): AuditResult {
  if (!nodes.length) {
    return {
      score: 0,
      optimality: 0,
      timeEfficiency: 0,
      success: 0,
      effortReturn: 0,
      criticalPathHours: 0,
      totalEffort: 0,
      parallelTracks: 0,
      cycleCount: 0,
      headline: "Tambahkan simpul untuk memulai audit.",
      insights: ["Peta belum memiliki langkah yang dapat dinilai."],
      calculatedAt: new Date().toISOString(),
    };
  }

  const cycleCount = countCycles(nodes, edges);
  const criticalPathHours = calculateCriticalPath(nodes, edges);
  const totalEffort = nodes.reduce((sum, node) => sum + node.effort, 0);
  const meanConfidence =
    nodes.reduce((sum, node) => sum + node.confidence, 0) / nodes.length;
  const meanImpact = nodes.reduce((sum, node) => sum + node.impact, 0) / nodes.length;
  const isolated = nodes.filter(
    (node) =>
      !edges.some((edge) => edge.source === node.id || edge.target === node.id),
  ).length;
  const roots = nodes.filter(
    (node) => !edges.some((edge) => edge.target === node.id),
  ).length;
  const sinks = nodes.filter(
    (node) => !edges.some((edge) => edge.source === node.id),
  ).length;
  const graphDensity = edges.length / Math.max(1, nodes.length - 1);
  const horizonHours = Math.max(8, rubric.horizonDays * 1.2);
  const timeLoad = criticalPathHours / horizonHours;
  const meanEffort = totalEffort / nodes.length;
  const returnRatio =
    nodes.reduce((sum, node) => sum + node.impact * node.confidence / 100, 0) /
    Math.max(totalEffort, 1);
  const isolatedRatio = isolated / nodes.length;
  const rootRatio = roots / nodes.length;
  const sinkRatio = sinks / nodes.length;
  const cycleRatio = cycleCount / nodes.length;

  const optimality = clamp(
    93 -
      cycleRatio * 100 -
      isolatedRatio * 52 -
      Math.abs(1.35 - graphDensity) * 9,
  );
  const timeEfficiency = clamp(
    96 - Math.max(0, timeLoad - 0.78) * 70 - Math.max(0, rootRatio - 0.32) * 18,
  );
  const success = clamp(
    meanConfidence * 0.72 +
      meanImpact * 2.4 -
      cycleRatio * 80 -
      Math.max(0, sinkRatio - 0.24) * 22,
  );
  const effortReturn = clamp(
    42 + returnRatio * 15 - Math.max(0, meanEffort - 7) * 4,
  );
  const weights = rubric.weights;
  const weightTotal = Math.max(
    0.0001,
    weights.optimality +
      weights.timeEfficiency +
      weights.success +
      weights.effortReturn,
  );
  const score = Math.round(
    (optimality * weights.optimality +
      timeEfficiency * weights.timeEfficiency +
      success * weights.success +
      effortReturn * weights.effortReturn) /
      weightTotal,
  );

  const insights: string[] = [];
  if (cycleCount) {
    insights.push(
      `${cycleCount} dependensi melingkar terdeteksi; putus siklus agar urutan dapat dijalankan.`,
    );
  }
  if (isolated) {
    insights.push(
      `${isolated} simpul belum terhubung dan belum berkontribusi pada jalur hasil.`,
    );
  }
  if (timeLoad > 0.9) {
    insights.push(
      "Jalur kritis terlalu dekat dengan batas waktu; beri buffer atau jalankan tugas secara paralel.",
    );
  }
  const weakest = [...nodes].sort((a, b) => a.confidence - b.confidence)[0];
  if (weakest && weakest.confidence < 70) {
    insights.push(
      `“${weakest.title}” adalah titik paling rapuh (${weakest.confidence}% keyakinan); tambahkan mitigasi atau bukti.`,
    );
  }
  const highestLeverage = [...nodes].sort(
    (a, b) => b.impact / Math.max(b.effort, 1) - a.impact / Math.max(a.effort, 1),
  )[0];
  if (highestLeverage) {
    insights.push(
      `Pertahankan “${highestLeverage.title}”: dampaknya paling tinggi dibanding effort.`,
    );
  }
  if (!insights.length) {
    insights.push("Struktur dapat dijalankan; fokus berikutnya adalah memperkuat bukti dan buffer.");
  }

  return {
    score,
    optimality: Math.round(optimality),
    timeEfficiency: Math.round(timeEfficiency),
    success: Math.round(success),
    effortReturn: Math.round(effortReturn),
    criticalPathHours: Math.round(criticalPathHours * 10) / 10,
    totalEffort,
    parallelTracks: Math.max(1, roots),
    cycleCount,
    headline:
      score >= 85
        ? "Strategi kuat dan siap dijalankan."
        : score >= 70
          ? "Strategi layak, dengan beberapa titik ungkit."
          : "Struktur perlu diperbaiki sebelum dieksekusi.",
    insights: insights.slice(0, 4),
    calculatedAt: new Date().toISOString(),
  };
}

export function normalizeStrategy(
  input: Partial<StrategyDocument>,
  prompt: string,
  kind: PlanKind,
  options: { arrange?: boolean } = {},
): StrategyDocument {
  const now = new Date().toISOString();
  const rawNodes = (input.nodes ?? []).map((node, index) => {
    const normalized = {
      ...node,
      id: node.id || `node-${index + 1}`,
      title: node.title || `Langkah ${index + 1}`,
      detail: node.detail || "Jelaskan hasil konkret dari langkah ini.",
      kind: node.kind || "task",
      x: Number.isFinite(node.x) ? Math.max(16, Number(node.x)) : 120 + (index % 3) * 310,
      y: Number.isFinite(node.y) ? Math.max(16, Number(node.y)) : 100 + Math.floor(index / 3) * 190,
      duration: Math.max(0, Number(node.duration) || 0),
      effort: clamp(Number(node.effort) || 1, 1, 10),
      impact: clamp(Number(node.impact) || 1, 1, 10),
      confidence: clamp(Number(node.confidence) || 0),
      status: node.status,
    } as StrategyNode;
    return { ...normalized, status: normalized.status || deriveNodeStatus(normalized) };
  });
  const nodes = options.arrange ? arrangeStrategyNodes(rawNodes, input.edges ?? []) : rawNodes;
  const ids = new Set(nodes.map((node) => node.id));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = (input.edges ?? [])
    .filter(
      (edge) => ids.has(edge.source) && ids.has(edge.target) && edge.source !== edge.target,
    )
    .map((edge, index) => {
      const inferred = inferEdgeRelation(
        nodeById.get(edge.source)!,
        nodeById.get(edge.target)!,
      );
      return {
        ...edge,
        id: edge.id || `edge-${index + 1}`,
        relation: edge.relation || inferred.relation,
        label: edge.label?.trim() || inferred.label,
      };
    }) as StrategyEdge[];
  return {
    id: input.id ?? `strategy-${Date.now()}`,
    title: input.title ?? "Strategi baru",
    prompt,
    kind,
    nodes,
    edges,
    sources: input.sources ?? [],
    rubric: input.rubric ?? DEFAULT_RUBRIC,
    createdAt: input.createdAt ?? now,
  };
}
