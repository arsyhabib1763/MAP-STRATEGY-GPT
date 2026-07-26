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
    `Audit dihitung ${new Date(audit.calculatedAt).toLocaleString("id-ID")}. PDF menyertakan input lengkap, semua tile peta, dan sumber.`,
    MARGIN,
    270,
  );
}

function intersectsEdgeTile(source, target, tile) {
  const minX = Math.min(source.x, target.x);
  const maxX = Math.max(source.x, target.x) + 228;
  const minY = Math.min(source.y, target.y);
  const maxY = Math.max(source.y, target.y) + 144;
  return !(
    maxX < tile.x ||
    minX > tile.x + tile.width ||
    maxY < tile.y ||
    minY > tile.y + tile.height
  );
}

function addMapPages(doc, strategy) {
  const nodeById = new Map(strategy.nodes.map((node) => [node.id, node]));
  const maxX = Math.max(1200, ...strategy.nodes.map((node) => node.x + 270));
  const maxY = Math.max(760, ...strategy.nodes.map((node) => node.y + 190));
  const tileWidth = 1150;
  const tileHeight = 690;
  const columns = Math.max(1, Math.ceil(maxX / tileWidth));
  const rows = Math.max(1, Math.ceil(maxY / tileHeight));
  let mapPage = 0;
  const mapPages = columns * rows;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      mapPage += 1;
      const tile = {
        x: column * tileWidth,
        y: row * tileHeight,
        width: tileWidth,
        height: tileHeight,
      };
      doc.addPage([PAGE_WIDTH, PAGE_HEIGHT], "landscape");
      sectionTitle(
        doc,
        `Strategy map - area ${mapPage}/${mapPages}`,
        `Kolom ${column + 1}/${columns}, baris ${row + 1}/${rows}`,
        18,
      );
      const mapTop = 33;
      const mapHeight = PAGE_HEIGHT - mapTop - 18;
      const scale = Math.min(CONTENT_WIDTH / tileWidth, mapHeight / tileHeight);
      const tx = (x) => MARGIN + (x - tile.x) * scale;
      const ty = (y) => mapTop + (y - tile.y) * scale;

      strategy.edges.forEach((edge) => {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target || !intersectsEdgeTile(source, target, tile)) return;
        const relationColor = RELATION_COLORS[edge.relation] || COLORS.muted;
        setColor(doc, relationColor, "draw");
        doc.setLineWidth(0.65);
        const x1 = tx(source.x + 228);
        const y1 = ty(source.y + 72);
        const x2 = tx(target.x);
        const y2 = ty(target.y + 72);
        doc.line(x1, y1, x2, y2);
        setColor(doc, relationColor, "fill");
        doc.circle(x2, y2, 1.5, "F");

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        if (
          midX > MARGIN + 16 &&
          midX < PAGE_WIDTH - MARGIN - 16 &&
          midY > mapTop + 6 &&
          midY < PAGE_HEIGHT - 14
        ) {
          const label = ascii(edge.label).slice(0, 54);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(5.6);
          const width = Math.min(58, Math.max(24, doc.getTextWidth(label) + 5));
          setColor(doc, [255, 255, 255], "fill");
          setColor(doc, relationColor, "draw");
          doc.roundedRect(midX - width / 2, midY - 4.2, width, 8, 2, 2, "FD");
          setColor(doc, relationColor);
          doc.text(label, midX, midY + 0.5, { align: "center" });
        }
      });

      strategy.nodes.forEach((node) => {
        const centerX = node.x + 114;
        const centerY = node.y + 72;
        if (
          centerX < tile.x ||
          centerX >= tile.x + tile.width ||
          centerY < tile.y ||
          centerY >= tile.y + tile.height
        ) {
          return;
        }
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
        setColor(doc, node.kind === "goal" ? COLORS.ink : node.kind === "risk" ? [255, 246, 241] : [255, 255, 255], "fill");
        setColor(doc, COLORS.line, "draw");
        doc.roundedRect(x, y, width, height, 2.5, 2.5, "FD");
        setColor(doc, accent, "fill");
        doc.rect(x, y, width, Math.max(1.5, 4 * scale), "F");
        setColor(doc, node.kind === "goal" ? COLORS.signal : COLORS.muted);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        doc.text(KIND_LABELS[node.kind] || "SIMPUL", x + 4, y + 8);
        setColor(doc, node.kind === "goal" ? [255, 255, 255] : COLORS.ink);
        doc.setFontSize(9);
        const title = doc.splitTextToSize(ascii(node.title), width - 8).slice(0, 2);
        doc.text(title, x + 4, y + 17);
        setColor(doc, node.kind === "goal" ? [185, 187, 195] : COLORS.muted);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);
        const detail = doc.splitTextToSize(ascii(node.detail), width - 8).slice(0, 3);
        doc.text(detail, x + 4, y + 31);
        setColor(doc, node.kind === "goal" ? [185, 187, 195] : COLORS.muted);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.text(
          `${node.duration}j | effort ${node.effort} | dampak ${node.impact} | yakin ${node.confidence}%`,
          x + 4,
          y + height - 5,
        );
      });
    }
  }
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
    setColor(doc, COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text("SIMPUL - AI Strategy Studio", MARGIN, PAGE_HEIGHT - 7);
    doc.text(`Halaman ${page}/${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 7, {
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
  addMapPages(doc, strategy);
  addSourcesPage(doc, strategy.sources);
  addFooters(doc);
  return doc;
}

export async function downloadStrategyPdf(strategy, audit) {
  const doc = createStrategyPdf(strategy, audit);
  doc.save(`simpul-${slug(strategy.title)}.pdf`);
}
