"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  auditStrategy,
  DEFAULT_RUBRIC,
  DEMO_STRATEGY,
  normalizeStrategy,
  type AuditResult,
  type NodeKind,
  type PlanKind,
  type StrategyDocument,
  type StrategyEdge,
  type StrategyNode,
} from "./lib/strategy";

type HistoryFrame = {
  nodes: StrategyNode[];
  edges: StrategyEdge[];
};

const KIND_LABEL: Record<NodeKind, string> = {
  goal: "Hasil",
  milestone: "Milestone",
  task: "Tugas",
  decision: "Keputusan",
  risk: "Risiko",
};

const PLAN_OPTIONS: { value: PlanKind; label: string; hint: string }[] = [
  { value: "daily", label: "Rencana waktu", hint: "Hari, minggu, rutinitas" },
  { value: "flow", label: "Alur masalah", hint: "Proses dan keputusan" },
  { value: "goal", label: "Target besar", hint: "Goal dan multi-subgoal" },
];

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "sumber";
  }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isGitHubPages() {
  return (
    typeof window !== "undefined" &&
    (window.location.hostname.endsWith(".github.io") ||
      window.location.pathname.startsWith("/MAP-STRATEGY-GPT"))
  );
}

function ScoreRing({ score }: { score: number }) {
  const degrees = Math.round((score / 100) * 360);
  return (
    <div
      className="score-ring"
      style={{
        background: `conic-gradient(var(--signal) ${degrees}deg, rgba(255,255,255,.13) ${degrees}deg)`,
      }}
      aria-label={`Skor strategi ${score} dari 100`}
    >
      <div>
        <strong>{score}</strong>
        <span>/100</span>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="metric">
      <div className="metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="metric-track">
        <span style={{ width: `${value}%`, background: accent }} />
      </div>
    </div>
  );
}

function NodeCard({
  node,
  selected,
  connecting,
  zoom,
  onSelect,
  onMove,
  onMoveEnd,
  onConnect,
}: {
  node: StrategyNode;
  selected: boolean;
  connecting: boolean;
  zoom: number;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onMoveEnd: () => void;
  onConnect: () => void;
}) {
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    nodeX: number;
    nodeY: number;
    moved: boolean;
  } | null>(null);

  return (
    <article
      className={`strategy-node kind-${node.kind} ${selected ? "is-selected" : ""} ${
        connecting ? "is-connecting" : ""
      }`}
      style={{ left: node.x, top: node.y }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        drag.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          nodeX: node.x,
          nodeY: node.y,
          moved: false,
        };
      }}
      onPointerMove={(event) => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        const dx = (event.clientX - drag.current.startX) / zoom;
        const dy = (event.clientY - drag.current.startY) / zoom;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
        onMove(
          Math.max(16, Math.min(980, drag.current.nodeX + dx)),
          Math.max(16, Math.min(640, drag.current.nodeY + dy)),
        );
      }}
      onPointerUp={(event) => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        const moved = drag.current.moved;
        drag.current = null;
        if (moved) {
          onMoveEnd();
        } else {
          if (connecting) onConnect();
          else onSelect();
        }
      }}
    >
      <div className="node-topline">
        <span className="node-kind">{KIND_LABEL[node.kind]}</span>
        <span className={`node-status status-${node.status ?? "ready"}`}>
          {node.status === "warning" ? "Perlu cek" : node.status === "blocked" ? "Terhambat" : "Siap"}
        </span>
      </div>
      <h3>{node.title}</h3>
      <p>{node.detail}</p>
      <div className="node-meta">
        <span>{node.duration}j</span>
        <span>Effort {node.effort}</span>
        <span>{node.confidence}% yakin</span>
      </div>
      <i className="node-port node-port-in" />
      <i className="node-port node-port-out" />
    </article>
  );
}

