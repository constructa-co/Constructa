"use client";

import { useCallback, useRef, useState } from "react";
import {
    Upload,
    FileImage,
    Loader2,
    CheckSquare,
    Square,
    PlusCircle,
    ChevronDown,
    ChevronRight,
    AlertTriangle,
    X,
    FolderOpen,
    Layers,
} from "lucide-react";
import type { DrawingExtraction, DrawingResultItem } from "./actions";
import { analyzeDrawingPagesAction, addItemsToEstimateAction } from "./actions";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
    projectId: string;
    projectName: string;
    initialExtractions: DrawingExtraction[];
}

type UploadState = "idle" | "rendering" | "analysing" | "done" | "error";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const CAD_EXTENSIONS = [".dwg", ".dxf", ".rvt", ".rfa", ".skp", ".3dm", ".ifc", ".nwd"];

// ─── Helper: format file size ─────────────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Helper: load pdfjs dynamically ──────────────────────────────────────────

async function loadPdfJs() {
    const pdfjs = await import("pdfjs-dist");
    // Use unpkg CDN worker — cdnjs lags behind; pdfjs v5+ uses .mjs extension
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    return pdfjs;
}

// ─── Helper: render PDF pages to base64 PNG ───────────────────────────────────

async function renderPdfToBase64Pages(
    file: File,
    onProgress?: (current: number, total: number) => void
): Promise<{ base64Pages: string[]; pageCount: number }> {
    const pdfjs = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;
    const pagesToRender = Math.min(pageCount, 10);
    const base64Pages: string[] = [];

    for (let i = 1; i <= pagesToRender; i++) {
        const page = await pdf.getPage(i);
        // Scale for good resolution without being huge — 1.5x is ~96dpi for A4
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx as any, viewport, canvas }).promise;
        // Compress as JPEG to keep payload manageable (~200-400KB per page)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        base64Pages.push(dataUrl);
        onProgress?.(i, pagesToRender);
    }

    return { base64Pages, pageCount };
}

// ─── Helper: load image file as base64 ───────────────────────────────────────

async function imageFileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ─── Extraction Results Panel ─────────────────────────────────────────────────

