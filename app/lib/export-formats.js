import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const NODE_WIDTH = 228;
const NODE_HEIGHT = 144;
const POSTER_MARGIN = 80;
const POSTER_HEADER = 210;
const COLORS = {
  ink: "#171923",
  paper: "#F7F4EC",
  line: "#D4CFC4",
  muted: "#716E66",
  signal: "#B8F250",
  blue: "#5A72FF",
  orange: "#D8873F",
  purple: "#9B68C8",
  red: "#CE594B",
};
const RELATION_COLORS = {
  dependency: "#7C7F89",
  sequence: COLORS.blue,
  enabler: "#4C9B69",
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

function slug(text) {
  return (
    String(text || "strategi")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "strategi"
  );
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(text, maxCharacters, maxLines) {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxCharacters || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.join(" ").length > lines.join(" ").length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, -1)}…`;
  }
  return lines;
}

function roundedOrthogonalGeometry(source, target) {
  const sourceCenterX = source.x + NODE_WIDTH / 2;
  const sourceCenterY = source.y + NODE_HEIGHT / 2;
  const targetCenterX = target.x + NODE_WIDTH / 2;
  const targetCenterY = target.y + NODE_HEIGHT / 2;
  const horizontalDistance = Math.abs(targetCenterX - sourceCenterX);
  const verticalDistance = Math.abs(targetCenterY - sourceCenterY);
  let points;
  if (horizontalDistance >= verticalDistance * 0.72) {
    const movingRight = targetCenterX >= sourceCenterX;
    const x1 = movingRight ? source.x + NODE_WIDTH : source.x;
    const x2 = movingRight ? target.x : target.x + NODE_WIDTH;
    const middleX = (x1 + x2) / 2;
    points = [
      { x: x1, y: sourceCenterY },
      { x: middleX, y: sourceCenterY },
      { x: middleX, y: targetCenterY },
      { x: x2, y: targetCenterY },
    ];
  } else {
    const movingDown = targetCenterY >= sourceCenterY;
    const y1 = movingDown ? source.y + NODE_HEIGHT : source.y;
    const y2 = movingDown ? target.y : target.y + NODE_HEIGHT;
    const middleY = (y1 + y2) / 2;
    points = [
      { x: sourceCenterX, y: y1 },
      { x: sourceCenterX, y: middleY },
      { x: targetCenterX, y: middleY },
      { x: targetCenterX, y: y2 },
    ];
  }
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const previousLength = Math.hypot(
      current.x - previous.x,
      current.y - previous.y,
    );
    const nextLength = Math.hypot(next.x - current.x, next.y - current.y);
    const radius = Math.min(16, previousLength / 2, nextLength / 2);
    const before = {
      x: current.x - ((current.x - previous.x) / Math.max(1, previousLength)) * radius,
      y: current.y - ((current.y - previous.y) / Math.max(1, previousLength)) * radius,
    };
    const after = {
      x: current.x + ((next.x - current.x) / Math.max(1, nextLength)) * radius,
      y: current.y + ((next.y - current.y) / Math.max(1, nextLength)) * radius,
    };
    path += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`;
  }
  path += ` L ${points.at(-1).x} ${points.at(-1).y}`;
  return {
    path,
    points,
    labelX: (points[1].x + points[2].x) / 2,
    labelY: (points[1].y + points[2].y) / 2,
  };
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createStrategySvg(strategy, audit) {
  const minX = Math.min(...strategy.nodes.map((node) => node.x), 0);
  const minY = Math.min(...strategy.nodes.map((node) => node.y), 0);
  const maxX = Math.max(...strategy.nodes.map((node) => node.x + NODE_WIDTH), 1200);
  const maxY = Math.max(...strategy.nodes.map((node) => node.y + NODE_HEIGHT), 760);
  const mapWidth = maxX - minX;
  const mapHeight = maxY - minY;
  const width = Math.max(1500, mapWidth + POSTER_MARGIN * 2);
  const height = Math.max(1000, mapHeight + POSTER_MARGIN * 2 + POSTER_HEADER);
  const offsetX = POSTER_MARGIN - minX;
  const offsetY = POSTER_MARGIN + POSTER_HEADER - minY;
  const nodeById = new Map(strategy.nodes.map((node) => [node.id, node]));
  const edgeMarkup = strategy.edges
    .map((edge) => {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) return "";
      const geometry = roundedOrthogonalGeometry(source, target);
      const color = RELATION_COLORS[edge.relation] || COLORS.muted;
      const label = escapeXml(edge.label);
      const labelWidth = Math.min(320, Math.max(120, String(edge.label).length * 7));
      const targetPoint = geometry.points.at(-1);
      return `<g transform="translate(${offsetX} ${offsetY})">
        <path d="${geometry.path}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${targetPoint.x}" cy="${targetPoint.y}" r="5" fill="${color}"/>
        <g transform="translate(${geometry.labelX} ${geometry.labelY})">
          <rect x="${-labelWidth / 2}" y="-17" width="${labelWidth}" height="34" rx="12" fill="#FFFFFF" stroke="${color}" stroke-width="1.5"/>
          <text x="0" y="5" text-anchor="middle" font-size="13" font-weight="700" fill="${color}">${label}</text>
        </g>
      </g>`;
    })
    .join("");
  const nodeMarkup = strategy.nodes
    .map((node) => {
      const accent =
        node.kind === "goal"
          ? COLORS.signal
          : node.kind === "risk"
            ? COLORS.red
            : node.kind === "decision"
              ? COLORS.orange
              : node.kind === "milestone"
                ? COLORS.blue
                : "#7D869D";
      const fill = node.kind === "goal" ? COLORS.ink : node.kind === "risk" ? "#FFF6F1" : "#FFFFFF";
      const textColor = node.kind === "goal" ? "#FFFFFF" : COLORS.ink;
      const secondary = node.kind === "goal" ? "#C3C5CC" : COLORS.muted;
      const titleLines = wrapText(node.title, 25, 2);
      const detailLines = wrapText(node.detail, 38, 3);
      return `<g transform="translate(${node.x + offsetX} ${node.y + offsetY})">
        <rect width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="13" fill="${fill}" stroke="${COLORS.line}" stroke-width="2"/>
        <path d="M13 0 H215 Q228 0 228 13 V6 H0 V13 Q0 0 13 0" fill="${accent}"/>
        <text x="16" y="24" font-size="11" font-weight="800" letter-spacing="1.4" fill="${node.kind === "goal" ? COLORS.signal : accent}">${KIND_LABELS[node.kind] || "SIMPUL"}</text>
        ${titleLines.map((line, index) => `<text x="16" y="${48 + index * 18}" font-size="16" font-weight="800" fill="${textColor}">${escapeXml(line)}</text>`).join("")}
        ${detailLines.map((line, index) => `<text x="16" y="${88 + index * 14}" font-size="11" fill="${secondary}">${escapeXml(line)}</text>`).join("")}
        <text x="16" y="132" font-size="9.5" font-weight="700" fill="${secondary}">${node.duration}j · effort ${node.effort} · dampak ${node.impact} · yakin ${node.confidence}%</text>
      </g>`;
    })
    .join("");
  const metrics = [
    ["SKOR", audit.score, COLORS.signal],
    ["OPTIMAL", audit.optimality, COLORS.signal],
    ["WAKTU", audit.timeEfficiency, COLORS.blue],
    ["BERHASIL", audit.success, COLORS.orange],
    ["EFFORT/HASIL", audit.effortReturn, COLORS.purple],
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(strategy.title)}</title>
  <desc id="desc">Strategy map dengan ${strategy.nodes.length} simpul, ${strategy.edges.length} hubungan, dan audit terakhir.</desc>
  <rect width="100%" height="100%" fill="${COLORS.paper}"/>
  <rect width="100%" height="${POSTER_HEADER}" fill="${COLORS.ink}"/>
  <rect x="${POSTER_MARGIN}" y="42" width="13" height="13" fill="${COLORS.signal}"/>
  <text x="${POSTER_MARGIN + 24}" y="54" font-family="Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="2" fill="#FFFFFF">SIMPUL · STRATEGY POSTER</text>
  <text x="${POSTER_MARGIN}" y="105" font-family="Arial, sans-serif" font-size="38" font-weight="800" fill="#FFFFFF">${escapeXml(strategy.title)}</text>
  <text x="${POSTER_MARGIN}" y="138" font-family="Arial, sans-serif" font-size="15" fill="#B7B9C0">${strategy.nodes.length} simpul · ${strategy.edges.length} hubungan · ${escapeXml(audit.headline)}</text>
  ${metrics.map(([label, value, color], index) => `<g transform="translate(${POSTER_MARGIN + index * 166} 161)"><text x="0" y="0" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="#9FA1A9">${label}</text><text x="82" y="0" font-family="Arial, sans-serif" font-size="20" font-weight="800" fill="${color}">${Math.round(Number(value) || 0)}</text></g>`).join("")}
  <g font-family="Arial, sans-serif">${edgeMarkup}${nodeMarkup}</g>
