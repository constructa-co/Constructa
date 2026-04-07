"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, FileSpreadsheet, FileText, Loader2, AlertTriangle, X, CheckCircle, ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import { parseBoQFromPdfAction, parseBoQFromExcelDataAction, createBoQEstimateAction, type ParsedClientBoQ } from "./boq-import-action";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

// ─── Load pdfjs dynamically (same pattern as drawings) ───────────────────────

async function loadPdfJs() {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    return pdfjs;
}

async function renderPdfToBase64Pages(file: File): Promise<string[]> {
    const pdfjs = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const pagesToRender = Math.min(pdf.numPages, 10);
    const pages: string[] = [];
    for (let i = 1; i <= pagesToRender; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;
        pages.push(canvas.toDataURL("image/jpeg", 0.85));
    }
    return pages;
}

// ─── Load SheetJS dynamically ─────────────────────────────────────────────────

async function parseExcelFile(file: File): Promise<string[][]> {
    const XLSX = await import("xlsx");
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    // Use first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as string[][];
    return rows.slice(0, 200); // cap at 200 rows for AI
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
    projectId: string;
    onImported: (estimateId: string, filename: string) => void;
    onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

type State = "idle" | "parsing" | "preview" | "importing" | "done" | "error";

export default function BoQImport({ projectId, onImported, onClose }: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [state, setState] = useState<State>("idle");
    const [error, setError] = useState<string | null>(null);
    const [boq, setBoq] = useState<ParsedClientBoQ | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    async function processFile(file: File) {
        setError(null);
        setBoq(null);

        if (file.size > MAX_SIZE_BYTES) {
            setError(`File is ${(file.size / 1024 / 1024).toFixed(0)}MB — please keep files under 25MB.`);
            return;
        }

        const isExcel = file.name.match(/\.(xlsx|xls|csv)$/i);
        const isPdf = file.name.match(/\.pdf$/i) || file.type === "application/pdf";

        if (!isExcel && !isPdf) {
            setError("Please upload an Excel file (.xlsx, .xls, .csv) or a PDF.");
            return;
        }

        setState("parsing");

        try {
            let result: { success: boolean; boq?: ParsedClientBoQ; error?: string };

            if (isExcel) {
                const rows = await parseExcelFile(file);
                result = await parseBoQFromExcelDataAction(rows, file.name);
            } else {
                const pages = await renderPdfToBase64Pages(file);
                result = await parseBoQFromPdfAction(pages, file.name);
            }

            if (!result || !result.success || !result.boq) {
                setError(result?.error || "Could not parse the file. Please check the format and try again.");
                setState("error");
                return;
            }

            setBoq(result.boq);
            // Expand first 3 sections by default
            setExpandedSections(new Set(result.boq.sections.slice(0, 3)));
            setState("preview");
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.");
            setState("error");
        }
    }

    async function handleImport() {
        if (!boq) return;
        setState("importing");
        try {
            const result = await createBoQEstimateAction(projectId, boq);
            if (!result || !result.success || !result.estimateId) {
                setError(result?.error || "Failed to create estimate.");
                setState("error");
                return;
            }
            setState("done");
            onImported(result.estimateId, boq.filename);
        } catch (err: any) {
            setError(err.message || "Import failed.");
            setState("error");
        }
    }

    function handleFileSelect(files: FileList | null) {
        if (!files || files.length === 0) return;
        processFile(files[0]);
    }

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    }, []);

    // Group lines by section for preview
    const groupedLines = boq?.lines.reduce<Record<string, typeof boq.lines>>((acc, line) => {
        const s = line.section || "General";
        if (!acc[s]) acc[s] = [];
        acc[s].push(line);
        return acc;
    }, {}) ?? {};

    const linesWithQty = boq?.lines.filter((l) => l.quantity != null && l.description?.trim()).length ?? 0;
    const linesBlank = boq?.lines.filter((l) => l.quantity == null && l.description?.trim()).length ?? 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">

                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700 flex-shrink-0">
                    <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <ClipboardList className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-white font-semibold text-sm">Import Client BoQ</h2>
                        <p className="text-slate-500 text-xs">Upload a client Bill of Quantities — preserves their sections and references</p>
                    </div>
                    <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-300 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">

                    {/* Upload zone */}
                    {(state === "idle" || state === "error") && (
                        <>
                            <div
                                onDrop={handleDrop}
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                                    isDragging
                                        ? "border-emerald-500 bg-emerald-500/10"
                                        : "border-slate-600 hover:border-slate-500 bg-slate-800/40"
                                }`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv,.pdf"
                                    className="hidden"
                                    onChange={(e) => handleFileSelect(e.target.files)}
                                />
                                <div className="flex justify-center gap-4 mb-3">
                                    <FileSpreadsheet className="w-8 h-8 text-emerald-400/60" />
                                    <FileText className="w-8 h-8 text-blue-400/60" />
                                </div>
                                <p className="text-slate-200 font-medium mb-1">Drop your client BoQ here</p>
                                <p className="text-slate-400 text-sm mb-3">Excel (.xlsx, .xls, .csv) or PDF · Max 25MB</p>
                                <p className="text-slate-600 text-xs">Client refs, section headings and quantities are preserved exactly</p>
                            </div>

                            {error && (
                                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-red-300 text-sm">{error}</p>
                                </div>
                            )}
                        </>
                    )}

                    {/* Parsing */}
                    {state === "parsing" && (
                        <div className="py-12 text-center">
                            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
                            <p className="text-white font-medium text-sm">Parsing your BoQ…</p>
                            <p className="text-slate-500 text-xs mt-1">AI is reading sections, references and quantities</p>
                        </div>
                    )}

                    {/* Preview */}
                    {state === "preview" && boq && (
                        <>
                            {/* Summary strip */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-white">{boq.lines.filter(l => l.description?.trim()).length}</p>
                                    <p className="text-slate-500 text-xs mt-0.5">Line items</p>
                                </div>
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-white">{boq.sections.length}</p>
                                    <p className="text-slate-500 text-xs mt-0.5">Sections</p>
                                </div>
                                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-white">{linesWithQty}</p>
                                    <p className="text-slate-500 text-xs mt-0.5">
                                        With quantities
                                        {linesBlank > 0 && <span className="text-amber-400"> · {linesBlank} blank</span>}
                                    </p>
                                </div>
                            </div>

                            {/* Line preview grouped by section */}
                            <div className="border border-slate-700 rounded-xl overflow-hidden">
                                <div className="px-4 py-2.5 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Preview — {boq.filename}</span>
                                    <span className="text-xs text-slate-500">Scroll to review</span>
                                </div>
                                <div className="max-h-72 overflow-y-auto divide-y divide-slate-700/40">
                                    {Object.entries(groupedLines).map(([section, lines]) => (
                                        <div key={section}>
                                            <button
                                                onClick={() => setExpandedSections(prev => {
                                                    const next = new Set(prev);
                                                    next.has(section) ? next.delete(section) : next.add(section);
                                                    return next;
                                                })}
                                                className="w-full flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-700/40 transition-colors text-left"
                                            >
                                                {expandedSections.has(section)
                                                    ? <ChevronDown className="w-3 h-3 text-slate-500" />
                                                    : <ChevronRight className="w-3 h-3 text-slate-500" />
                                                }
                                                <span className="text-slate-300 text-xs font-semibold uppercase tracking-wider flex-1">{section}</span>
                                                <span className="text-slate-600 text-xs">{lines.filter(l => l.description?.trim()).length} items</span>
                                            </button>
                                            {expandedSections.has(section) && lines.filter(l => l.description?.trim()).map((line, i) => (
                                                <div key={i} className="flex items-start gap-3 px-4 py-2 hover:bg-slate-800/20">
                                                    {line.client_ref && (
                                                        <span className="text-slate-600 text-xs font-mono w-10 flex-shrink-0 pt-0.5">{line.client_ref}</span>
                                                    )}
                                                    <span className="text-slate-300 text-xs flex-1">{line.description}</span>
                                                    <span className="text-slate-500 text-xs font-mono whitespace-nowrap">
                                                        {line.quantity != null ? `${line.quantity} ${line.unit}` : <span className="text-amber-500/70">qty TBC</span>}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {linesBlank > 0 && (
                                <p className="text-amber-400/80 text-xs flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    {linesBlank} items have no quantity — these will be imported with qty = 1 as a placeholder
                                </p>
                            )}
                        </>
                    )}

                    {/* Importing */}
                    {state === "importing" && (
                        <div className="py-12 text-center">
                            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
                            <p className="text-white font-medium text-sm">Creating estimate…</p>
                        </div>
                    )}

                    {/* Done */}
                    {state === "done" && (
                        <div className="py-12 text-center">
                            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                            <p className="text-white font-medium">BoQ imported successfully</p>
                            <p className="text-slate-400 text-sm mt-1">Add your rates in the estimate, then export to Excel</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {(state === "preview" || state === "done") && (
                    <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-700 flex-shrink-0">
                        {state === "preview" ? (
                            <>
                                <button
                                    onClick={() => { setState("idle"); setBoq(null); setError(null); }}
                                    className="text-sm text-slate-500 hover:text-slate-400 transition-colors"
                                >
                                    Upload different file
                                </button>
                                <button
                                    onClick={handleImport}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    <ClipboardList className="w-4 h-4" />
                                    Import {boq?.lines.filter(l => l.description?.trim()).length} items
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={onClose}
                                className="ml-auto px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                Go to Estimate
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