export default function Home() {
  const [document, setDocument] = useState<StrategyDocument>(() =>
    deepCopy(DEMO_STRATEGY),
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("portfolio");
  const [connectSource, setConnectSource] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "connect">("select");
  const [zoom, setZoom] = useState(0.88);
  const [auditOpen, setAuditOpen] = useState(true);
  const [railOpen, setRailOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [prompt, setPrompt] = useState(
    "Susun strategi 6 minggu untuk meningkatkan peluang mendapatkan beasiswa akademik.",
  );
  const [planKind, setPlanKind] = useState<PlanKind>("goal");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [semanticAudit, setSemanticAudit] = useState<{
    headline: string;
    insights: string[];
  } | null>(null);
  const [aiAuditBusy, setAiAuditBusy] = useState(false);
  const [history, setHistory] = useState<HistoryFrame[]>([]);
  const [future, setFuture] = useState<HistoryFrame[]>([]);
  const lastCommitted = useRef<HistoryFrame>({
    nodes: deepCopy(DEMO_STRATEGY.nodes),
    edges: deepCopy(DEMO_STRATEGY.edges),
  });
  const auditTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localAudit = useMemo(
    () => auditStrategy(document.nodes, document.edges, document.rubric),
    [document.nodes, document.edges, document.rubric],
  );
  const selectedNode = document.nodes.find((node) => node.id === selectedNodeId);

  const commit = useCallback(() => {
    const current = {
      nodes: deepCopy(document.nodes),
      edges: deepCopy(document.edges),
    };
    const previous = lastCommitted.current;
    if (JSON.stringify(previous) !== JSON.stringify(current)) {
      setHistory((items) => [...items.slice(-29), previous]);
      setFuture([]);
      lastCommitted.current = current;
    }
  }, [document.edges, document.nodes]);

  useEffect(() => {
    const saved = localStorage.getItem("simpul-strategy");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as StrategyDocument;
        setDocument(parsed);
        lastCommitted.current = {
          nodes: deepCopy(parsed.nodes),
          edges: deepCopy(parsed.edges),
        };
      } catch {
        localStorage.removeItem("simpul-strategy");
      }
    }
    setApiKey(sessionStorage.getItem("simpul-openrouter-key") ?? "");
    if (window.matchMedia("(max-width: 720px)").matches) setAuditOpen(false);
  }, []);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setConnectSource(null);
        setTool("select");
        setInspectorOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    localStorage.setItem("simpul-strategy", JSON.stringify(document));
  }, [document]);

  useEffect(() => {
    if (!apiKey || loading) return;
    if (auditTimer.current) clearTimeout(auditTimer.current);
    auditTimer.current = setTimeout(async () => {
      setAiAuditBusy(true);
      try {
        const payload = {
          objective: document.prompt,
          rubric: document.rubric,
          graph: { nodes: document.nodes, edges: document.edges },
          deterministicAudit: localAudit,
        };
        if (isGitHubPages()) {
          const { auditStrategyInBrowser } = await import(
            "./lib/openrouter-browser"
          );
          setSemanticAudit(await auditStrategyInBrowser({ key: apiKey, payload }));
        } else {
          const response = await fetch("/api/audit", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-openrouter-key": apiKey,
            },
            body: JSON.stringify(payload),
          });
          if (response.ok) setSemanticAudit(await response.json());
        }
      } finally {
        setAiAuditBusy(false);
      }
    }, 1800);
    return () => {
      if (auditTimer.current) clearTimeout(auditTimer.current);
    };
  }, [
    apiKey,
    document.edges,
    document.nodes,
    document.prompt,
    document.rubric,
    loading,
    localAudit,
  ]);

  function mutateGraph(
    updater: (nodes: StrategyNode[], edges: StrategyEdge[]) => {
      nodes: StrategyNode[];
      edges: StrategyEdge[];
    },
    shouldCommit = true,
  ) {
    setDocument((current) => {
      const next = updater(current.nodes, current.edges);
      return { ...current, ...next };
    });
    if (shouldCommit) setTimeout(commit, 0);
  }

  function moveNode(id: string, x: number, y: number) {
    setDocument((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === id ? { ...node, x, y } : node)),
    }));
  }

  function handleConnect(id: string) {
    if (!connectSource) {
      setConnectSource(id);
      setNotice("Pilih simpul tujuan.");
      return;
    }
    if (connectSource === id) {
      setConnectSource(null);
      setNotice("Koneksi dibatalkan.");
      return;
    }
    const exists = document.edges.some(
      (edge) => edge.source === connectSource && edge.target === id,
    );
    if (!exists) {
      const previous = {
        nodes: deepCopy(document.nodes),
        edges: deepCopy(document.edges),
      };
      const nextEdge = { id: uid("edge"), source: connectSource, target: id };
      setHistory((items) => [...items.slice(-29), previous]);
      setDocument((current) => ({
        ...current,
        edges: [...current.edges, nextEdge],
      }));
      setFuture([]);
      lastCommitted.current = {
        nodes: deepCopy(document.nodes),
        edges: deepCopy([...document.edges, nextEdge]),
      };
      setNotice("Koneksi baru diaudit.");
    }
    setConnectSource(null);
  }

  function removeEdge(id: string) {
    const previous = {
      nodes: deepCopy(document.nodes),
      edges: deepCopy(document.edges),
    };
    setHistory((items) => [...items.slice(-29), previous]);
    setDocument((current) => ({
      ...current,
      edges: current.edges.filter((edge) => edge.id !== id),
    }));
    lastCommitted.current = {
      nodes: deepCopy(document.nodes),
      edges: deepCopy(document.edges.filter((edge) => edge.id !== id)),
    };
    setFuture([]);
    setNotice("Dependensi dilepas.");
  }

  function addNode() {
    const next: StrategyNode = {
      id: uid("node"),
      title: "Langkah baru",
      detail: "Ketuk detail untuk memperjelas hasil yang diharapkan.",
      kind: "task",
      x: 470 + Math.random() * 80,
      y: 280 + Math.random() * 60,
      duration: 2,
      effort: 3,
      impact: 6,
      confidence: 65,
      status: "warning",
    };
    const previous = {
      nodes: deepCopy(document.nodes),
      edges: deepCopy(document.edges),
    };
    setHistory((items) => [...items.slice(-29), previous]);
    setDocument((current) => ({ ...current, nodes: [...current.nodes, next] }));
    setSelectedNodeId(next.id);
    setInspectorOpen(true);
    setFuture([]);
  }

  function updateSelected(patch: Partial<StrategyNode>) {
    if (!selectedNodeId) return;
    setDocument((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === selectedNodeId ? { ...node, ...patch } : node,
      ),
    }));
  }

  function deleteSelected() {
    if (!selectedNodeId) return;
    const previous = {
      nodes: deepCopy(document.nodes),
      edges: deepCopy(document.edges),
    };
    setHistory((items) => [...items.slice(-29), previous]);
    setDocument((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => node.id !== selectedNodeId),
      edges: current.edges.filter(
        (edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId,
      ),
    }));
    setSelectedNodeId(null);
    setInspectorOpen(false);
    setFuture([]);
  }

  function undo() {
    const frame = history.at(-1);
    if (!frame) return;
    setFuture((items) => [
      { nodes: deepCopy(document.nodes), edges: deepCopy(document.edges) },
      ...items,
    ]);
    setHistory((items) => items.slice(0, -1));
    setDocument((current) => ({ ...current, ...deepCopy(frame) }));
    lastCommitted.current = deepCopy(frame);
  }

  function redo() {
    const frame = future[0];
    if (!frame) return;
    setHistory((items) => [
      ...items,
      { nodes: deepCopy(document.nodes), edges: deepCopy(document.edges) },
    ]);
    setFuture((items) => items.slice(1));
    setDocument((current) => ({ ...current, ...deepCopy(frame) }));
    lastCommitted.current = deepCopy(frame);
  }

  function tidyLayout() {
    const previous = {
      nodes: deepCopy(document.nodes),
      edges: deepCopy(document.edges),
    };
    const levels = new Map<string, number>();
    const incoming = new Map<string, number>();
    document.nodes.forEach((node) => incoming.set(node.id, 0));
    document.edges.forEach((edge) =>
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1),
    );
    let frontier = document.nodes
      .filter((node) => incoming.get(node.id) === 0)
      .map((node) => node.id);
    let level = 0;
    const seen = new Set<string>();
    while (frontier.length) {
      const next: string[] = [];
      frontier.forEach((id) => {
        if (seen.has(id)) return;
        seen.add(id);
        levels.set(id, level);
        document.edges
          .filter((edge) => edge.source === id)
          .forEach((edge) => next.push(edge.target));
      });
      frontier = next;
      level += 1;
    }
    document.nodes.forEach((node) => {
      if (!levels.has(node.id)) levels.set(node.id, level);
    });
    const grouped = new Map<number, StrategyNode[]>();
    document.nodes.forEach((node) => {
      const key = levels.get(node.id) ?? 0;
      grouped.set(key, [...(grouped.get(key) ?? []), node]);
    });
    const arranged = document.nodes.map((node) => {
      const nodeLevel = levels.get(node.id) ?? 0;
      const siblings = grouped.get(nodeLevel) ?? [node];
      const index = siblings.findIndex((item) => item.id === node.id);
      return {
        ...node,
        x: 70 + nodeLevel * 285,
        y: 80 + index * 170,
      };
    });
    setHistory((items) => [...items.slice(-29), previous]);
    setDocument((current) => ({ ...current, nodes: arranged }));
    setFuture([]);
    setNotice("Peta dirapikan berdasarkan dependensi.");
  }

  async function generateStrategy(useDemo = false) {
    if (!useDemo && !apiKey) {
      setSettingsOpen(true);
      return;
    }
    setLoading(true);
    setLoadingStage(0);
    setComposerOpen(false);
    setSemanticAudit(null);
    const stages = [1, 2, 3];
    const stageTimers = stages.map((stage, index) =>
      setTimeout(() => setLoadingStage(stage), 1000 + index * 1500),
    );
    try {
      if (useDemo) {
        await new Promise((resolve) => setTimeout(resolve, 3200));
        setDocument(deepCopy(DEMO_STRATEGY));
        setNotice("Mode demo siap. Semua simpul dapat diedit.");
      } else {
        sessionStorage.setItem("simpul-openrouter-key", apiKey);
        let data;
        if (isGitHubPages()) {
          const { generateStrategyInBrowser } = await import(
            "./lib/openrouter-browser"
          );
          data = await generateStrategyInBrowser({
            key: apiKey,
            prompt,
            kind: planKind,
          });
        } else {
          const response = await fetch("/api/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-openrouter-key": apiKey,
            },
            body: JSON.stringify({ prompt, kind: planKind }),
          });
          data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || "Pembuatan strategi gagal.");
          }
        }
        const next = normalizeStrategy(data.strategy, prompt, planKind);
        setDocument(next);
        setSemanticAudit(data.semanticAudit);
        setNotice("Empat agent selesai menyusun dan mengaudit peta.");
      }
      setHistory([]);
      setFuture([]);
      setSelectedNodeId(null);
      setConnectSource(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Pembuatan strategi gagal.");
      setComposerOpen(true);
    } finally {
      stageTimers.forEach(clearTimeout);
      setLoading(false);
      setLoadingStage(0);
    }
  }

  const displayAudit: AuditResult & { headline: string; insights: string[] } = {
    ...localAudit,
    headline: semanticAudit?.headline || localAudit.headline,
    insights: semanticAudit?.insights?.length
      ? [...semanticAudit.insights, ...localAudit.insights].slice(0, 4)
      : localAudit.insights,
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => setRailOpen((value) => !value)}
          aria-label="Buka navigasi"
        >
          <span className="brand-mark">S</span>
          <span>
            <strong>SIMPUL</strong>
            <small>strategy studio</small>
          </span>
        </button>
        <div className="title-block">
          <span className="eyebrow">
            {document.kind === "daily"
              ? "RENCANA WAKTU"
              : document.kind === "flow"
                ? "ALUR MASALAH"
                : "TARGET BESAR"}
          </span>
          <button
            className="document-title"
            onClick={() => setComposerOpen(true)}
            title="Buat strategi baru"
          >
            {document.title}
            <span>⌄</span>
          </button>
        </div>
        <div className="top-actions">
          <span className="save-state"><i /> Tersimpan</span>
          <button className="icon-button" onClick={undo} disabled={!history.length} aria-label="Urungkan">
            ↶
          </button>
          <button className="icon-button" onClick={redo} disabled={!future.length} aria-label="Ulangi">
            ↷
          </button>
          <button className="share-button" onClick={() => {
            navigator.clipboard?.writeText(window.location.href);
            setNotice("Tautan aplikasi disalin.");
          }}>
            Bagikan
          </button>
        </div>
      </header>

      <aside className={`nav-rail ${railOpen ? "is-open" : ""}`}>
        <div className="rail-group">
          <button className="rail-button active" aria-label="Peta strategi"><span>⌘</span><b>Peta</b></button>
          <button className="rail-button" onClick={() => setSourcesOpen(true)} aria-label="Sumber"><span>◫</span><b>Sumber</b></button>
          <button className="rail-button" onClick={() => setAuditOpen(true)} aria-label="Audit"><span>◎</span><b>Audit</b></button>
        </div>
        <div className="rail-group rail-bottom">
          <button className="rail-button" onClick={() => setSettingsOpen(true)} aria-label="Pengaturan"><span>⚙</span><b>Setup</b></button>
          <button className="profile-button">HA</button>
        </div>
      </aside>

      <section className="workspace">
        <div className="canvas-toolbar">
          <div className="tool-segment">
            <button
              className={tool === "select" ? "active" : ""}
              onClick={() => {
                setTool("select");
                setConnectSource(null);
              }}
            >
              <span>↖</span> Pilih
            </button>
            <button
              className={tool === "connect" ? "active" : ""}
              onClick={() => setTool("connect")}
            >
              <span>↗</span> Hubungkan
            </button>
          </div>
          <button className="tool-button primary" onClick={addNode}><span>＋</span> Simpul</button>
          <button className="tool-button" onClick={tidyLayout}><span>✦</span> Rapikan</button>
          <span className="toolbar-divider" />
          <button className="tool-button" onClick={() => setSourcesOpen(true)}>
            <span>◫</span> {document.sources.length} sumber
          </button>
          {connectSource && <span className="connect-hint">Pilih tujuan · Esc batal</span>}
        </div>

        <div className="canvas-wrap">
          <div className="canvas-grid" />
          <div
            className="strategy-canvas"
            style={{
              transform: `scale(${zoom})`,
              width: 1200,
              height: 760,
            }}
          >
            <svg className="edge-layer" width="1200" height="760" aria-hidden="true">
              {document.edges.map((edge) => {
                const source = document.nodes.find((node) => node.id === edge.source);
                const target = document.nodes.find((node) => node.id === edge.target);
                if (!source || !target) return null;
                const x1 = source.x + 228;
                const y1 = source.y + 72;
                const x2 = target.x;
                const y2 = target.y + 72;
                const bend = Math.max(70, Math.abs(x2 - x1) * 0.48);
                const path = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
                return (
                  <g key={edge.id}>
                    <path className="edge-hit" d={path} onClick={() => removeEdge(edge.id)} />
                    <path className="edge-line" d={path} />
                    <circle className="edge-dot" cx={x2} cy={y2} r="4" />
                  </g>
                );
              })}
            </svg>
            {document.nodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                selected={selectedNodeId === node.id}
                connecting={tool === "connect"}
                zoom={zoom}
                onSelect={() => {
                  setSelectedNodeId(node.id);
                  setInspectorOpen(true);
                }}
                onConnect={() => handleConnect(node.id)}
                onMove={(x, y) => moveNode(node.id, x, y)}
                onMoveEnd={commit}
              />
            ))}
          </div>

          <div className="canvas-status">
            <span><i className={aiAuditBusy ? "pulse" : ""} /> {aiAuditBusy ? "Auditor menilai perubahan…" : "Audit deterministik aktif"}</span>
            <span>{document.nodes.length} simpul · {document.edges.length} koneksi</span>
          </div>

          <div className="zoom-controls">
            <button onClick={() => setZoom((value) => Math.max(0.55, value - 0.1))} aria-label="Perkecil">−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((value) => Math.min(1.35, value + 0.1))} aria-label="Perbesar">＋</button>
          </div>
        </div>
      </section>

      <aside className={`audit-panel ${auditOpen ? "is-open" : ""}`}>
        <div className="panel-header">
          <div>
            <span className="eyebrow light">AUDIT STRATEGI</span>
            <h2>Seberapa kuat rencana ini?</h2>
          </div>
          <button className="panel-close" onClick={() => setAuditOpen(false)} aria-label="Tutup audit">×</button>
        </div>
        <div className="score-hero">
          <ScoreRing score={displayAudit.score} />
          <div>
            <span className={`verdict verdict-${displayAudit.score >= 80 ? "strong" : "review"}`}>
              {displayAudit.score >= 80 ? "KUAT" : "PERLU TINJAU"}
            </span>
            <p>{displayAudit.headline}</p>
          </div>
        </div>
        <div className="metrics">
          <Metric label="Optimalitas" value={displayAudit.optimality} accent="#a7ef61" />
          <Metric label="Efisiensi waktu" value={displayAudit.timeEfficiency} accent="#60c9ff" />
          <Metric label="Peluang berhasil" value={displayAudit.success} accent="#ffb04f" />
          <Metric label="Effort → hasil" value={displayAudit.effortReturn} accent="#d8a4ff" />
        </div>
        <div className="audit-facts">
          <div><span>Jalur kritis</span><strong>{displayAudit.criticalPathHours} jam</strong></div>
          <div><span>Total effort</span><strong>{displayAudit.totalEffort} poin</strong></div>
          <div><span>Jalur paralel</span><strong>{displayAudit.parallelTracks}</strong></div>
        </div>
        <div className="audit-insights">
          <div className="section-title">
            <h3>Titik ungkit</h3>
            <span>{semanticAudit ? "AI + mesin" : "mesin lokal"}</span>
          </div>
          {displayAudit.insights.map((insight, index) => (
            <article key={`${insight}-${index}`}>
              <span>{index + 1}</span>
              <p>{insight}</p>
            </article>
          ))}
        </div>
        <button className="audit-cta" onClick={() => setComposerOpen(true)}>
          <span>✦</span>
          Minta AI optimalkan
        </button>
        <p className="audit-footnote">Skor berubah langsung saat struktur, waktu, effort, atau keyakinan diubah.</p>
      </aside>

      {!auditOpen && (
        <button className="audit-peek" onClick={() => setAuditOpen(true)}>
          <span>{displayAudit.score}</span>
          Audit
        </button>
      )}

      {inspectorOpen && selectedNode && (
        <aside className="inspector">
          <div className="panel-header pale">
            <div>
              <span className="eyebrow">EDIT SIMPUL</span>
              <h2>{selectedNode.title}</h2>
            </div>
            <button className="panel-close dark" onClick={() => setInspectorOpen(false)}>×</button>
          </div>
          <label>
            Judul
            <input
              value={selectedNode.title}
              onChange={(event) => updateSelected({ title: event.target.value })}
              onBlur={commit}
            />
          </label>
          <label>
            Detail hasil
            <textarea
              value={selectedNode.detail}
              onChange={(event) => updateSelected({ detail: event.target.value })}
              onBlur={commit}
            />
          </label>
          <label>
            Jenis simpul
            <select
              value={selectedNode.kind}
              onChange={(event) => {
                updateSelected({ kind: event.target.value as NodeKind });
                setTimeout(commit, 0);
              }}
            >
              {Object.entries(KIND_LABEL).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
          <div className="field-row">
            <label>
              Durasi (jam)
              <input
                type="number"
                min="0"
                value={selectedNode.duration}
                onChange={(event) => updateSelected({ duration: Number(event.target.value) })}
                onBlur={commit}
              />
            </label>
            <label>
              Effort (1–10)
              <input
                type="number"
                min="1"
                max="10"
                value={selectedNode.effort}
                onChange={(event) => updateSelected({ effort: Number(event.target.value) })}
                onBlur={commit}
              />
            </label>
          </div>
          <label className="range-label">
            <span>Keyakinan <b>{selectedNode.confidence}%</b></span>
            <input
              type="range"
              min="0"
              max="100"
              value={selectedNode.confidence}
              onChange={(event) => updateSelected({ confidence: Number(event.target.value) })}
              onPointerUp={commit}
            />
          </label>
          <div className="dependencies">
            <h3>Dependensi</h3>
            {document.edges
              .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
              .map((edge) => {
                const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
                const other = document.nodes.find((node) => node.id === otherId);
                return (
                  <div key={edge.id}>
                    <span>{edge.target === selectedNode.id ? "Dari" : "Ke"} · {other?.title}</span>
                    <button onClick={() => removeEdge(edge.id)}>Lepas</button>
                  </div>
                );
              })}
          </div>
          <button className="danger-button" onClick={deleteSelected}>Hapus simpul</button>
        </aside>
      )}

      {sourcesOpen && (
        <div className="modal-backdrop" onMouseDown={() => setSourcesOpen(false)}>
          <section className="source-sheet" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">BAHAN RISET</span>
                <h2>Sumber di balik strategi</h2>
                <p>Thinking Agent merangkum materi ini sebelum peta dibangun.</p>
              </div>
              <button onClick={() => setSourcesOpen(false)}>×</button>
            </div>
            <div className="source-list">
              {document.sources.map((source, index) => (
                <a href={source.url} target="_blank" rel="noreferrer" key={`${source.url}-${index}`}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{source.title}</strong>
                    <small>{source.domain || domainFromUrl(source.url)}</small>
                  </div>
                  <b>↗</b>
                </a>
              ))}
              {!document.sources.length && <p>Belum ada sumber. Buat strategi dengan OpenRouter untuk memulai riset.</p>}
            </div>
          </section>
        </div>
      )}

      {composerOpen && (
        <div className="modal-backdrop">
          <section className="composer">
            <button className="modal-x" onClick={() => setComposerOpen(false)}>×</button>
            <span className="composer-kicker"><i /> EMPAT AGENT, SATU STRATEGI</span>
            <h1>Apa yang ingin Anda capai?</h1>
            <p>SIMPUL akan meneliti konteks, membangun peta, dan menyiapkan mesin penilaian khusus.</p>
            <div className="plan-options">
              {PLAN_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={planKind === option.value ? "active" : ""}
                  onClick={() => setPlanKind(option.value)}
                >
                  <span>{option.value === "daily" ? "◷" : option.value === "flow" ? "↝" : "◎"}</span>
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </button>
              ))}
            </div>
            <label className="prompt-field">
              <span>Jelaskan tujuan, batas waktu, dan kondisi penting</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Contoh: Susun strategi 6 minggu untuk…"
                autoFocus
              />
              <small>{prompt.length}/3000</small>
            </label>
            <div className="composer-actions">
              <button className="demo-button" onClick={() => generateStrategy(true)}>Coba mode demo</button>
              <button className="generate-button" onClick={() => generateStrategy(false)} disabled={prompt.trim().length < 12}>
                Buat peta strategi <span>→</span>
              </button>
            </div>
            <div className="agent-line">
              <span>Gemini · Thinking</span>
              <i />
              <span>GPT · Worker</span>
              <i />
              <span>Claude · Architect</span>
              <i />
              <span>Qwen · Auditor</span>
            </div>
          </section>
        </div>
      )}

      {settingsOpen && (
        <div className="modal-backdrop" onMouseDown={() => setSettingsOpen(false)}>
          <section className="settings-card" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-x" onClick={() => setSettingsOpen(false)}>×</button>
            <span className="eyebrow">KONEKSI MODEL</span>
            <h2>Hubungkan OpenRouter</h2>
            <p>Key hanya disimpan di sesi browser ini dan dikirim ke endpoint aplikasi saat agent bekerja.</p>
            <label>
              OpenRouter API key
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-or-v1-••••••••"
              />
            </label>
            <div className="model-grid">
              <div><span>Thinking</span><strong>Gemini 3.5 Flash</strong><small>$1.50 / $9.00</small></div>
              <div><span>Worker</span><strong>GPT-5.2 Codex</strong><small>$1.75 / $14.00</small></div>
              <div><span>Architect</span><strong>Claude Sonnet 5</strong><small>$2.00 / $10.00</small></div>
              <div><span>Auditor</span><strong>Qwen 3.7 Max</strong><small>$1.48 / $4.43</small></div>
            </div>
            <p className="pricing-note">Harga input / output per 1 juta token, terverifikasi dari katalog OpenRouter saat aplikasi disusun.</p>
            <button
              className="generate-button full"
              onClick={() => {
                sessionStorage.setItem("simpul-openrouter-key", apiKey);
                setSettingsOpen(false);
                setNotice("OpenRouter terhubung untuk sesi ini.");
              }}
              disabled={!apiKey.trim()}
            >
              Simpan untuk sesi ini
            </button>
          </section>
        </div>
      )}

      {loading && (
        <div className="loading-screen">
          <div className="loading-orbit">
            <i />
            <i />
            <i />
            <i />
            <span>{loadingStage + 1}/4</span>
          </div>
          <span className="eyebrow light">MEMBANGUN MESIN STRATEGI</span>
          <h2>
            {[
              "Thinking Agent sedang meneliti konteks…",
              "Worker sedang menulis rubrik dan algoritma…",
              "Architect sedang menyusun simpul dan dependensi…",
              "Auditor sedang menguji strategi awal…",
            ][loadingStage]}
          </h2>
          <div className="loading-progress"><span style={{ width: `${(loadingStage + 1) * 25}%` }} /></div>
          <p>Setiap role memakai model berbeda agar hasilnya saling mengoreksi.</p>
        </div>
      )}

      {notice && (
        <button className="toast" onClick={() => setNotice(null)}>
          <span>✓</span>
          {notice}
          <b>×</b>
        </button>
      )}
    </main>
  );
}
