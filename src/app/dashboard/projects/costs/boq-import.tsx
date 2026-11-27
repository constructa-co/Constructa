"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import { Upload, FileSpreadsheet, FileText, Loader2, AlertTriangle, X, CheckCircle, ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import { parseBoQFromPdfAction, createBoQEstimateAction, type ParsedClientBoQ } from "./boq-import-action";
import { parseEstimateBatchCsv } from "@/lib/estimate-batch-csv";
import {
    BOQ_ROW_REASON_LABEL,
    BOQ_SHEETJS_READ_OPTIONS,
    boqWorkbookImportBlockers,
    extractBoQWorkbook,
    workbookInputFromSheetJS,
    type BoQWorkbookExtraction,
    type BoQWorkbookInput,
} from "@/lib/boq-workbook";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

// ─── Load pdfjs dynamically (same pattern as drawings) ───────────────────────

async function loadPdfJs() {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    return pdfjs;
}

const MAX_PDF_PAGES = 10;

async function renderPdfToBase64Pages(file: File): Promise<{ pages: string[]; totalPages: number }> {
    const pdfjs = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const pagesToRender = Math.min(pdf.numPages, MAX_PDF_PAGES);
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
    return { pages, totalPages: pdf.numPages };
}

// ─── Load SheetJS dynamically ─────────────────────────────────────────────────

/** Reads every tab of the workbook (cached values only; formulas and macros are never run). */
async function readWorkbookFile(file: File): Promise<BoQWorkbookInput> {
    const XLSX = await import("xlsx");
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array", ...BOQ_SHEETJS_READ_OPTIONS });
    return workbookInputFromSheetJS(file.name, workbook);
}