</svg>`;
}

export function downloadStrategySvg(strategy, audit) {
  const svg = createStrategySvg(strategy, audit);
  triggerDownload(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    `simpul-${slug(strategy.title)}-poster.svg`,
  );
}

export function downloadStrategyJson(strategy, audit) {
  const json = JSON.stringify(
    {
      format: "SIMPUL Strategy Document",
      version: 1,
      exportedAt: new Date().toISOString(),
      strategy,
      lastAudit: audit,
    },
    null,
    2,
  );
  triggerDownload(
    new Blob([json], { type: "application/json;charset=utf-8" }),
    `simpul-${slug(strategy.title)}.json`,
  );
}

function cell(text, width, options = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: options.fill ? { fill: options.fill } : undefined,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0, line: 300 },
        children: [
          new TextRun({
            text: String(text ?? ""),
            bold: Boolean(options.bold),
            color: options.color || "171923",
            size: options.size || 19,
            font: "Calibri",
          }),
        ],
      }),
    ],
  });
}

function dataTable(headers, rows, widths) {
  const borders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: "D4CFC4" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "D4CFC4" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "D4CFC4" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "D4CFC4" },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 3, color: "E8E4DA" },
    insideVertical: { style: BorderStyle.SINGLE, size: 3, color: "E8E4DA" },
  };
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    borders,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((header, index) =>
          cell(header, widths[index], { bold: true, fill: "E8EEF5", size: 18 }),
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map((value, index) => cell(value, widths[index])),
          }),
      ),
    ],
  });
}

export async function createStrategyDocxBlob(strategy, audit) {
  const metricRows = [
    ["Skor akhir", Math.round(audit.score)],
    ["Optimalitas", Math.round(audit.optimality)],
    ["Efisiensi waktu", Math.round(audit.timeEfficiency)],
    ["Peluang berhasil", Math.round(audit.success)],
    ["Effort dibanding hasil", Math.round(audit.effortReturn)],
    ["Jalur kritis", `${audit.criticalPathHours} jam`],
  ];
  const nodeRows = strategy.nodes.map((node, index) => [
    index + 1,
    KIND_LABELS[node.kind] || node.kind,
    node.title,
    node.detail,
    `${node.duration}j / E${node.effort} / D${node.impact} / ${node.confidence}%`,
  ]);
  const nodeNames = new Map(strategy.nodes.map((node) => [node.id, node.title]));
  const edgeRows = strategy.edges.map((edge, index) => [
    index + 1,
    nodeNames.get(edge.source) || edge.source,
    nodeNames.get(edge.target) || edge.target,
    edge.relation,
    edge.label,
  ]);
  const doc = new Document({
    creator: "SIMPUL - AI Strategy Studio",
    title: strategy.title,
    description: "Strategy map dan hasil audit terakhir",
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: "171923" },
          paragraph: { spacing: { after: 120, line: 300 } },
        },
      },
      paragraphStyles: [
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          next: "Normal",
          run: { font: "Calibri", size: 42, bold: true, color: "171923" },
          paragraph: { spacing: { before: 0, after: 120 } },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Calibri", size: 32, bold: true, color: "2E74B5" },
          paragraph: { spacing: { before: 360, after: 200 }, keepNext: true },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Calibri", size: 26, bold: true, color: "2E74B5" },
          paragraph: { spacing: { before: 280, after: 140 }, keepNext: true },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "SIMPUL · Halaman ", color: "716E66", size: 16 }),
                  new TextRun({ children: [PageNumber.CURRENT], color: "716E66", size: 16 }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "SIMPUL · STRATEGY REPORT",
                bold: true,
                color: "2E74B5",
                size: 18,
                characterSpacing: 24,
              }),
            ],
            spacing: { after: 180 },
          }),
          new Paragraph({ text: strategy.title, style: "Title" }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${strategy.nodes.length} simpul · ${strategy.edges.length} hubungan · ${String(strategy.kind).toUpperCase()}`,
                color: "716E66",
                size: 19,
              }),
            ],
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${Math.round(audit.score)}/100 · ${audit.headline}`,
                bold: true,
                color: "171923",
                size: 25,
              }),
            ],
            shading: { fill: "E9F9C9" },
            indent: { left: 220, right: 220 },
            spacing: { before: 0, after: 280 },
          }),
          new Paragraph({ text: "Audit terakhir", heading: HeadingLevel.HEADING_1 }),
          dataTable(["Metrik", "Nilai"], metricRows, [4000, 5360]),
          new Paragraph({ text: "Temuan utama", heading: HeadingLevel.HEADING_2 }),
          ...audit.insights.map(
            (insight) =>
              new Paragraph({
                text: insight,
                bullet: { level: 0 },
                spacing: { after: 80, line: 300 },
              }),
          ),
          new Paragraph({ text: "Input strategi lengkap", heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: strategy.prompt || "Tidak ada input tersimpan." }),
          new Paragraph({ text: "Daftar simpul", heading: HeadingLevel.HEADING_1 }),
          dataTable(
            ["#", "Jenis", "Simpul", "Detail", "Metrik"],
            nodeRows,
            [420, 1160, 1900, 3900, 1980],
          ),
          new Paragraph({ text: "Hubungan antar simpul", heading: HeadingLevel.HEADING_1 }),
          dataTable(
            ["#", "Dari", "Menuju", "Fungsi", "Keterangan"],
            edgeRows,
            [420, 1900, 1900, 1500, 3640],
          ),
          new Paragraph({ text: "Sumber riset", heading: HeadingLevel.HEADING_1 }),
          ...(strategy.sources?.length
            ? strategy.sources.map(
                (source) =>
                  new Paragraph({
                    children: [
                      new TextRun({ text: source.title, bold: true }),
                      new TextRun({ text: `\n${source.url}`, color: "2E74B5", size: 18 }),
                    ],
                    spacing: { after: 120, line: 300 },
                  }),
              )
            : [new Paragraph({ text: "Tidak ada sumber tersimpan." })]),
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}

export async function downloadStrategyDocx(strategy, audit) {
  const blob = await createStrategyDocxBlob(strategy, audit);
  triggerDownload(blob, `simpul-${slug(strategy.title)}.docx`);
}
