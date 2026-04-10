"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X, ZoomIn, ZoomOut, Maximize2, Ruler, MousePointer,
  Triangle, Hash, Target, ChevronLeft, ChevronRight,
  PlusCircle, Trash2, Download,
} from "lucide-react";
import { saveMeasurementsAction, addMeasurementsToEstimateAction } from "./measure-actions";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tool = "pan" | "calibrate" | "linear" | "area" | "count";

interface Point { x: number; y: number }

interface Measurement {
  id: string;
  type: "linear" | "area" | "count";
  points: Point[];
  value: number;       // metres, m², or count
  unit: string;
  label: string;
  tradeSection: string;
}

interface CalibrationState {
  points: Point[];     // 0 or 2 points
  realDistance: number | null;  // metres
  pxPerMetre: number | null;
}

interface Props {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dist(a: Point, b: Point) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function polygonArea(pts: Point[]) {
  // Shoelace formula
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

function fmtValue(m: Measurement) {
  if (m.type === "count") return `${m.value} items`;
  const v = m.value;
  if (m.unit === "m²") return `${v.toFixed(2)} m²`;
  if (v < 1) return `${(v * 1000).toFixed(0)} mm`;
  return `${v.toFixed(3)} m`;
}

const TRADE_SECTIONS = [
  "Groundworks", "Concrete", "Masonry", "Carpentry & Joinery",
  "Roofing", "Cladding & Curtain Walling", "Windows & Doors",
  "Finishes", "Mechanical", "Electrical", "Drainage",
  "Landscaping", "General", "Other",
];

const TOOL_INFO: Record<Tool, { icon: React.ElementType; label: string; hint: string }> = {
  pan:       { icon: MousePointer, label: "Pan",       hint: "Click and drag to pan" },
  calibrate: { icon: Target,       label: "Calibrate", hint: "Click 2 points of known distance" },
  linear:    { icon: Ruler,        label: "Linear",    hint: "Click start then end point" },
  area:      { icon: Triangle,     label: "Area",      hint: "Click points, double-click to close" },
  count:     { icon: Hash,         label: "Count",     hint: "Click to place markers" },
};

// ── PDF loader ────────────────────────────────────────────────────────────────

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  return pdfjs;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DrawingViewer({ projectId, projectName, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<Point>({ x: 0, y: 0 });
  const panOrigin = useRef<Point>({ x: 0, y: 0 });

  const [tool, setTool] = useState<Tool>("pan");
  const [calibration, setCalibration] = useState<CalibrationState>({ points: [], realDistance: null, pxPerMetre: null });
  const [calibDistInput, setCalibDistInput] = useState("");
  const [showCalibInput, setShowCalibInput] = useState(false);

  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [activePts, setActivePts] = useState<Point[]>([]);    // in-progress measurement
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [selectedMeasId, setSelectedMeasId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [addToEstModal, setAddToEstModal] = useState(false);
  const [addingToEst, setAddingToEst] = useState(false);
  const [addResult, setAddResult] = useState<string | null>(null);

  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);

  // ── Render PDF page ──────────────────────────────────────────────────────

  const renderPage = useCallback(async (doc: any, pageNum: number) => {
    if (!pdfCanvasRef.current) return;
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.5 }); // High res for accurate measurement
    const canvas = pdfCanvasRef.current;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;
    // Match overlay canvas size
    if (overlayRef.current) {
      overlayRef.current.width = viewport.width;
      overlayRef.current.height = viewport.height;
    }
  }, []);

  // ── File upload ──────────────────────────────────────────────────────────

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setLoading(true);
    setMeasurements([]);
    setActivePts([]);
    setCalibration({ points: [], realDistance: null, pxPerMetre: null });
    setZoom(1);
    setPan({ x: 0, y: 0 });