function boqFromExtraction(extraction: BoQWorkbookExtraction): ParsedClientBoQ {
    return {
        filename: extraction.filename,
        sections: extraction.sections,
        // Provenance stays in the preview; the saved line keeps the existing estimate fields.
        lines: extraction.lines.map((l) => ({
            client_ref: l.client_ref,
            section: l.section,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            unit_rate: l.unit_rate,
            line_total: l.line_total,
            ...(l.parse_warnings ? { parse_warnings: l.parse_warnings } : {}),
            ...(l.total_mismatch ? { total_mismatch: l.total_mismatch } : {}),
        })),
        totalLines: extraction.lines.length,
    };
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
    const [workbook, setWorkbook] = useState<BoQWorkbookInput | null>(null);
    const [includeSheets, setIncludeSheets] = useState<string[] | null>(null);
    const [acknowledged, setAcknowledged] = useState(false);
    const [rowList, setRowList] = useState<"excluded" | "unresolved" | null>(null);
    const [pdfNotice, setPdfNotice] = useState<string | null>(null);
    const [importedCount, setImportedCount] = useState<number | null>(null);

    const extraction = useMemo(
        () => (workbook ? extractBoQWorkbook(workbook, includeSheets ? { includeSheets } : {}) : null),
        [workbook, includeSheets],
    );
    const blockers = extraction ? boqWorkbookImportBlockers(extraction) : [];
    const recon = extraction?.reconciliation ?? null;
    const needsAck = Boolean(recon && recon.totals.unresolvedRows > 0);

    function toggleSheet(name: string) {
        if (!workbook || !extraction) return;
        const current = extraction.reconciliation.sheets.filter((s) => s.selected).map((s) => s.sheet);
        const next = current.includes(name) ? current.filter((n) => n !== name) : [...current, name];
        const nextExtraction = extractBoQWorkbook(workbook, { includeSheets: next });
        const parsed = boqFromExtraction(nextExtraction);
        setIncludeSheets(next);
        setAcknowledged(false);
        setBoq(parsed);
        setExpandedSections(new Set(parsed.sections.slice(0, 3)));
    }

    async function processFile(file: File) {
        setError(null);
        setBoq(null);
        setWorkbook(null);
        setIncludeSheets(null);
        setAcknowledged(false);
        setRowList(null);
        setPdfNotice(null);
        setImportedCount(null);

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

            const batch = file.name.match(/\.csv$/i) ? parseEstimateBatchCsv(await file.text()) : null;
            if (batch?.ok) {
                result = {
                    success: true,
                    boq: { filename: file.name, sections: batch.sections, lines: batch.lines, totalLines: batch.lines.length },
                };
            } else if (isExcel) {
                // Every tab, every row, deterministically; the reconciliation is shown before import.
                const input = await readWorkbookFile(file);
                setWorkbook(input);
                result = { success: true, boq: boqFromExtraction(extractBoQWorkbook(input)) };
            } else {
                const { pages, totalPages } = await renderPdfToBase64Pages(file);
                if (totalPages > pages.length) {
                    setPdfNotice(`Only the first ${pages.length} of ${totalPages} PDF pages were read. Items on pages ${pages.length + 1}–${totalPages} are not in this preview — split the PDF or use the spreadsheet.`);
                }
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
        if (extraction && (blockers.length || (needsAck && !acknowledged))) return;
        setState("importing");
        try {
            const result = await createBoQEstimateAction(projectId, boq);
            if (!result || !result.success || !result.estimateId) {
                setError(result?.error || "Failed to create estimate.");
                setState("error");
                return;
            }
            setImportedCount(result.importedLines ?? boq.lines.length);
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
    const warnedLines = boq?.lines.filter((l) => l.parse_warnings?.length) ?? [];
    const mismatchedTotals = boq?.lines.filter((l) => l.total_mismatch).length ?? 0;
    const linesBlank = boq?.lines.filter((l) => l.quantity == null && l.description?.trim() && !l.parse_warnings?.length).length ?? 0;
    const importDisabled = warnedLines.length > 0 || (extraction !== null && (blockers.length > 0 || (needsAck && !acknowledged)));
    const listedRows = extraction && rowList ? extraction.rows.filter((r) => r.kind === rowList) : [];

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
                                    <FileText className="w-8 h-8 text-slate-400/60" />
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
                            <p className="text-slate-500 text-xs mt-1">Reading every tab, section, reference and quantity</p>
                        </div>
                    )}

                    {/* Preview */}
                    {state === "preview" && boq && (
                        <>
                            {pdfNotice && (
                                <p className="text-amber-300 text-xs flex items-start gap-1.5" data-boq-pdf-page-limit>
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                    {pdfNotice}
                                </p>
                            )}

                            {extraction && recon && (
                                <div className="border border-slate-700 rounded-xl overflow-hidden" data-boq-reconciliation data-boq-balanced={recon.balanced ? "true" : "false"}>
                                    <div className="px-4 py-2.5 bg-slate-800/80 border-b border-slate-700">
                                        <p className="text-xs font-semibold text-slate-300">
                                            Read {recon.sheetCount} tab{recon.sheetCount === 1 ? "" : "s"} · {recon.totals.sourceRows} rows
                                        </p>
                                        <p className="text-xs text-slate-400 mt-1" data-boq-reconciliation-totals>
                                            {extraction.lines.length} items to import (from {recon.totals.itemRows + recon.totals.continuationRows} rows)
                                            {" · "}{recon.totals.headingRows} headings
                                            {" · "}<button type="button" className="underline decoration-dotted hover:text-slate-200" onClick={() => setRowList(rowList === "excluded" ? null : "excluded")}>{recon.totals.excludedRows} excluded</button>
                                            {" · "}<button type="button" className={`underline decoration-dotted hover:text-slate-200 ${recon.totals.unresolvedRows ? "text-amber-300" : ""}`} onClick={() => setRowList(rowList === "unresolved" ? null : "unresolved")}>{recon.totals.unresolvedRows} unresolved</button>
                                            {" · "}{recon.totals.blankRows} blank
                                            {recon.balanced ? " — every row accounted for" : " — DOES NOT BALANCE"}
                                        </p>
                                        {(recon.totals.uncachedFormulaCells > 0 || recon.totals.errorCells > 0) && (
                                            <p className="text-xs text-amber-400/80 mt-1">
                                                Saved values only — formulas are not recalculated.
                                                {recon.totals.uncachedFormulaCells > 0 && ` ${recon.totals.uncachedFormulaCells} formula cell(s) had no saved value.`}
                                                {recon.totals.errorCells > 0 && ` ${recon.totals.errorCells} cell(s) hold Excel errors such as #REF!.`}
                                            </p>
                                        )}
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        <table className="w-full text-xs">
                                            <thead className="text-slate-500 bg-slate-900/60 sticky top-0">
                                                <tr>
                                                    <th className="text-left font-medium px-3 py-1.5">Import</th>
                                                    <th className="text-left font-medium px-2 py-1.5">Tab</th>
                                                    <th className="text-right font-medium px-2 py-1.5">Rows</th>
                                                    <th className="text-right font-medium px-2 py-1.5">Items</th>
                                                    <th className="text-right font-medium px-2 py-1.5">Excluded</th>
                                                    <th className="text-right font-medium px-3 py-1.5">Unresolved</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800">
                                                {recon.sheets.map((sheet) => (
                                                    <tr key={sheet.index} data-boq-sheet={sheet.sheet} data-boq-sheet-status={sheet.status}>
                                                        <td className="px-3 py-1.5">
                                                            <input
                                                                type="checkbox"
                                                                aria-label={`Import tab ${sheet.sheet}`}
                                                                checked={sheet.selected}
                                                                disabled={sheet.headerRow === null}
                                                                onChange={() => toggleSheet(sheet.sheet)}
                                                            />
                                                        </td>
                                                        <td className="px-2 py-1.5 text-slate-300">
                                                            {sheet.sheet}
                                                            <span className="text-slate-500">
                                                                {sheet.hidden ? " · hidden" : ""}
                                                                {sheet.status === "summary" ? " · summary" : ""}
                                                                {sheet.status === "unmapped" ? " · no column header" : ""}
                                                                {sheet.status === "non_boq" ? " · cover/notes" : ""}
                                                                {sheet.status === "empty" ? " · empty" : ""}
                                                                {sheet.ignoredColumns.length ? ` · unused columns ${sheet.ignoredColumns.join(", ")}` : ""}
                                                            </span>
                                                            {sheet.warningRows > 0 && <span className="text-amber-400"> · {sheet.warningRows} unreadable</span>}
                                                            {sheet.overLimitRows > 0 && <span className="text-amber-400" data-boq-sheet-over-limit={sheet.overLimitRows}> · {sheet.overLimitRows} too long to import</span>}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right text-slate-400 font-mono">{sheet.sourceRows}</td>
                                                        <td className="px-2 py-1.5 text-right text-slate-200 font-mono">{sheet.itemRows}</td>
                                                        <td className="px-2 py-1.5 text-right text-slate-400 font-mono">{sheet.excludedRows}</td>
                                                        <td className={`px-3 py-1.5 text-right font-mono ${sheet.unresolvedRows ? "text-amber-300" : "text-slate-400"}`}>{sheet.unresolvedRows}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {rowList && (
                                        <div className="border-t border-slate-700 max-h-48 overflow-y-auto" data-boq-row-list={rowList}>
                                            {listedRows.length === 0 ? (
                                                <p className="px-4 py-2 text-xs text-slate-500">No {rowList} rows.</p>
                                            ) : listedRows.map((r) => (
                                                <div key={`${r.sheet}:${r.row}`} className="flex gap-3 px-4 py-1 text-xs">
                                                    <span className="text-slate-500 font-mono whitespace-nowrap">{r.sheet}!{r.row}</span>
                                                    <span className="text-slate-400 whitespace-nowrap">{r.reason ? BOQ_ROW_REASON_LABEL[r.reason] : ""}</span>
                                                    <span className="text-slate-300 truncate">{r.preview}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {recon.contributingSheets > 1 && (
                                        <p className="px-4 py-2 border-t border-slate-700 text-xs text-slate-400">
                                            Items come from {recon.contributingSheets} tabs. Workbooks often repeat the same items on several tabs (build-up, BOQ, quote) — untick the tabs that are not the bill.
                                        </p>
                                    )}
                                </div>
                            )}

                            {extraction && recon && recon.totals.overLimitRows > 0 && (
                                <div className="border border-amber-700/50 rounded-lg max-h-40 overflow-y-auto" data-boq-over-limit-list>
                                    {extraction.lines.filter((l) => l.over_limit).map((l) => (
                                        <div key={`${l.source_sheet}:${l.source_row}`} className="flex gap-3 px-3 py-1 text-xs">
                                            <span className="text-slate-500 font-mono whitespace-nowrap">{l.source_sheet}!{l.source_row}{l.source_row_end !== l.source_row ? `–${l.source_row_end}` : ""}</span>
                                            <span className="text-amber-300 whitespace-nowrap">
                                                {l.over_limit!.map((o) => `${o.field.replace("_", " ")} ${o.length}/${o.limit}`).join(", ")}
                                            </span>
                                            <span className="text-slate-300 truncate">{l.description}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {extraction && blockers.length > 0 && (
                                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 space-y-1" data-boq-import-blockers>
                                    {blockers.map((b) => (
                                        <p key={b} className="text-red-300 text-xs flex items-start gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{b}
                                        </p>
                                    ))}
                                </div>
                            )}

                            {extraction && recon && needsAck && (
                                <label className="flex items-start gap-2 text-xs text-amber-200" data-boq-unresolved-ack>
                                    <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5" />
                                    I have reviewed the {recon.totals.unresolvedRows} unresolved row(s). They will not be imported.
                                </label>
                            )}

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
                                                    <span className="text-slate-300 text-xs flex-1">
                                                        {line.description}
                                                        {line.parse_warnings?.length ? (
                                                            <span className="ml-2 text-amber-400" data-boq-parse-warning={line.parse_warnings.join(",")}>
                                                                Unreadable {line.parse_warnings.join(", ").replaceAll("_", " ")}
                                                            </span>
                                                        ) : null}
                                                        {line.total_mismatch ? (
                                                            <span className="ml-2 text-amber-400" data-boq-total-mismatch>
                                                                File total £{line.total_mismatch.stated.toFixed(2)} ≠ qty × rate
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                    <span className="text-slate-500 text-xs font-mono whitespace-nowrap">
                                                        {line.quantity != null ? `${line.quantity} ${line.unit}` : <span className="text-amber-500/70">qty TBC</span>}
                                                        {line.unit_rate > 0 && line.quantity != null ? <span className="text-slate-600"> · £{line.line_total.toFixed(2)}</span> : null}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {warnedLines.length > 0 && (
                                <p className="text-amber-300 text-xs flex items-center gap-1.5" data-boq-warning-banner>
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                    {warnedLines.length} row(s) have unreadable quantities, rates or totals. Import is blocked until you fix or remove them in the source file.
                                </p>
                            )}
                            {mismatchedTotals > 0 && (
                                <p className="text-amber-400/80 text-xs flex items-center gap-1.5" data-boq-total-mismatch-banner>
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                    {mismatchedTotals} row(s) have a total that does not equal quantity × rate. They import at quantity × rate — check the rate on those rows.
                                </p>
                            )}
                            {linesBlank > 0 && (
                                <p className="text-amber-400/80 text-xs flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    {linesBlank} heading or blank-quantity items — section labels import with qty = 1 as a placeholder unless you add quantities first
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
                            <p className="text-white font-medium" data-boq-imported-count={importedCount ?? undefined}>
                                BoQ imported successfully{importedCount !== null && boq ? ` — ${importedCount} of ${boq.lines.length} lines saved` : ""}
                            </p>
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
                                    onClick={() => { setState("idle"); setBoq(null); setError(null); setWorkbook(null); setIncludeSheets(null); setAcknowledged(false); setRowList(null); setPdfNotice(null); }}
                                    className="text-sm text-slate-500 hover:text-slate-400 transition-colors"
                                >
                                    Upload different file
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={importDisabled}
                                    title={importDisabled ? "Resolve the items listed above before importing" : undefined}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
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
