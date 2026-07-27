"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  arrangeStrategyNodes,
  auditStrategy,
  DEMO_STRATEGY,
  deriveNodeStatus,
  EDGE_RELATION_LABEL,
  ensureConnectedStrategyGraph,
  getOrthogonalEdgeGeometry,
  getStrategyCanvasSize,
  inferEdgeRelation,
  nodePriorityScore,
  normalizeStrategy,
  type AuditResult,
  type EdgeRelation,
  type NodeKind,
  type NodeStatus,
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

function clampZoom(value: number) {
  return Math.min(2.5, Math.max(0.2, value));
}

function pointerDistance(points: { x: number; y: number }[]) {
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
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
  const cardRef = useRef<HTMLElement | null>(null);
  const drag = useRef<{
    input: "pointer" | "touch";
    identifier: number;
    startX: number;
    startY: number;
    nodeX: number;
    nodeY: number;
    moved: boolean;
  } | null>(null);

  function canvasBlocksNodeDrag() {
    const canvas = cardRef.current?.closest<HTMLElement>(".canvas-wrap");
    return (
      canvas?.dataset.pinching === "true" ||
      canvas?.dataset.dragCancelled === "true"
    );
  }

  function beginDrag(
    input: "pointer" | "touch",
    identifier: number,
    clientX: number,
    clientY: number,
  ) {
    if (canvasBlocksNodeDrag()) return;
    if (cardRef.current) cardRef.current.dataset.dragging = "true";
    drag.current = {
      input,
      identifier,
      startX: clientX,
      startY: clientY,
      nodeX: node.x,
      nodeY: node.y,
      moved: false,
    };
  }

  function updateDrag(clientX: number, clientY: number) {
    if (!drag.current) return;
    const dx = (clientX - drag.current.startX) / zoom;
    const dy = (clientY - drag.current.startY) / zoom;
    if (Math.hypot(dx, dy) > 4) drag.current.moved = true;
    onMove(
      Math.max(16, drag.current.nodeX + dx),
      Math.max(16, drag.current.nodeY + dy),
    );
  }

  function finishDrag(activate: boolean) {
    if (!drag.current) return;
    const moved = drag.current.moved;
    drag.current = null;
    if (cardRef.current) delete cardRef.current.dataset.dragging;
    if (moved) onMoveEnd();
    else if (activate) {
      if (connecting) onConnect();
      else onSelect();
    }
  }

  function cancelDrag() {
    drag.current = null;
    if (cardRef.current) delete cardRef.current.dataset.dragging;
  }

  return (
    <article
      ref={cardRef}
      className={`strategy-node kind-${node.kind} ${selected ? "is-selected" : ""} ${
        connecting ? "is-connecting" : ""
      }`}
      style={{ left: node.x, top: node.y }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        // Touch has a dedicated path below because iOS Safari can axis-lock
        // Pointer Events inside a transformed overflow container.
        if (event.pointerType === "touch") return;
        event.preventDefault();
        event.stopPropagation();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Pointer capture is an optimization; document-level dispatch still works.
        }
        beginDrag(
          "pointer",
          event.pointerId,
          event.clientX,
          event.clientY,
        );
      }}
      onPointerMove={(event) => {
        if (
          !drag.current ||
          drag.current.input !== "pointer" ||
          drag.current.identifier !== event.pointerId
        ) {
          return;
        }
        if (canvasBlocksNodeDrag()) {
          cancelDrag();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        updateDrag(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        if (
          !drag.current ||
          drag.current.input !== "pointer" ||
          drag.current.identifier !== event.pointerId
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        finishDrag(true);
      }}
      onPointerCancel={() => cancelDrag()}
      onLostPointerCapture={() => {
        if (drag.current?.input === "pointer") finishDrag(false);
      }}
      onTouchStart={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        if (event.touches.length !== 1 || canvasBlocksNodeDrag()) {
          cancelDrag();
          return;
        }
        const touch = event.changedTouches[0];
        event.preventDefault();
        beginDrag(
          "touch",
          touch.identifier,
          touch.clientX,
          touch.clientY,
        );
      }}
      onTouchMove={(event) => {
        if (!drag.current || drag.current.input !== "touch") return;
        if (event.touches.length !== 1 || canvasBlocksNodeDrag()) {
          cancelDrag();
          return;
        }
        const touch = Array.from(event.touches).find(
          (item) => item.identifier === drag.current?.identifier,
        );
        if (!touch) return;
        event.preventDefault();
        event.stopPropagation();
        updateDrag(touch.clientX, touch.clientY);
      }}
      onTouchEnd={(event) => {
        if (!drag.current || drag.current.input !== "touch") return;
        if (canvasBlocksNodeDrag()) {
          cancelDrag();
          return;
        }
        const ended = Array.from(event.changedTouches).some(
          (item) => item.identifier === drag.current?.identifier,
        );
        if (!ended) return;
        event.preventDefault();
        event.stopPropagation();
        finishDrag(true);
      }}
      onTouchCancel={() => cancelDrag()}
      onContextMenu={(event) => event.preventDefault()}
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
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectSource, setConnectSource] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "connect">("select");
  const [zoom, setZoom] = useState(0.88);
  const [auditOpen, setAuditOpen] = useState(true);
  const [railOpen, setRailOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
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
  const [exportBusy, setExportBusy] = useState<
    "pdf" | "svg" | "docx" | "json" | null
  >(null);
  const [history, setHistory] = useState<HistoryFrame[]>([]);
  const [future, setFuture] = useState<HistoryFrame[]>([]);
  const lastCommitted = useRef<HistoryFrame>({
    nodes: deepCopy(DEMO_STRATEGY.nodes),
    edges: deepCopy(DEMO_STRATEGY.edges),
  });
  const auditTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const textImportRef = useRef<HTMLInputElement | null>(null);
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchState = useRef<{
    distance: number;
    zoom: number;
    anchorX: number;
    anchorY: number;
  } | null>(null);
  const panState = useRef<{
    pointerId: number;
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const localAudit = useMemo(
    () => auditStrategy(document.nodes, document.edges, document.rubric),
    [document.nodes, document.edges, document.rubric],
  );
  const selectedNode = document.nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = document.edges.find((edge) => edge.id === selectedEdgeId);
  const canvasSize = useMemo(
    () => getStrategyCanvasSize(document.nodes),
    [document.nodes],
  );

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
        const restored = normalizeStrategy(
          parsed,
          parsed.prompt || "",
          parsed.kind || "goal",
        );
        // State hydration intentionally follows the browser-only storage read.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDocument(restored);
        lastCommitted.current = {
          nodes: deepCopy(restored.nodes),
          edges: deepCopy(restored.edges),
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
        setSelectedEdgeId(null);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("simpul-strategy", JSON.stringify(document));
    } catch {
      // Surface quota failures immediately because the persistence attempt failed.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotice("Peta terlalu besar untuk penyimpanan lokal browser; ekspor PDF sebagai cadangan.");
    }
  }, [document]);

  useEffect(() => {
    if (!apiKey || loading) return;
    if (auditTimer.current) clearTimeout(auditTimer.current);
    const auditDelay = Math.min(6500, 1800 + document.nodes.length * 35);
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
      } catch {
        setSemanticAudit(null);
      } finally {
        setAiAuditBusy(false);
      }
    }, auditDelay);
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

  function moveNode(id: string, x: number, y: number) {
    setDocument((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === id ? { ...node, x, y } : node)),
    }));
  }

  function beginPinchGesture(
    points: { x: number; y: number }[],
    wrap: HTMLDivElement,
  ) {
    const centerX = (points[0].x + points[1].x) / 2;
    const centerY = (points[0].y + points[1].y) / 2;
    const rect = wrap.getBoundingClientRect();
    const canvas = wrap.querySelector<HTMLElement>(".strategy-canvas");
    const localX = centerX - rect.left;
    const localY = centerY - rect.top;
    pinchState.current = {
      distance: Math.max(1, pointerDistance(points)),
      zoom,
      anchorX:
        (wrap.scrollLeft + localX - (canvas?.offsetLeft ?? 0)) / zoom,
      anchorY:
        (wrap.scrollTop + localY - (canvas?.offsetTop ?? 0)) / zoom,
    };
    wrap.dataset.pinching = "true";
    wrap.dataset.dragCancelled = "true";
    panState.current = null;
  }

  function updatePinchGesture(
    points: { x: number; y: number }[],
    wrap: HTMLDivElement,
  ) {
    if (!pinchState.current) return;
    const distance = Math.max(1, pointerDistance(points));
    const nextZoom = clampZoom(
      pinchState.current.zoom * (distance / pinchState.current.distance),
    );
    const centerX = (points[0].x + points[1].x) / 2;
    const centerY = (points[0].y + points[1].y) / 2;
    const rect = wrap.getBoundingClientRect();
    const canvas = wrap.querySelector<HTMLElement>(".strategy-canvas");
    const localX = centerX - rect.left;
    const localY = centerY - rect.top;
    const nextScrollLeft =
      (canvas?.offsetLeft ?? 0) +
      pinchState.current.anchorX * nextZoom -
      localX;
    const nextScrollTop =
      (canvas?.offsetTop ?? 0) +
      pinchState.current.anchorY * nextZoom -
      localY;
    setZoom(nextZoom);
    requestAnimationFrame(() => {
      wrap.scrollLeft = nextScrollLeft;
      wrap.scrollTop = nextScrollTop;
    });
  }

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const wrap = canvasWrapRef.current;
    if (!wrap || event.pointerType === "touch") return;
    activePointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (activePointers.current.size >= 2) {
      const points = [...activePointers.current.values()].slice(0, 2);
      beginPinchGesture(points, wrap);
      return;
    }

    if (
      event.pointerType === "pen" &&
      !(event.target as HTMLElement).closest(
        ".strategy-node, button, input, textarea, select, .edge-hit",
      )
    ) {
      event.currentTarget.setPointerCapture(event.pointerId);
      panState.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        scrollLeft: wrap.scrollLeft,
        scrollTop: wrap.scrollTop,
      };
    }
  }

  function handleCanvasPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const wrap = canvasWrapRef.current;
    if (
      !wrap ||
      event.pointerType === "touch" ||
      !activePointers.current.has(event.pointerId)
    ) {
      return;
    }
    activePointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (activePointers.current.size >= 2 && pinchState.current) {
      event.preventDefault();
      const points = [...activePointers.current.values()].slice(0, 2);
      updatePinchGesture(points, wrap);
      return;
    }

    if (panState.current?.pointerId === event.pointerId) {
      event.preventDefault();
      wrap.scrollLeft =
        panState.current.scrollLeft - (event.clientX - panState.current.x);
      wrap.scrollTop =
        panState.current.scrollTop - (event.clientY - panState.current.y);
    }
  }

  function handleCanvasPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    const wrap = canvasWrapRef.current;
    activePointers.current.delete(event.pointerId);
    if (panState.current?.pointerId === event.pointerId) panState.current = null;
    if (activePointers.current.size < 2) {
      pinchState.current = null;
      if (wrap) delete wrap.dataset.pinching;
    }
    if (!activePointers.current.size && wrap) {
      delete wrap.dataset.dragCancelled;
    }
  }

  function handleCanvasTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    if (event.touches.length >= 2) {
      event.preventDefault();
      const points = Array.from(event.touches)
        .slice(0, 2)
        .map((touch) => ({ x: touch.clientX, y: touch.clientY }));
      beginPinchGesture(points, wrap);
      return;
    }

    const touch = event.touches[0];
    if (
      touch &&
      !(event.target as HTMLElement).closest(
        ".strategy-node, button, input, textarea, select, .edge-hit",
      )
    ) {
      event.preventDefault();
      panState.current = {
        pointerId: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        scrollLeft: wrap.scrollLeft,
        scrollTop: wrap.scrollTop,
      };
    }
  }

  function handleCanvasTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    const wrap = canvasWrapRef.current;
    if (!wrap) return;
    if (event.touches.length >= 2) {
      event.preventDefault();
      const points = Array.from(event.touches)
        .slice(0, 2)
        .map((touch) => ({ x: touch.clientX, y: touch.clientY }));
      if (!pinchState.current) beginPinchGesture(points, wrap);
      else updatePinchGesture(points, wrap);
      return;
    }

    if (!panState.current || event.touches.length !== 1) return;
    const touch = Array.from(event.touches).find(
      (item) => item.identifier === panState.current?.pointerId,
    );
    if (!touch) return;
    event.preventDefault();
    wrap.scrollLeft =
      panState.current.scrollLeft - (touch.clientX - panState.current.x);
    wrap.scrollTop =
      panState.current.scrollTop - (touch.clientY - panState.current.y);
  }

  function handleCanvasTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const wrap = canvasWrapRef.current;
    if (event.touches.length < 2) {
      pinchState.current = null;
      if (wrap) delete wrap.dataset.pinching;
    }
    if (!event.touches.length && wrap) {
      delete wrap.dataset.dragCancelled;
    }
    if (
      !event.touches.length ||
      !Array.from(event.touches).some(
        (touch) => touch.identifier === panState.current?.pointerId,
      )
    ) {
      panState.current = null;
    }
  }

  function handleCanvasTouchCancel() {
    const wrap = canvasWrapRef.current;
    pinchState.current = null;
    panState.current = null;
    if (wrap) {
      delete wrap.dataset.pinching;
      delete wrap.dataset.dragCancelled;
    }
  }

  function handleCanvasWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom((value) => clampZoom(value * Math.exp(-event.deltaY * 0.006)));
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
      const sourceNode = document.nodes.find((node) => node.id === connectSource);
      const targetNode = document.nodes.find((node) => node.id === id);
      if (!sourceNode || !targetNode) {
        setConnectSource(null);
        return;
      }
      const nextEdge: StrategyEdge = {
        id: uid("edge"),
        source: connectSource,
        target: id,
        ...inferEdgeRelation(sourceNode, targetNode),
      };
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
      setSelectedNodeId(null);
      setSelectedEdgeId(nextEdge.id);
      setInspectorOpen(true);
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
    if (selectedEdgeId === id) {
      setSelectedEdgeId(null);
      setInspectorOpen(false);
    }
    setNotice("Dependensi dilepas.");
  }

  function addNode() {
    const slot = document.nodes.length;
    const next: StrategyNode = {
      id: uid("node"),
      title: "Langkah baru",
      detail: "Ketuk detail untuk memperjelas hasil yang diharapkan.",
      kind: "task",
      x: 70 + Math.floor(slot / 6) * 290,
      y: 80 + (slot % 6) * 180,
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
    setSelectedEdgeId(null);
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

  function updateSelectedEdge(patch: Partial<StrategyEdge>) {
    if (!selectedEdgeId) return;
    setDocument((current) => ({
      ...current,
      edges: current.edges.map((edge) =>
        edge.id === selectedEdgeId ? { ...edge, ...patch } : edge,
      ),
    }));
  }

  function duplicateSelected() {
    if (!selectedNode) return;
    const duplicate: StrategyNode = {
      ...selectedNode,
      id: uid("node"),
      title: `${selectedNode.title} - salinan`,
      x: selectedNode.x + 290,
      y: selectedNode.y + 55,
      status: deriveNodeStatus(selectedNode),
    };
    const relation = inferEdgeRelation(selectedNode, duplicate);
    const edge: StrategyEdge = {
      id: uid("edge"),
      source: selectedNode.id,
      target: duplicate.id,
      relation: "sequence",
      label:
        relation.relation === "sequence"
          ? relation.label
          : "Dilanjutkan oleh variasi langkah ini",
    };
    const previous = {
      nodes: deepCopy(document.nodes),
      edges: deepCopy(document.edges),
    };
    setHistory((items) => [...items.slice(-29), previous]);
    setDocument((current) => ({
      ...current,
      nodes: [...current.nodes, duplicate],
      edges: [...current.edges, edge],
    }));
    setSelectedNodeId(duplicate.id);
    setFuture([]);
    setNotice("Simpul diduplikasi dan dihubungkan otomatis.");
  }

  function splitSelected() {
    if (!selectedNode) return;
    const baseX = Math.max(40, selectedNode.x - 870);
    const baseY = selectedNode.y + 190;
    const titles = ["Siapkan prasyarat", "Jalankan inti", "Validasi hasil"];
    const details = [
      `Siapkan input, sumber daya, dan kondisi sebelum "${selectedNode.title}".`,
      `Kerjakan bagian utama yang menghasilkan progres untuk "${selectedNode.title}".`,
      `Uji kualitas dan bukti selesai sebelum "${selectedNode.title}" dinyatakan tercapai.`,
    ];
    const children = titles.map(
      (title, index): StrategyNode => ({
        id: uid(`node-${index + 1}`),
        title,
        detail: details[index],
        kind: index === 2 ? "milestone" : "task",
        x: baseX + index * 290,
        y: baseY,
        duration: Math.max(1, Math.round(selectedNode.duration / 3)),
        effort: Math.max(1, Math.round(selectedNode.effort / 2)),
        impact: Math.max(1, selectedNode.impact - 1 + (index === 2 ? 1 : 0)),
        confidence: Math.max(35, selectedNode.confidence - 5 + index * 5),
        status: "warning",
      }),
    );
    const splitEdges: StrategyEdge[] = [
      {
        id: uid("edge"),
        source: children[0].id,
        target: children[1].id,
        relation: "sequence",
        label: "Persiapan membuka pelaksanaan",
      },
      {
        id: uid("edge"),
        source: children[1].id,
        target: children[2].id,
        relation: "validation",
        label: "Hasil pelaksanaan harus divalidasi",
      },
      {
        id: uid("edge"),
        source: children[2].id,
        target: selectedNode.id,
        relation: "contribution",
        label: "Validasi menyelesaikan simpul induk",
      },
    ];
    setHistory((items) => [
      ...items.slice(-29),
      { nodes: deepCopy(document.nodes), edges: deepCopy(document.edges) },
    ]);
    setDocument((current) => ({
      ...current,
      nodes: [...current.nodes, ...children],
      edges: [...current.edges, ...splitEdges],
    }));
    setFuture([]);
    setNotice("Simpul diurai menjadi tiga langkah deterministik.");
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
    const connectedEdges = ensureConnectedStrategyGraph(
      document.nodes,
      document.edges,
    );
    const arranged = arrangeStrategyNodes(document.nodes, connectedEdges);
    setHistory((items) => [...items.slice(-29), previous]);
    setDocument((current) => ({
      ...current,
      nodes: arranged,
      edges: connectedEdges,
    }));
    lastCommitted.current = {
      nodes: deepCopy(arranged),
      edges: deepCopy(connectedEdges),
    };
    setFuture([]);
    setNotice("Peta dirapikan dan koneksi terputus diperbaiki.");
  }

  async function importStrategyText(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setPrompt(text);
      setComposerOpen(true);
      setNotice(`${file.name} dimuat. Teks siap disempurnakan oleh agent.`);
    } catch {
      setNotice("File teks tidak dapat dibaca.");
    } finally {
      event.target.value = "";
    }
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
        const demo = deepCopy(DEMO_STRATEGY);
        setDocument(demo);
        lastCommitted.current = {
          nodes: deepCopy(demo.nodes),
          edges: deepCopy(demo.edges),
        };
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
        const next = normalizeStrategy(data.strategy, prompt, planKind, {
          arrange: true,
        });
        setDocument(next);
        lastCommitted.current = {
          nodes: deepCopy(next.nodes),
          edges: deepCopy(next.edges),
        };
        setSemanticAudit(data.semanticAudit);
        setNotice(
          `Empat agent selesai menyusun ${next.nodes.length} simpul dan ${next.edges.length} relasi.`,
        );
      }
      setHistory([]);
      setFuture([]);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
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

  async function exportStrategy(format: "pdf" | "svg" | "docx" | "json") {
    setExportBusy(format);
    try {
      if (format === "pdf") {
        const { downloadStrategyPdf } = await import("./lib/export-pdf.js");
        await downloadStrategyPdf(document, displayAudit);
      } else {
        const exporters = await import("./lib/export-formats.js");
        if (format === "svg") {
          exporters.downloadStrategySvg(document, displayAudit);
        } else if (format === "docx") {
          await exporters.downloadStrategyDocx(document, displayAudit);
        } else {
          exporters.downloadStrategyJson(document, displayAudit);
        }
      }
      const names = {
        pdf: "PDF report dan poster satu halaman",
        svg: "SVG poster vektor",
        docx: "Dokumen Word",
        json: "Backup JSON",
      };
      setNotice(`${names[format]} berhasil dibuat.`);
      setExportOpen(false);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Dokumen tidak dapat dibuat.",
      );
    } finally {
      setExportBusy(null);
    }
  }

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
          <button className="tool-button" onClick={() => setExportOpen(true)}>
            <span>⇩</span> Ekspor
          </button>
          {connectSource && <span className="connect-hint">Pilih tujuan · Esc batal</span>}
        </div>

        <div
          className="canvas-wrap"
          ref={canvasWrapRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerEnd}
          onPointerCancel={handleCanvasPointerEnd}
          onTouchStart={handleCanvasTouchStart}
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={handleCanvasTouchEnd}
          onTouchCancel={handleCanvasTouchCancel}
          onWheel={handleCanvasWheel}
        >
          <div className="canvas-grid" />
          <div
            className="strategy-canvas"
            style={{
              transform: `scale(${zoom})`,
              width: canvasSize.width,
              height: canvasSize.height,
            }}
          >
            <svg
              className="edge-layer"
              width={canvasSize.width}
              height={canvasSize.height}
            >
              {document.edges.map((edge) => {
                const source = document.nodes.find((node) => node.id === edge.source);
                const target = document.nodes.find((node) => node.id === edge.target);
                if (!source || !target) return null;
                const geometry = getOrthogonalEdgeGeometry(source, target);
                const targetPoint =
                  geometry.points[geometry.points.length - 1];
                const edgeText = edge.label || EDGE_RELATION_LABEL[edge.relation];
                const shortLabel =
                  edgeText.length > 34 ? `${edgeText.slice(0, 32)}...` : edgeText;
                const labelWidth = Math.min(
                  220,
                  Math.max(92, shortLabel.length * 5.4 + 20),
                );
                return (
                  <g
                    key={edge.id}
                    className={`edge-group relation-${edge.relation} ${
                      selectedEdgeId === edge.id ? "is-selected" : ""
                    }`}
                  >
                    <path
                      className="edge-hit"
                      d={geometry.path}
                      role="button"
                      tabIndex={0}
                      aria-label={`Edit hubungan: ${edgeText}`}
                      onClick={() => {
                        setSelectedNodeId(null);
                        setSelectedEdgeId(edge.id);
                        setInspectorOpen(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          setSelectedNodeId(null);
                          setSelectedEdgeId(edge.id);
                          setInspectorOpen(true);
                        }
                      }}
                    />
                    <path className="edge-line" d={geometry.path} />
                    <circle
                      className="edge-dot"
                      cx={targetPoint.x}
                      cy={targetPoint.y}
                      r="4"
                    />
                    <rect
                      className="edge-label-bg"
                      x={geometry.labelX - labelWidth / 2}
                      y={geometry.labelY - 13}
                      width={labelWidth}
                      height="26"
                      rx="7"
                    />
                    <text
                      className="edge-label-text"
                      x={geometry.labelX}
                      y={geometry.labelY + 3}
                      textAnchor="middle"
                    >
                      {shortLabel}
                    </text>
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
                  setSelectedEdgeId(null);
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

          <div className="zoom-indicator" aria-live="polite">
            <strong>{Math.round(zoom * 100)}%</strong>
            <span>Seret simpul bebas · pinch untuk zoom · geser ruang kosong</span>
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

      {inspectorOpen && (selectedNode || selectedEdge) && (
        <aside className="inspector">
          {selectedNode && (
            <>
          <div className="panel-header pale">
            <div>
              <span className="eyebrow">EDIT SIMPUL</span>
              <h2>{selectedNode.title}</h2>
              <span className="priority-chip">
                Prioritas deterministik {nodePriorityScore(selectedNode)}/100
              </span>
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
          <div className="field-row">
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
            <label>
              Status
              <select
                value={selectedNode.status ?? "ready"}
                onChange={(event) => {
                  updateSelected({ status: event.target.value as NodeStatus });
                  setTimeout(commit, 0);
                }}
              >
                <option value="ready">Siap</option>
                <option value="warning">Perlu cek</option>
                <option value="blocked">Terhambat</option>
              </select>
            </label>
          </div>
          <div className="field-row three">
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
            <label>
              Dampak (1–10)
              <input
                type="number"
                min="1"
                max="10"
                value={selectedNode.impact}
                onChange={(event) => updateSelected({ impact: Number(event.target.value) })}
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
          <div className="inspector-actions">
            <button
              onClick={() => {
                updateSelected({ status: deriveNodeStatus(selectedNode) });
                setTimeout(commit, 0);
              }}
            >
              Status otomatis
            </button>
            <button onClick={duplicateSelected}>Duplikasi</button>
            <button onClick={splitSelected}>Urai 3 langkah</button>
          </div>
          <div className="dependencies">
            <h3>Relasi simpul</h3>
            {document.edges
              .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
              .map((edge) => {
                const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
                const other = document.nodes.find((node) => node.id === otherId);
                return (
                  <div key={edge.id}>
                    <span>{EDGE_RELATION_LABEL[edge.relation]} · {other?.title}</span>
                    <button
                      onClick={() => {
                        setSelectedNodeId(null);
                        setSelectedEdgeId(edge.id);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                );
              })}
          </div>
          <button className="danger-button" onClick={deleteSelected}>Hapus simpul</button>
            </>
          )}
          {selectedEdge && (
            <>
              <div className="panel-header pale">
                <div>
                  <span className="eyebrow">EDIT GARIS HUBUNGAN</span>
                  <h2>{EDGE_RELATION_LABEL[selectedEdge.relation]}</h2>
                </div>
                <button className="panel-close dark" onClick={() => setInspectorOpen(false)}>×</button>
              </div>
              <div className="relation-summary">
                <strong>
                  {document.nodes.find((node) => node.id === selectedEdge.source)?.title}
                </strong>
                <span>menuju</span>
                <strong>
                  {document.nodes.find((node) => node.id === selectedEdge.target)?.title}
                </strong>
              </div>
              <label>
                Fungsi hubungan
                <select
                  value={selectedEdge.relation}
                  onChange={(event) => {
                    updateSelectedEdge({
                      relation: event.target.value as EdgeRelation,
                    });
                    setTimeout(commit, 0);
                  }}
                >
                  {Object.entries(EDGE_RELATION_LABEL).map(([value, label]) => (
                    <option value={value} key={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label>
                Keterangan garis
                <textarea
                  value={selectedEdge.label}
                  onChange={(event) => updateSelectedEdge({ label: event.target.value })}
                  onBlur={commit}
                  placeholder="Jelaskan mengapa kedua simpul berhubungan..."
                />
              </label>
              <button
                className="smart-relation-button"
                onClick={() => {
                  const source = document.nodes.find((node) => node.id === selectedEdge.source);
                  const target = document.nodes.find((node) => node.id === selectedEdge.target);
                  if (source && target) {
                    updateSelectedEdge(inferEdgeRelation(source, target));
                    setTimeout(commit, 0);
                  }
                }}
              >
                Tulis keterangan otomatis
              </button>
              <button className="danger-button" onClick={() => removeEdge(selectedEdge.id)}>
                Hapus garis hubungan
              </button>
            </>
          )}
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

      {exportOpen && (
        <div className="modal-backdrop" onMouseDown={() => setExportOpen(false)}>
          <section
            className="export-sheet"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">EKSPOR STRATEGI</span>
                <h2>Pilih format hasil</h2>
                <p>
                  Peta selalu dimuat utuh. PDF memakai satu halaman poster A1
                  atau A0 yang siap dicetak.
                </p>
              </div>
              <button onClick={() => setExportOpen(false)}>×</button>
            </div>
            <div className="export-grid">
              <button
                onClick={() => exportStrategy("pdf")}
                disabled={exportBusy !== null}
              >
                <span>PDF</span>
                <strong>Report + poster</strong>
                <small>
                  Audit, input, sumber, dan seluruh map pada tepat satu halaman
                  poster.
                </small>
                <b>{exportBusy === "pdf" ? "Menyusun…" : "Unduh →"}</b>
              </button>
              <button
                onClick={() => exportStrategy("svg")}
                disabled={exportBusy !== null}
              >
                <span>SVG</span>
                <strong>Poster vektor</strong>
                <small>
                  Tajam pada ukuran cetak besar dan dapat diedit di aplikasi
                  desain.
                </small>
                <b>{exportBusy === "svg" ? "Menyusun…" : "Unduh →"}</b>
              </button>
              <button
                onClick={() => exportStrategy("docx")}
                disabled={exportBusy !== null}
              >
                <span>DOCX</span>
                <strong>Dokumen Word</strong>
                <small>
                  Audit, input, daftar simpul, hubungan, dan sumber yang mudah
                  disunting.
                </small>
                <b>{exportBusy === "docx" ? "Menyusun…" : "Unduh →"}</b>
              </button>
              <button
                onClick={() => exportStrategy("json")}
                disabled={exportBusy !== null}
              >
                <span>JSON</span>
                <strong>Backup lengkap</strong>
                <small>
                  Struktur node, garis, posisi, rubrik, dan audit untuk
                  pemulihan atau integrasi.
                </small>
                <b>{exportBusy === "json" ? "Menyusun…" : "Unduh →"}</b>
              </button>
            </div>
          </section>
        </div>
      )}

      {composerOpen && (
        <div className="modal-backdrop">
          <section className="composer">
            <button className="modal-x" onClick={() => setComposerOpen(false)}>×</button>
            <span className="composer-kicker"><i /> EMPAT AGENT, SATU STRATEGI</span>
            <h1>Tuangkan strategi selengkap mungkin.</h1>
            <p>Tempel ide singkat, rencana panjang, atau strategi terperinci. Agent akan menyempurnakan teks, memecahnya menjadi simpul sebanyak yang diperlukan, lalu mengaudit hasilnya.</p>
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
              <span>Teks strategi utama · tanpa batas karakter aplikasi</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Tuliskan seluruh inspirasi, tujuan, batas waktu, sumber daya, masalah, subgoal, risiko, ide alternatif, dan detail lain yang ingin dipertahankan dalam peta..."
                autoFocus
              />
              <small>{prompt.length.toLocaleString("id-ID")} karakter</small>
            </label>
            <input
              ref={textImportRef}
              className="visually-hidden"
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={importStrategyText}
            />
            <div className="composer-actions">
              <button className="demo-button" onClick={() => textImportRef.current?.click()}>
                Impor .txt / .md
              </button>
              <button className="demo-button" onClick={() => generateStrategy(true)}>Coba mode demo</button>
              <button className="generate-button" onClick={() => generateStrategy(false)} disabled={!prompt.trim()}>
                Buat peta strategi <span>→</span>
              </button>
            </div>
            <div className="agent-line">
              <span>Gemini 2.5 · Thinking</span>
              <i />
              <span>GPT-5.4 Mini · Worker</span>
              <i />
              <span>MiniMax M3 · Architect</span>
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
              <div><span>Thinking</span><strong>Gemini 2.5 Flash</strong><small>$0.30 / $2.50</small></div>
              <div><span>Worker</span><strong>GPT-5.4 Mini</strong><small>$0.75 / $4.50</small></div>
              <div><span>Architect</span><strong>MiniMax M3</strong><small>$0.30 / $1.20</small></div>
              <div><span>Auditor</span><strong>Qwen 3.7 Max</strong><small>$1.48 / $4.43</small></div>
            </div>
            <p className="pricing-note">Harga input / output per 1 juta token, terverifikasi dari katalog OpenRouter saat aplikasi disusun. Setiap role memiliki model failover otomatis jika endpoint utama sedang bermasalah.</p>
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
