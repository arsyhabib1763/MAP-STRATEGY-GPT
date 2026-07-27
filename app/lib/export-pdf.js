import { jsPDF } from "jspdf";

const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 297;
const MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const COLORS = {
  ink: [25, 27, 35],
  paper: [250, 249, 245],
  muted: [103, 101, 95],
  line: [214, 210, 201],
  signal: [167, 239, 97],
  blue: [90, 114, 255],
  orange: [239, 156, 76],
  red: [215, 91, 72],
  purple: [167, 111, 221],
};

const RELATION_COLORS = {
  dependency: [92, 98, 115],
  sequence: COLORS.blue,
  enabler: [76, 155, 105],
  validation: COLORS.purple,
  risk_control: COLORS.red,
  contribution: COLORS.orange,
};

const KIND_LABELS = {
  goal: "HASIL",
  milestone: "MILESTONE",
  task: "TUGAS",
  decision: "KEPUTUSAN",
  risk: "RISIKO",
};

function ascii(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function slug(value) {
  return (
    ascii(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "strategy-map"
  );
}

function setColor(doc, color, target = "text") {
  if (target === "fill") doc.setFillColor(...color);
  else if (target === "draw") doc.setDrawColor(...color);
  else doc.setTextColor(...color);
}

function sectionTitle(doc, title, subtitle, y) {
  setColor(doc, COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(ascii(title), MARGIN, y);
  if (subtitle) {
    setColor(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(ascii(subtitle), MARGIN, y + 6);
  }
}

function addMetric(doc, x, y, width, label, value, color) {
  setColor(doc, [255, 255, 255], "fill");
  setColor(doc, COLORS.line, "draw");
  doc.roundedRect(x, y, width, 28, 3, 3, "FD");
  setColor(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(ascii(label).toUpperCase(), x + 6, y + 8);
  setColor(doc, COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(String(Math.round(Number(value) || 0)), x + 6, y + 20);
  setColor(doc, [236, 233, 226], "fill");
  doc.roundedRect(x + 27, y + 17, width - 34, 3, 1.5, 1.5, "F");
  setColor(doc, color, "fill");
  doc.roundedRect(
    x + 27,
    y + 17,
    Math.max(1, (width - 34) * Math.min(100, Math.max(0, Number(value) || 0)) / 100),
    3,
    1.5,
    1.5,
    "F",
  );
}

function addTextPages(doc, title, text) {
  const lines = doc.splitTextToSize(ascii(text), CONTENT_WIDTH);
  const linesPerPage = 42;
  for (let offset = 0; offset < lines.length; offset += linesPerPage) {
    doc.addPage([PAGE_WIDTH, PAGE_HEIGHT], "landscape");
    sectionTitle(
      doc,
      title,
      `Bagian ${Math.floor(offset / linesPerPage) + 1} - teks lengkap tanpa pemotongan`,
      22,
    );
    setColor(doc, COLORS.ink);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setLineHeightFactor(1.55);
    doc.text(lines.slice(offset, offset + linesPerPage), MARGIN, 42);
  }
}

function addSummaryPage(doc, strategy, audit) {
  setColor(doc, COLORS.paper, "fill");
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");
  setColor(doc, COLORS.ink, "fill");
  doc.rect(0, 0, PAGE_WIDTH, 68, "F");
  setColor(doc, COLORS.signal, "fill");
  doc.rect(MARGIN, 17, 8, 8, "F");
  setColor(doc, [255, 255, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("SIMPUL - STRATEGY MAP & AUDIT", MARGIN + 13, 23);
  doc.setFontSize(25);
  const titleLines = doc.splitTextToSize(ascii(strategy.title), 260).slice(0, 2);
  doc.text(titleLines, MARGIN, 40);
  setColor(doc, [183, 185, 191]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `${strategy.nodes.length} simpul  |  ${strategy.edges.length} hubungan  |  ${ascii(strategy.kind).toUpperCase()}`,
    MARGIN,
    59,
  );

  setColor(doc, COLORS.ink, "fill");
  doc.circle(355, 108, 25, "F");
  setColor(doc, COLORS.signal);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(25);
  doc.text(String(Math.round(audit.score)), 355, 106, { align: "center" });
  setColor(doc, [255, 255, 255]);
  doc.setFontSize(7);
  doc.text("SKOR AUDIT", 355, 116, { align: "center" });

  sectionTitle(doc, "Audit strategi terakhir", ascii(audit.headline), 88);
  const metricWidth = 76;
  addMetric(doc, MARGIN, 113, metricWidth, "Optimalitas", audit.optimality, COLORS.signal);
  addMetric(doc, MARGIN + 82, 113, metricWidth, "Efisiensi waktu", audit.timeEfficiency, COLORS.blue);
  addMetric(doc, MARGIN + 164, 113, metricWidth, "Peluang berhasil", audit.success, COLORS.orange);
  addMetric(doc, MARGIN + 246, 113, metricWidth, "Effort / hasil", audit.effortReturn, COLORS.purple);

  setColor(doc, [255, 255, 255], "fill");
  setColor(doc, COLORS.line, "draw");
  doc.roundedRect(MARGIN, 151, 220, 92, 3, 3, "FD");
  setColor(doc, COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Titik ungkit dan koreksi", MARGIN + 7, 164);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  let insightY = 176;
  (audit.insights ?? []).slice(0, 5).forEach((insight, index) => {
    setColor(doc, COLORS.signal, "fill");
    doc.circle(MARGIN + 9, insightY - 2, 3.4, "F");
    setColor(doc, COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.text(String(index + 1), MARGIN + 9, insightY - 0.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(ascii(insight), 195).slice(0, 2);
    doc.text(lines, MARGIN + 17, insightY);
    insightY += 16;
  });

  setColor(doc, [255, 255, 255], "fill");
  setColor(doc, COLORS.line, "draw");
  doc.roundedRect(250, 151, 152, 92, 3, 3, "FD");
  setColor(doc, COLORS.ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Ringkasan mesin", 257, 164);
  const facts = [
    ["Jalur kritis", `${audit.criticalPathHours} jam`],
    ["Total effort", `${audit.totalEffort} poin`],
    ["Jalur paralel", String(audit.parallelTracks)],
    ["Siklus terdeteksi", String(audit.cycleCount)],
  ];
  facts.forEach(([label, value], index) => {
    const y = 180 + index * 14;
    setColor(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(label, 257, y);
    setColor(doc, COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.text(value, 393, y, { align: "right" });
  });

  setColor(doc, COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    `Audit dihitung ${new Date(audit.calculatedAt).toLocaleString("id-ID")}. PDF menyertakan input lengkap, satu halaman poster peta, dan sumber.`,
    MARGIN,
    270,
  );
}

function orthogonalPoints(source, target) {
  const sourceCenterX = source.x + 114;
  const sourceCenterY = source.y + 72;
  const targetCenterX = target.x + 114;
  const targetCenterY = target.y + 72;
  const horizontalDistance = Math.abs(targetCenterX - sourceCenterX);
  const verticalDistance = Math.abs(targetCenterY - sourceCenterY);
  if (horizontalDistance >= verticalDistance * 0.72) {
    const movingRight = targetCenterX >= sourceCenterX;
    const x1 = movingRight ? source.x + 228 : source.x;
    const x2 = movingRight ? target.x : target.x + 228;
    const middleX = (x1 + x2) / 2;
    return [
      { x: x1, y: sourceCenterY },
      { x: middleX, y: sourceCenterY },
      { x: middleX, y: targetCenterY },
      { x: x2, y: targetCenterY },
    ];
  }
  const movingDown = targetCenterY >= sourceCenterY;
  const y1 = movingDown ? source.y + 144 : source.y;
  const y2 = movingDown ? target.y : target.y + 144;
  const middleY = (y1 + y2) / 2;
  return [
    { x: sourceCenterX, y: y1 },
    { x: sourceCenterX, y: middleY },
    { x: targetCenterX, y: middleY },
    { x: targetCenterX, y: y2 },
  ];
}

function addMapPosterPage(doc, strategy, audit) {
  const nodeById = new Map(strategy.nodes.map((node) => [node.id, node]));
  const minX = Math.min(...strategy.nodes.map((node) => node.x), 0);
  const minY = Math.min(...strategy.nodes.map((node) => node.y), 0);
  const maxX = Math.max(...strategy.nodes.map((node) => node.x + 228), 1200);
  const maxY = Math.max(...strategy.nodes.map((node) => node.y + 144), 760);
  const mapWidth = maxX - minX;
  const mapHeight = maxY - minY;
  const useA0 = strategy.nodes.length > 48 || mapWidth > 4200 || mapHeight > 2800;
  const posterWidth = useA0 ? 1189 : 841;
  const posterHeight = useA0 ? 841 : 594;
  const posterMargin = useA0 ? 24 : 18;
  const headerHeight = useA0 ? 62 : 48;
  doc.addPage([posterWidth, posterHeight], "landscape");
  setColor(doc, COLORS.paper, "fill");
  doc.rect(0, 0, posterWidth, posterHeight, "F");
  setColor(doc, COLORS.ink, "fill");
  doc.rect(0, 0, posterWidth, headerHeight, "F");
  setColor(doc, COLORS.signal, "fill");
  doc.rect(posterMargin, 13, 7, 7, "F");
  setColor(doc, [255, 255, 255]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(useA0 ? 24 : 18);
  doc.text(ascii(strategy.title), posterMargin + 13, useA0 ? 23 : 20);
  setColor(doc, [184, 186, 194]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(useA0 ? 11 : 8.5);
  doc.text(
    `${strategy.nodes.length} simpul | ${strategy.edges.length} hubungan | skor audit ${Math.round(audit.score)}/100 | poster ${useA0 ? "A0" : "A1"}`,
    posterMargin + 13,
    useA0 ? 42 : 35,
  );

  const mapTop = headerHeight + posterMargin;
  const mapBottom = posterHeight - posterMargin;
  const availableWidth = posterWidth - posterMargin * 2;
  const availableHeight = mapBottom - mapTop;
  const scale = Math.min(availableWidth / mapWidth, availableHeight / mapHeight);
  const renderedWidth = mapWidth * scale;
  const renderedHeight = mapHeight * scale;
  const originX = posterMargin + (availableWidth - renderedWidth) / 2;
  const originY = mapTop + (availableHeight - renderedHeight) / 2;
  const tx = (x) => originX + (x - minX) * scale;
  const ty = (y) => originY + (y - minY) * scale;

  strategy.edges.forEach((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return;
    const relationColor = RELATION_COLORS[edge.relation] || COLORS.muted;
    const points = orthogonalPoints(source, target);
    const start = { x: tx(points[0].x), y: ty(points[0].y) };
    const vectors = points.slice(1).map((point, index) => ({
      x: tx(point.x) - tx(points[index].x),
      y: ty(point.y) - ty(points[index].y),
    }));
    setColor(doc, relationColor, "draw");
    doc.setLineWidth(Math.max(0.45, 1.5 * scale));
    doc.setLineJoin("round");
    doc.setLineCap("round");
    doc.lines(
      vectors.map((vector) => [vector.x, vector.y]),
      start.x,
      start.y,
      [1, 1],
      "S",
      false,
    );
    const end = points.at(-1);
    setColor(doc, relationColor, "fill");
    doc.circle(tx(end.x), ty(end.y), Math.max(0.8, 2.5 * scale), "F");

    const label = ascii(edge.label).slice(0, 66);
    const labelX = tx((points[1].x + points[2].x) / 2);
    const labelY = ty((points[1].y + points[2].y) / 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(4.2, Math.min(8, 14 * scale)));
    const labelWidth = Math.min(95, Math.max(22, doc.getTextWidth(label) + 5));
    setColor(doc, [255, 255, 255], "fill");
    setColor(doc, relationColor, "draw");
    doc.roundedRect(
      labelX - labelWidth / 2,
      labelY - 3.8,
      labelWidth,
      7.6,
      1.8,
      1.8,
      "FD",
    );
    setColor(doc, relationColor);
    doc.text(label, labelX, labelY + 1.2, { align: "center" });
  });

  strategy.nodes.forEach((node) => {
    const x = tx(node.x);
    const y = ty(node.y);
    const width = 228 * scale;
    const height = 144 * scale;
    const accent =
      node.kind === "goal"
        ? COLORS.signal
        : node.kind === "risk"
          ? COLORS.red
          : node.kind === "decision"
            ? COLORS.orange
            : node.kind === "milestone"
              ? COLORS.blue
              : [125, 134, 157];
    setColor(
      doc,
      node.kind === "goal"
        ? COLORS.ink
        : node.kind === "risk"
          ? [255, 246, 241]
          : [255, 255, 255],
      "fill",
    );
    setColor(doc, COLORS.line, "draw");
    doc.roundedRect(x, y, width, height, 2.5, 2.5, "FD");
    setColor(doc, accent, "fill");
    doc.rect(x, y, width, Math.max(1.1, 4 * scale), "F");
    setColor(doc, node.kind === "goal" ? COLORS.signal : accent);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(4.2, Math.min(7, 11 * scale)));
    doc.text(KIND_LABELS[node.kind] || "SIMPUL", x + 4 * scale, y + 14 * scale);
    setColor(doc, node.kind === "goal" ? [255, 255, 255] : COLORS.ink);
    doc.setFontSize(Math.max(5.2, Math.min(10, 16 * scale)));
    const title = doc
      .splitTextToSize(ascii(node.title), Math.max(18, width - 8 * scale))
      .slice(0, 2);
    doc.text(title, x + 4 * scale, y + 34 * scale);
    setColor(doc, node.kind === "goal" ? [185, 187, 195] : COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(Math.max(4, Math.min(7, 10 * scale)));
    const detail = doc
      .splitTextToSize(ascii(node.detail), Math.max(18, width - 8 * scale))
      .slice(0, 3);
    doc.text(detail, x + 4 * scale, y + 75 * scale);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(3.8, Math.min(6, 9 * scale)));
    doc.text(
      `${node.duration}j | E${node.effort} | D${node.impact} | ${node.confidence}%`,
      x + 4 * scale,
      y + height - 7 * scale,
    );
  });
}

function addSourcesPage(doc, sources) {
  if (!sources?.length) return;
  doc.addPage([PAGE_WIDTH, PAGE_HEIGHT], "landscape");
  sectionTitle(doc, "Sumber riset", `${sources.length} referensi yang digunakan Thinking Agent`, 22);
  let y = 43;
  sources.forEach((source, index) => {
    if (y > PAGE_HEIGHT - 24) {
      doc.addPage([PAGE_WIDTH, PAGE_HEIGHT], "landscape");
      sectionTitle(doc, "Sumber riset - lanjutan", "", 22);
      y = 43;
    }
    setColor(doc, COLORS.signal, "fill");
    doc.circle(MARGIN + 4, y - 2, 3.5, "F");
    setColor(doc, COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`${index + 1}. ${ascii(source.title)}`, MARGIN + 11, y);
    setColor(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(ascii(source.url), MARGIN + 11, y + 6);
    y += 18;
  });
}

function addFooters(doc) {
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    setColor(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text("SIMPUL - AI Strategy Studio", MARGIN, pageHeight - 7);
    doc.text(`Halaman ${page}/${pageCount}`, pageWidth - MARGIN, pageHeight - 7, {
      align: "right",
    });
  }
}

export function createStrategyPdf(strategy, audit) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [PAGE_WIDTH, PAGE_HEIGHT],
    compress: true,
  });
  doc.setProperties({
    title: ascii(strategy.title),
    subject: "Strategy map dan audit terakhir",
    author: "SIMPUL - AI Strategy Studio",
    creator: "SIMPUL",
  });
  addSummaryPage(doc, strategy, audit);
  if (strategy.prompt) addTextPages(doc, "Input strategi lengkap", strategy.prompt);
  addMapPosterPage(doc, strategy, audit);
  addSourcesPage(doc, strategy.sources);
  addFooters(doc);
  return doc;
}

export async function downloadStrategyPdf(strategy, audit) {
  const doc = createStrategyPdf(strategy, audit);
  doc.save(`simpul-${slug(strategy.title)}.pdf`);
}