    if (f.type === "application/pdf") {
      const pdfjs = await loadPdfJs();
      const ab = await f.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: ab }).promise;
      pdfDocRef.current = doc;
      setPageCount(doc.numPages);
      setCurrentPage(1);
      await renderPage(doc, 1);
    } else {
      // Image file — draw directly to canvas
      pdfDocRef.current = null;
      setPageCount(1);
      setCurrentPage(1);
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.onload = () => {
        if (!pdfCanvasRef.current) return;
        const canvas = pdfCanvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        if (overlayRef.current) {
          overlayRef.current.width = img.width;
          overlayRef.current.height = img.height;
        }
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
    setLoading(false);
  }, [renderPage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // ── Page navigation ──────────────────────────────────────────────────────

  const goToPage = useCallback(async (p: number) => {
    if (!pdfDocRef.current || p < 1 || p > pageCount) return;
    setCurrentPage(p);
    setActivePts([]);
    await renderPage(pdfDocRef.current, p);
  }, [pageCount, renderPage]);

  // ── Canvas coordinate conversion ─────────────────────────────────────────
  // Convert mouse client coords → canvas coords (accounting for zoom/pan/CSS transform)

  const toCanvasCoords = useCallback((clientX: number, clientY: number): Point => {
    const overlay = overlayRef.current;
    if (!overlay) return { x: 0, y: 0 };
    const rect = overlay.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    };
  }, [zoom]);

  // ── Draw overlay ─────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pxPerM = calibration.pxPerMetre ?? 100; // default fallback

    // ── Draw completed measurements ────────────────────────────────────────
    for (const m of measurements) {
      const isSelected = m.id === selectedMeasId;
      ctx.strokeStyle = isSelected ? "#f59e0b" : "#3b82f6";
      ctx.fillStyle   = isSelected ? "#f59e0b" : "#3b82f6";
      ctx.lineWidth   = 2 / zoom;

      if (m.type === "linear" && m.points.length === 2) {
        ctx.beginPath();
        ctx.moveTo(m.points[0].x, m.points[0].y);
        ctx.lineTo(m.points[1].x, m.points[1].y);
        ctx.stroke();
        // Endcap ticks
        const a = Math.atan2(m.points[1].y - m.points[0].y, m.points[1].x - m.points[0].x);
        const tick = 6 / zoom;
        for (const pt of m.points) {
          ctx.beginPath();
          ctx.moveTo(pt.x - Math.sin(a) * tick, pt.y + Math.cos(a) * tick);
          ctx.lineTo(pt.x + Math.sin(a) * tick, pt.y - Math.cos(a) * tick);
          ctx.stroke();
        }
        // Label
        const mid = { x: (m.points[0].x + m.points[1].x) / 2, y: (m.points[0].y + m.points[1].y) / 2 };
        ctx.font = `${12 / zoom}px sans-serif`;
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 3 / zoom;
        const labelText = m.label ? `${m.label}: ${fmtValue(m)}` : fmtValue(m);
        ctx.strokeText(labelText, mid.x + 4 / zoom, mid.y - 4 / zoom);
        ctx.fillText(labelText, mid.x + 4 / zoom, mid.y - 4 / zoom);
      }

      if (m.type === "area" && m.points.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(m.points[0].x, m.points[0].y);
        for (let i = 1; i < m.points.length; i++) ctx.lineTo(m.points[i].x, m.points[i].y);
        ctx.closePath();
        ctx.strokeStyle = isSelected ? "#f59e0b" : "#10b981";
        ctx.fillStyle = isSelected ? "rgba(245,158,11,0.12)" : "rgba(16,185,129,0.12)";
        ctx.stroke();
        ctx.fill();
        // Label at centroid
        const cx = m.points.reduce((s, p) => s + p.x, 0) / m.points.length;
        const cy = m.points.reduce((s, p) => s + p.y, 0) / m.points.length;
        ctx.font = `${12 / zoom}px sans-serif`;
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 3 / zoom;
        const aLabel = m.label ? `${m.label}: ${fmtValue(m)}` : fmtValue(m);
        ctx.strokeText(aLabel, cx, cy);
        ctx.fillStyle = "#10b981";
        ctx.fillText(aLabel, cx, cy);
      }

      if (m.type === "count") {
        for (const pt of m.points) {
          const r = 6 / zoom;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? "#f59e0b" : "#8b5cf6";
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5 / zoom;
          ctx.stroke();
        }
        if (m.points.length > 0) {
          const pt = m.points[m.points.length - 1];
          ctx.font = `${11 / zoom}px sans-serif`;
          ctx.fillStyle = "#fff";
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.lineWidth = 3 / zoom;
          const cLabel = m.label ? `${m.label}: ${m.value}` : `×${m.value}`;
          ctx.strokeText(cLabel, pt.x + 8 / zoom, pt.y - 4 / zoom);
          ctx.fillStyle = "#8b5cf6";
          ctx.fillText(cLabel, pt.x + 8 / zoom, pt.y - 4 / zoom);
        }
      }
    }

    // ── Draw calibration points ────────────────────────────────────────────
    for (const pt of calibration.points) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
    }
    if (calibration.points.length === 2) {
      ctx.beginPath();
      ctx.moveTo(calibration.points[0].x, calibration.points[0].y);
      ctx.lineTo(calibration.points[1].x, calibration.points[1].y);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([6 / zoom, 3 / zoom]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── Draw in-progress measurement ──────────────────────────────────────
    if (activePts.length > 0 && mousePos) {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);

      if (tool === "linear") {
        ctx.beginPath();
        ctx.moveTo(activePts[0].x, activePts[0].y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();
        // Live distance
        const livePx = dist(activePts[0], mousePos);
        const liveM = calibration.pxPerMetre ? livePx / calibration.pxPerMetre : null;
        if (liveM !== null) {
          const mid = { x: (activePts[0].x + mousePos.x) / 2, y: (activePts[0].y + mousePos.y) / 2 };
          ctx.font = `${11 / zoom}px sans-serif`;
          ctx.fillStyle = "#fbbf24";
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.lineWidth = 3 / zoom;
          const t = liveM < 1 ? `${(liveM * 1000).toFixed(0)} mm` : `${liveM.toFixed(3)} m`;
          ctx.strokeText(t, mid.x + 4 / zoom, mid.y - 4 / zoom);
          ctx.fillText(t, mid.x + 4 / zoom, mid.y - 4 / zoom);
        }
      }

      if (tool === "area") {
        ctx.beginPath();
        ctx.moveTo(activePts[0].x, activePts[0].y);
        for (let i = 1; i < activePts.length; i++) ctx.lineTo(activePts[i].x, activePts[i].y);
        ctx.lineTo(mousePos.x, mousePos.y);
        ctx.stroke();
      }

      ctx.setLineDash([]);
      // Draw placed points
      for (const pt of activePts) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4 / zoom, 0, Math.PI * 2);
        ctx.fillStyle = "#fbbf24";
        ctx.fill();
      }
    }

  }, [measurements, calibration, activePts, mousePos, tool, zoom, selectedMeasId]);

  // ── Mouse handlers ────────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pt = toCanvasCoords(e.clientX, e.clientY);

    if (tool === "pan") {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      panOrigin.current = { ...pan };
      return;
    }

    if (tool === "calibrate") {
      setCalibration(prev => {
        const pts = prev.points.length < 2 ? [...prev.points, pt] : [pt];
        if (pts.length === 2) setShowCalibInput(true);
        return { ...prev, points: pts };
      });
      return;
    }

    if (tool === "linear") {
      if (activePts.length === 0) {
        setActivePts([pt]);
      } else {
        // Complete the measurement
        const pxDist = dist(activePts[0], pt);
        const metres = calibration.pxPerMetre ? pxDist / calibration.pxPerMetre : pxDist;
        const m: Measurement = {
          id: crypto.randomUUID(),
          type: "linear",
          points: [activePts[0], pt],
          value: metres,
          unit: "m",
          label: "",
          tradeSection: "",
        };
        setMeasurements(prev => [...prev, m]);
        setActivePts([]);
        setSelectedMeasId(m.id);
      }
      return;
    }

    if (tool === "area") {
      // Double-click (or close to first point) closes the polygon
      if (activePts.length >= 3 && dist(pt, activePts[0]) < 12 / zoom) {
        const pxArea = polygonArea(activePts);
        const m2 = calibration.pxPerMetre
          ? pxArea / (calibration.pxPerMetre ** 2)
          : pxArea;
        const m: Measurement = {
          id: crypto.randomUUID(),
          type: "area",
          points: activePts,
          value: m2,
          unit: "m²",
          label: "",
          tradeSection: "",
        };
        setMeasurements(prev => [...prev, m]);
        setActivePts([]);
        setSelectedMeasId(m.id);
      } else {
        setActivePts(prev => [...prev, pt]);
      }
      return;
    }

    if (tool === "count") {
      // Add point to active count, or start new
      setActivePts(prev => {
        const next = [...prev, pt];
        // Update live count measurement — replace or add
        setMeasurements(mPrev => {
          const existing = mPrev.find(m => m.type === "count" && m.id === selectedMeasId);
          if (existing) {
            return mPrev.map(m => m.id === existing.id
              ? { ...m, points: [...m.points, pt], value: m.points.length + 1 }
              : m
            );
          }
          const newM: Measurement = {
            id: crypto.randomUUID(),
            type: "count",
            points: [pt],
            value: 1,
            unit: "items",
            label: "",
            tradeSection: "",
          };
          setSelectedMeasId(newM.id);
          return [...mPrev, newM];
        });
        return [];
      });
    }
  }, [tool, pan, activePts, calibration, zoom, toCanvasCoords, selectedMeasId]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pt = toCanvasCoords(e.clientX, e.clientY);
    setMousePos(pt);

    if (isPanning && tool === "pan") {
      setPan({
        x: panOrigin.current.x + (e.clientX - panStart.current.x),
        y: panOrigin.current.y + (e.clientY - panStart.current.y),
      });
    }
  }, [toCanvasCoords, isPanning, tool]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleDblClick = useCallback((e: React.MouseEvent) => {
    if (tool === "area" && activePts.length >= 3) {
      const pxArea = polygonArea(activePts);
      const m2 = calibration.pxPerMetre
        ? pxArea / (calibration.pxPerMetre ** 2)
        : pxArea;
      const m: Measurement = {
        id: crypto.randomUUID(),
        type: "area",
        points: activePts,
        value: m2,
        unit: "m²",
        label: "",
        tradeSection: "",
      };
      setMeasurements(prev => [...prev, m]);
      setActivePts([]);
      setSelectedMeasId(m.id);
    }
  }, [tool, activePts, calibration.pxPerMetre]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setZoom(z => Math.max(0.2, Math.min(8, z * factor)));
  }, []);

  // ── Calibration confirm ───────────────────────────────────────────────────

  function confirmCalibration() {
    const d = parseFloat(calibDistInput);
    if (!d || d <= 0 || calibration.points.length < 2) return;
    const pxDist = dist(calibration.points[0], calibration.points[1]);
    const pxPerM = pxDist / d;
    setCalibration(prev => ({ ...prev, pxPerMetre: pxPerM, realDistance: d }));
    setShowCalibInput(false);
    setCalibDistInput("");
    setTool("linear"); // Auto-switch to measuring
  }

  // ── Save measurements ─────────────────────────────────────────────────────

  async function handleSave() {
    if (!file || measurements.length === 0) return;
    setSaving(true);
    await saveMeasurementsAction({
      projectId,
      drawingName: file.name,
      scalePxPerM: calibration.pxPerMetre ?? null,
      measurements: measurements.map(m => ({
        type: m.type,
        label: m.label,
        value: m.value,
        unit: m.unit,
        tradeSection: m.tradeSection,
        points: m.points,
      })),
    });
    setSaving(false);
  }

  // ── Add to estimate ───────────────────────────────────────────────────────

  async function handleAddToEstimate() {
    if (measurements.length === 0) return;
    setAddingToEst(true);
    const result = await addMeasurementsToEstimateAction(
      projectId,
      measurements.map(m => ({
        label: m.label || (m.type === "linear" ? "Linear measurement" : m.type === "area" ? "Area measurement" : "Count"),
        value: m.value,
        unit: m.unit,
        tradeSection: m.tradeSection || "General",
      }))
    );
    setAddingToEst(false);
    setAddResult(result.success ? `✓ ${result.added} item${result.added !== 1 ? "s" : ""} added to estimate` : `Error: ${result.error}`);
    if (result.success) setAddToEstModal(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-[#0d0d0d] z-50 flex flex-col">
      {/* Top toolbar */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-white/10 bg-[#141414] flex-shrink-0">
        <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-all">
          <X className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-white truncate max-w-xs">
          {file ? file.name : "Drawing Viewer & Measure"}
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-white/10 text-slate-400 disabled:opacity-30 transition-all">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs text-slate-400 px-1">{currentPage} / {pageCount}</span>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= pageCount}
              className="p-1 rounded hover:bg-white/10 text-slate-400 disabled:opacity-30 transition-all">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(0.2, z / 1.2))}
            className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-slate-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(8, z * 1.2))}
            className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-all" title="Reset view">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Calibration status */}
        {calibration.pxPerMetre && (
          <span className="text-xs px-2 py-1 bg-emerald-500/15 text-emerald-400 rounded-full">
            Scale set · {(calibration.pxPerMetre).toFixed(1)} px/m
          </span>
        )}
        {!calibration.pxPerMetre && file && (
          <span className="text-xs px-2 py-1 bg-amber-500/15 text-amber-400 rounded-full">
            Scale not calibrated
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left tool panel */}
        {file && (
          <div className="w-14 bg-[#141414] border-r border-white/10 flex flex-col items-center py-3 gap-1 flex-shrink-0">
            {(Object.keys(TOOL_INFO) as Tool[]).map(t => {
              const { icon: Icon, label, hint } = TOOL_INFO[t];
              return (
                <button key={t} onClick={() => { setTool(t); setActivePts([]); }}
                  title={`${label}: ${hint}`}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                    tool === t ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}>
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
            <div className="flex-1" />
            {measurements.length > 0 && (
              <>
                <button onClick={handleSave} disabled={saving} title="Save measurements"
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-emerald-400 transition-all disabled:opacity-50">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => setAddToEstModal(true)} title="Add to estimate"
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-blue-400 transition-all">
                  <PlusCircle className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}

        {/* Canvas area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative bg-slate-900"
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onWheel={handleWheel}
          style={{ cursor: tool === "pan" ? (isPanning ? "grabbing" : "grab") : "crosshair" }}
        >
          {!file ? (
            // Upload drop zone
            <div className="absolute inset-0 flex items-center justify-center">
              <label className="flex flex-col items-center gap-4 cursor-pointer group">
                <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-white/20 group-hover:border-blue-500/60 flex items-center justify-center transition-all">
                  <Ruler className="w-8 h-8 text-slate-500 group-hover:text-blue-400 transition-all" />
                </div>
                <div className="text-center">
                  <p className="text-white font-medium">Drop a drawing here</p>
                  <p className="text-slate-500 text-sm mt-1">PDF, PNG, JPG, WebP supported</p>
                </div>
                <input type="file" accept=".pdf,image/png,image/jpeg,image/webp" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </label>
            </div>
          ) : loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Rendering drawing…</p>
              </div>
            </div>
          ) : (
            <div
              className="absolute"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "top left",
              }}
            >
              <canvas ref={pdfCanvasRef} className="block" />
              <canvas
                ref={overlayRef}
                className="absolute top-0 left-0 block"
                style={{ opacity: 1 }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => { setMousePos(null); setIsPanning(false); }}
                onDoubleClick={handleDblClick}
              />
            </div>
          )}
        </div>

        {/* Right panel — measurements */}
        {file && (
          <div className="w-64 bg-[#141414] border-l border-white/10 flex flex-col flex-shrink-0">
            <div className="px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white">Measurements</h3>
              <p className="text-xs text-slate-500 mt-0.5">{TOOL_INFO[tool].hint}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {measurements.length === 0 ? (
                <p className="text-slate-600 text-xs text-center py-8 px-3">
                  {calibration.pxPerMetre
                    ? "Select a tool and click to measure"
                    : "Calibrate scale first, then measure"}
                </p>
              ) : (
                measurements.map(m => (
                  <div key={m.id}
                    onClick={() => setSelectedMeasId(m.id === selectedMeasId ? null : m.id)}
                    className={`rounded-lg p-2.5 cursor-pointer transition-all ${
                      selectedMeasId === m.id ? "bg-blue-600/20 border border-blue-500/40" : "bg-white/3 border border-white/5 hover:bg-white/5"
                    }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <input
                          value={m.label}
                          onChange={e => setMeasurements(prev => prev.map(x => x.id === m.id ? { ...x, label: e.target.value } : x))}
                          onClick={e => e.stopPropagation()}
                          placeholder={m.type === "linear" ? "Label…" : m.type === "area" ? "Label…" : "Label…"}
                          className="w-full bg-transparent text-xs text-white placeholder:text-slate-600 focus:outline-none border-b border-transparent focus:border-white/20"
                        />
                        <p className={`text-xs font-mono mt-1 ${
                          m.type === "linear" ? "text-blue-400" :
                          m.type === "area" ? "text-emerald-400" : "text-purple-400"
                        }`}>{fmtValue(m)}</p>
                        <select
                          value={m.tradeSection}
                          onChange={e => setMeasurements(prev => prev.map(x => x.id === m.id ? { ...x, tradeSection: e.target.value } : x))}
                          onClick={e => e.stopPropagation()}
                          className="mt-1 w-full bg-white/5 border border-white/10 rounded text-xs text-slate-400 px-1.5 py-0.5 focus:outline-none">
                          <option value="">Trade section…</option>
                          {TRADE_SECTIONS.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setMeasurements(prev => prev.filter(x => x.id !== m.id)); if (selectedMeasId === m.id) setSelectedMeasId(null); }}
                        className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {measurements.length > 0 && (
              <div className="p-3 border-t border-white/10">
                {addResult && (
                  <p className={`text-xs mb-2 ${addResult.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{addResult}</p>
                )}
                <button onClick={() => setAddToEstModal(true)}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-all">
                  Add to Estimate
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tool hint bar */}
      {file && (
        <div className="h-8 bg-[#141414] border-t border-white/10 flex items-center px-4 gap-4 text-xs text-slate-500 flex-shrink-0">
          <span>Tool: <span className="text-slate-300">{TOOL_INFO[tool].label}</span></span>
          {tool === "area" && activePts.length > 0 && <span className="text-amber-400">{activePts.length} points — double-click or click first point to close</span>}
          {tool === "linear" && activePts.length === 1 && <span className="text-amber-400">Click second point to complete</span>}
          {tool === "calibrate" && calibration.points.length === 0 && <span>Click first point of known distance</span>}
          {tool === "calibrate" && calibration.points.length === 1 && <span className="text-amber-400">Click second point</span>}
          <span className="ml-auto">Scroll to zoom · Pan tool to drag</span>
        </div>
      )}

      {/* Calibration distance input modal */}
      {showCalibInput && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-5 w-72 space-y-3">
            <h3 className="text-white font-semibold text-sm">Set Scale</h3>
            <p className="text-slate-400 text-xs">What is the real-world distance between the two points you marked?</p>
            <div className="flex gap-2">
              <input autoFocus type="number" step="0.001" min="0.001"
                value={calibDistInput}
                onChange={e => setCalibDistInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") confirmCalibration(); }}
                placeholder="e.g. 5.0"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
              <span className="flex items-center text-sm text-slate-400">metres</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowCalibInput(false); setCalibration(prev => ({ ...prev, points: [] })); }}
                className="flex-1 py-2 rounded-lg bg-white/5 text-slate-300 text-sm font-medium hover:bg-white/10 transition-all">
                Cancel
              </button>
              <button onClick={confirmCalibration}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all">
                Set Scale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to estimate modal */}
      {addToEstModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-5 w-80 space-y-3">
            <h3 className="text-white font-semibold text-sm">Add Measurements to Estimate</h3>
            <p className="text-slate-400 text-xs">{measurements.length} measurement{measurements.length !== 1 ? "s" : ""} will be added as estimate line items. Label and trade section each measurement in the panel before adding.</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {measurements.map(m => (
                <div key={m.id} className="flex items-center justify-between text-xs bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-slate-300 truncate">{m.label || `${m.type} measurement`}</span>
                  <span className="text-blue-400 font-mono ml-2 flex-shrink-0">{fmtValue(m)}</span>
                </div>
              ))}
            </div>
            {addResult && (
              <p className={`text-xs ${addResult.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{addResult}</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setAddToEstModal(false); setAddResult(null); }}
                className="flex-1 py-2 rounded-lg bg-white/5 text-slate-300 text-sm font-medium hover:bg-white/10 transition-all">
                Cancel
              </button>
              <button onClick={handleAddToEstimate} disabled={addingToEst}
                className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all disabled:opacity-50">
                {addingToEst ? "Adding…" : "Add to Estimate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