function ExtractionResultsPanel({
    extraction,
    projectId,
    onDismiss,
}: {
    extraction: DrawingExtraction;
    projectId: string;
    onDismiss: () => void;
}) {
    const [selected, setSelected] = useState<Set<number>>(
        new Set(extraction.extracted_items.map((_, i) => i))
    );
    const [adding, setAdding] = useState(false);
    const [addResult, setAddResult] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    // Group by trade section
    const grouped = extraction.extracted_items.reduce<Record<string, { item: DrawingResultItem; index: number }[]>>(
        (acc, item, index) => {
            const section = item.trade_section || "General";
            if (!acc[section]) acc[section] = [];
            acc[section].push({ item, index });
            return acc;
        },
        {}
    );

    // Initialise all sections expanded
    const allSections = Object.keys(grouped);
    const [initDone, setInitDone] = useState(false);
    if (!initDone && allSections.length > 0) {
        setExpandedSections(new Set(allSections));
        setInitDone(true);
    }

    function toggleItem(index: number) {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(index) ? next.delete(index) : next.add(index);
            return next;
        });
    }

    function toggleSection(section: string) {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            next.has(section) ? next.delete(section) : next.add(section);
            return next;
        });
    }

    function selectAll() {
        setSelected(new Set(extraction.extracted_items.map((_, i) => i)));
    }
    function selectNone() {
        setSelected(new Set());
    }

    async function handleAddToEstimate() {
        const itemsToAdd = extraction.extracted_items.filter((_, i) => selected.has(i));
        if (itemsToAdd.length === 0) return;
        setAdding(true);
        setAddResult(null);
        const result = await addItemsToEstimateAction(projectId, itemsToAdd);
        setAdding(false);
        if (result.success) {
            setAddResult(`✓ ${result.added} item${result.added !== 1 ? "s" : ""} added to estimate`);
        } else {
            setAddResult(`Error: ${result.error}`);
        }
    }

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                <div>
                    <h3 className="text-white font-semibold text-sm">{extraction.filename}</h3>
                    <p className="text-slate-400 text-xs mt-0.5">
                        {extraction.pages_processed} page{extraction.pages_processed !== 1 ? "s" : ""} analysed
                        {extraction.file_size_kb ? ` · ${formatBytes(extraction.file_size_kb * 1024)}` : ""}
                        {" · "}{extraction.extracted_items.length} items extracted
                    </p>
                </div>
                <button onClick={onDismiss} className="text-slate-500 hover:text-slate-300 transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-700/50 bg-slate-800/60">
                <span className="text-slate-400 text-xs">{selected.size} of {extraction.extracted_items.length} selected</span>
                <button onClick={selectAll} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">All</button>
                <button onClick={selectNone} className="text-xs text-slate-400 hover:text-slate-300 transition-colors">None</button>
            </div>

            {/* Items grouped by trade section */}
            <div className="divide-y divide-slate-700/40 max-h-[480px] overflow-y-auto">
                {allSections.map((section) => {
                    const isExpanded = expandedSections.has(section);
                    const sectionItems = grouped[section];
                    const sectionSelected = sectionItems.filter((s) => selected.has(s.index)).length;

                    return (
                        <div key={section}>
                            {/* Section header */}
                            <button
                                onClick={() => toggleSection(section)}
                                className="w-full flex items-center gap-2 px-5 py-2.5 bg-slate-750 hover:bg-slate-700/50 transition-colors text-left"
                            >
                                {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                )}
                                <span className="text-slate-300 text-xs font-semibold uppercase tracking-wider flex-1">
                                    {section}
                                </span>
                                <span className="text-slate-500 text-xs">
                                    {sectionSelected}/{sectionItems.length}
                                </span>
                            </button>

                            {/* Section items */}
                            {isExpanded && sectionItems.map(({ item, index }) => (
                                <button
                                    key={index}
                                    onClick={() => toggleItem(index)}
                                    className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-slate-700/30 transition-colors text-left"
                                >
                                    {selected.has(index) ? (
                                        <CheckSquare className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                    ) : (
                                        <Square className="w-4 h-4 text-slate-600 flex-shrink-0" />
                                    )}
                                    <span className="text-slate-200 text-sm flex-1">{item.item_name}</span>
                                    <span className="text-slate-400 text-xs font-mono whitespace-nowrap">
                                        {item.estimated_quantity} {item.unit}
                                    </span>
                                </button>
                            ))}
                        </div>
                    );
                })}

                {extraction.extracted_items.length === 0 && (
                    <div className="px-5 py-8 text-center text-slate-500 text-sm">
                        No items could be extracted from this drawing.
                    </div>
                )}
            </div>

            {/* Footer CTA */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-700 bg-slate-800/80">
                {addResult ? (
                    <span className={`text-sm ${addResult.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
                        {addResult}
                    </span>
                ) : (
                    <span className="text-slate-500 text-xs">
                        Items will be added to your active estimate
                    </span>
                )}
                <button
                    onClick={handleAddToEstimate}
                    disabled={adding || selected.size === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                    {adding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <PlusCircle className="w-4 h-4" />
                    )}
                    Add {selected.size > 0 ? `${selected.size} ` : ""}to Estimate
                </button>
            </div>
        </div>
    );
}

// ─── Drawing Register (past extractions) ─────────────────────────────────────

function DrawingRegister({
    extractions,
    projectId,
}: {
    extractions: DrawingExtraction[];
    projectId: string;
}) {
    const [expanded, setExpanded] = useState<string | null>(null);
    const [addResults, setAddResults] = useState<Record<string, string>>({});
    const [addingFor, setAddingFor] = useState<string | null>(null);

    if (extractions.length === 0) return null;

    async function handleQuickAdd(extraction: DrawingExtraction) {
        setAddingFor(extraction.id);
        const result = await addItemsToEstimateAction(projectId, extraction.extracted_items);
        setAddingFor(null);
        setAddResults((prev) => ({
            ...prev,
            [extraction.id]: result.success
                ? `✓ ${result.added} items added`
                : `Error: ${result.error}`,
        }));
    }

    return (
        <div className="mt-8">
            <h3 className="text-slate-300 text-sm font-semibold mb-3 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-slate-500" />
                Drawing Register
            </h3>
            <div className="space-y-2">
                {extractions.map((ex) => (
                    <div key={ex.id} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                        <button
                            onClick={() => setExpanded(expanded === ex.id ? null : ex.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/40 transition-colors text-left"
                        >
                            {expanded === ex.id ? (
                                <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            )}
                            <FileImage className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            <span className="text-slate-200 text-sm flex-1 truncate">{ex.filename}</span>
                            <span className="text-slate-500 text-xs hidden sm:block">
                                {ex.pages_processed}p · {ex.extracted_items.length} items
                            </span>
                            <span
                                className={`text-xs px-2 py-0.5 rounded-full ml-2 ${
                                    ex.status === "processed"
                                        ? "bg-emerald-900/60 text-emerald-400"
                                        : ex.status === "error"
                                        ? "bg-red-900/60 text-red-400"
                                        : "bg-slate-700 text-slate-400"
                                }`}
                            >
                                {ex.status}
                            </span>
                        </button>

                        {expanded === ex.id && (
                            <div className="border-t border-slate-700/50 px-4 py-3">
                                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mb-3">
                                    <span className="text-slate-500">Format</span>
                                    <span className="text-slate-300">{ex.format}</span>
                                    <span className="text-slate-500">Pages</span>
                                    <span className="text-slate-300">{ex.page_count} ({ex.pages_processed} processed)</span>
                                    <span className="text-slate-500">Size</span>
                                    <span className="text-slate-300">
                                        {ex.file_size_kb ? formatBytes(ex.file_size_kb * 1024) : "—"}
                                    </span>
                                    <span className="text-slate-500">Date</span>
                                    <span className="text-slate-300">
                                        {new Date(ex.created_at).toLocaleDateString("en-GB")}
                                    </span>
                                </div>

                                {ex.error_message && (
                                    <p className="text-red-400 text-xs mb-3 bg-red-900/20 rounded px-2 py-1.5">
                                        {ex.error_message}
                                    </p>
                                )}

                                {ex.extracted_items.length > 0 && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400 text-xs">
                                            {ex.extracted_items.length} items available
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {addResults[ex.id] && (
                                                <span className={`text-xs ${addResults[ex.id].startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>
                                                    {addResults[ex.id]}
                                                </span>
                                            )}
                                            <button
                                                onClick={() => handleQuickAdd(ex)}
                                                disabled={addingFor === ex.id}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/80 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                                            >
                                                {addingFor === ex.id ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <PlusCircle className="w-3 h-3" />
                                                )}
                                                Add all to estimate
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DrawingsClient({ projectId, projectName, initialExtractions }: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [uploadState, setUploadState] = useState<UploadState>("idle");
    const [progress, setProgress] = useState<{ file: string; fileIndex: number; fileCount: number; page: number; pageTotal: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeExtractions, setActiveExtractions] = useState<DrawingExtraction[]>([]);
    const [extractions, setExtractions] = useState<DrawingExtraction[]>(initialExtractions);

    function isCadFile(filename: string): boolean {
        const ext = filename.toLowerCase().substring(filename.lastIndexOf("."));
        return CAD_EXTENSIONS.includes(ext);
    }

    async function renderFile(file: File, onProgress: (page: number, total: number) => void): Promise<{ base64Pages: string[]; pageCount: number }> {
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (isPdf) {
            return renderPdfToBase64Pages(file, onProgress);
        } else {
            const b64 = await imageFileToBase64(file);
            onProgress(1, 1);
            return { base64Pages: [b64], pageCount: 1 };
        }
    }

    async function processFiles(files: File[]) {
        setError(null);
        setActiveExtractions([]);

        const cadFiles = files.filter((f) => isCadFile(f.name));
        const validFiles = files.filter(
            (f) => !isCadFile(f.name) && (ACCEPTED_TYPES.includes(f.type) || f.name.toLowerCase().endsWith(".pdf"))
        );

        if (cadFiles.length > 0 && validFiles.length === 0) {
            setError(
                `CAD files (${cadFiles.map((f) => f.name.split(".").pop()?.toUpperCase()).join(", ")}) cannot be read directly. Please export to PDF first.`
            );
            return;
        }
        if (validFiles.length === 0) {
            setError("No supported files found. Please upload PDF, PNG, JPG, or WebP files.");
            return;
        }

        // Warn about any CAD files mixed in with valid files
        let cadWarning = "";
        if (cadFiles.length > 0) {
            cadWarning = `Note: ${cadFiles.length} CAD file(s) were skipped — export to PDF to include them.`;
        }

        try {
            // ── Process each file individually — one AI call each ──────────────
            // This is intentional: combining files into one call causes the AI to
            // synthesise and lose quantity detail from GA drawings.
            const newExtractions: DrawingExtraction[] = [];

            for (let i = 0; i < validFiles.length; i++) {
                const file = validFiles[i];
                const format = file.name.toLowerCase().endsWith(".pdf") ? "PDF" : file.type.split("/")[1].toUpperCase();
                const fileSizeKb = Math.round(file.size / 1024);

                // Render pages
                setUploadState("rendering");
                setProgress({ file: file.name, fileIndex: i + 1, fileCount: validFiles.length, page: 0, pageTotal: 1 });

                const { base64Pages, pageCount } = await renderFile(file, (page, pageTotal) => {
                    setProgress({ file: file.name, fileIndex: i + 1, fileCount: validFiles.length, page, pageTotal });
                });

                // Analyse
                setUploadState("analysing");
                setProgress(null);

                const result = await analyzeDrawingPagesAction(
                    projectId,
                    file.name,
                    fileSizeKb,
                    format,
                    pageCount,
                    base64Pages
                );

                if (!result) {
                    setError(`Server did not respond for "${file.name}". It may be too large.`);
                    setUploadState("error");
                    return;
                }

                if (result.success && result.extraction) {
                    newExtractions.push(result.extraction);
                    // Show results as they come in
                    setActiveExtractions((prev) => [...prev, result.extraction!]);
                    setExtractions((prev) => [result.extraction!, ...prev.filter((e) => e.id !== result.extraction!.id)]);
                } else {
                    // Non-fatal — continue with remaining files, show error inline
                    setExtractions((prev) => prev); // no-op, keeps existing
                }
            }

            setUploadState("done");
            if (cadWarning) setError(cadWarning);

        } catch (err: any) {
            console.error("Drawing processing error:", err);
            setError(err.message || "An unexpected error occurred.");
            setUploadState("error");
        }
    }

    function handleFileSelect(files: FileList | null) {
        if (!files || files.length === 0) return;
        processFiles(Array.from(files));
    }

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    }, [projectId]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const isProcessing = uploadState === "rendering" || uploadState === "analysing";

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-white text-xl font-bold flex items-center gap-2">
                        <Layers className="w-5 h-5 text-blue-400" />
                        Drawing AI Takeoff
                    </h1>
                    <p className="text-slate-400 text-sm mt-0.5">{projectName}</p>
                </div>
            </div>

            {/* Upload zone */}
            {!isProcessing && uploadState !== "done" && (
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => !isProcessing && fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                        isDragging
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-slate-600 hover:border-slate-500 bg-slate-800/40 hover:bg-slate-800/60"
                    }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files)}
                    />
                    <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                    <p className="text-slate-200 font-medium mb-1">
                        {isDragging ? "Drop your drawings here" : "Upload drawings to analyse"}
                    </p>
                    <p className="text-slate-400 text-sm mb-3">
                        Drag & drop or click to browse · Select multiple files at once
                    </p>
                    <p className="text-slate-500 text-xs">
                        Accepts PDF, PNG, JPG, WebP · GA drawings + detail drawings processed together
                    </p>
                    <p className="text-slate-600 text-xs mt-1">
                        For CAD files (DWG, RVT, SKP), please export to PDF first
                    </p>
                </div>
            )}

            {/* Processing state */}
            {isProcessing && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center">
                    <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-4" />
                    <p className="text-white font-medium mb-1">
                        {uploadState === "rendering" ? "Rendering drawing pages…" : "AI is analysing drawing…"}
                    </p>
                    {progress && (
                        <>
                            <p className="text-slate-300 text-sm mb-0.5 truncate max-w-sm mx-auto">{progress.file}</p>
                            <p className="text-slate-500 text-xs">
                                Drawing {progress.fileIndex} of {progress.fileCount}
                                {uploadState === "rendering" && progress.pageTotal > 1
                                    ? ` · page ${progress.page} of ${progress.pageTotal}`
                                    : ""}
                            </p>
                        </>
                    )}
                    {!progress && uploadState === "analysing" && (
                        <p className="text-slate-500 text-xs">Extracting quantities and matching cost library…</p>
                    )}
                </div>
            )}

            {/* Error / warning state */}
            {error && (
                <div className={`border rounded-xl p-4 flex items-start gap-3 ${
                    uploadState === "error"
                        ? "bg-red-900/20 border-red-700/50"
                        : "bg-amber-900/20 border-amber-700/50"
                }`}>
                    <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${uploadState === "error" ? "text-red-400" : "text-amber-400"}`} />
                    <div className="flex-1">
                        <p className={`text-sm font-medium ${uploadState === "error" ? "text-red-300" : "text-amber-300"}`}>
                            {uploadState === "error" ? "Upload failed" : "Note"}
                        </p>
                        <p className={`text-sm mt-1 ${uploadState === "error" ? "text-red-400/80" : "text-amber-400/80"}`}>{error}</p>
                    </div>
                    <button
                        onClick={() => { setError(null); if (uploadState === "error") setUploadState("idle"); }}
                        className={`transition-colors ${uploadState === "error" ? "text-red-500 hover:text-red-400" : "text-amber-500 hover:text-amber-400"}`}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Upload another button after done */}
            {uploadState === "done" && !isProcessing && (
                <button
                    onClick={() => {
                        setUploadState("idle");
                        setActiveExtractions([]);
                        setError(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
                >
                    <Upload className="w-4 h-4" />
                    Upload more drawings
                </button>
            )}

            {/* Active extraction results — one panel per drawing */}
            {activeExtractions.map((ex) => (
                <ExtractionResultsPanel
                    key={ex.id}
                    extraction={ex}
                    projectId={projectId}
                    onDismiss={() => setActiveExtractions((prev) => prev.filter((e) => e.id !== ex.id))}
                />
            ))}

            {/* Drawing register */}
            <DrawingRegister
                extractions={extractions.filter((e) => !activeExtractions.some((a) => a.id === e.id))}
                projectId={projectId}
            />
        </div>
    );
}
