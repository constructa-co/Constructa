/**
 * Client-safe priced BoQ export — fresh workbook, all-in rates only.
 * All-in line maths mirror `buildFeeItems` in `proposal-publication.ts` (not
 * duplicated in the UI). Internal margins never appear in cells, names or metadata.
 */
import * as XLSX from "xlsx";
import type { WorkBook, WorkSheet } from "xlsx";
import { computeContractSum, isPricedPreliminariesLine, roundMoney, toNumber } from "@/lib/financial";
import { isFaceValueLineType } from "@/lib/estimate-line-type";
import { vatFor } from "@/lib/proposal-review";
import { orderedEstimateSections } from "@/lib/estimate-batch-sections";
import type { Estimate, EstimateLine } from "@/app/dashboard/projects/costs/types";

/** The one job setting the export needs: how VAT is charged on this job. */
export type BoQExportProject = { is_vat_reverse_charge?: boolean | null };

/** Fixed client-facing workbook title (no internal version labels). */
export const CLIENT_BOQ_EXPORT_TITLE = "Client BoQ";

/** Fixed download name — never embeds `version_name` or source filename. */
export const CLIENT_BOQ_EXPORT_FILENAME = "ClientCopy_BoQ.xlsx";

export const CLIENT_BOQ_ROUNDING_RECONCILIATION_LABEL =
    "Rounding reconciliation (contract sum tie-out)";

export const CLIENT_BOQ_RATE_FOOTNOTE =
    "Note: Where Rate (£) is blank, Total (£) is the contract line amount (Qty × Rate may differ after rounding).";

/** Test-only sentinels; must never appear in a client export. */
export const CLIENT_BOQ_CONFIDENTIALITY_SENTINELS = [
    "SENTINEL_INTERNAL_VERSION",
    "SENTINEL_INTERNAL_SUPPLIER_NOTE",
    "SENTINEL_INTERNAL_MARGIN_PCT",
] as const;

export class ClientBoQExportError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ClientBoQExportError";
    }
}

export type ClientBoQExportLine = {
    client_ref: string;
    section: string;
    description: string;
    quantity: number;
    unit: string;
    /** Shown rate when Qty × Rate ties to Total; otherwise null and Total is authoritative. */
    unit_rate: number | null;
    line_total: number;
    is_rounding_reconciliation?: boolean;
    total_authoritative?: boolean;
};

const FORBIDDEN_SUMMARY_LABELS = [
    /^Overhead \(/i,
    /^Risk \(/i,
    /^Profit \(/i,
    /^Discount \(/i,
    /^Direct Construction Cost$/i,
    /^Total Construction Cost$/i,
];

const REVERSE_CHARGE_NOTE =
    "The VAT domestic reverse charge applies to these works. The customer accounts for the VAT to HMRC.";

function formatGBP(n: number): string {
    return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Client-sheet rate column: only show a 2dp unit rate when Qty × Rate equals Total to the penny.
 * Otherwise leave Rate blank and treat Total as authoritative (footnote explains).
 */
export function clientBoQDisplayRate(
    quantity: number,
    lineTotal: number,
): { unit_rate: number | null; total_authoritative: boolean } {
    if (quantity <= 0) {
        return { unit_rate: null, total_authoritative: true };
    }
    const twoDp = Number((lineTotal / quantity).toFixed(2));
    if (roundMoney(quantity * twoDp) === lineTotal) {
        return { unit_rate: twoDp, total_authoritative: false };
    }
    return { unit_rate: null, total_authoritative: true };
}

/**
 * Marked-up client lines with penny tie-out to `computeContractSum` (same rules
 * as proposal publication fee items).
 */
export function buildClientSafeBoQLines(
    estimate: Estimate,
    lines: EstimateLine[],
): { exportLines: ClientBoQExportLine[]; contractSum: number } {
    const breakdown = computeContractSum(estimate, lines);
    const multiplier = breakdown.ohRiskProfitMultiplier;
    const contractSum = roundMoney(breakdown.contractSum);

    type Item = {
        client_ref: string;
        section: string;
        description: string;
        quantity: number;
        unit: string;
        amount_ex_vat: number;
        line_type?: string;
        roundingReconciliation?: boolean;
    };

    const items: Item[] = lines
        .filter((line) => toNumber(line.line_total) !== 0)
        .map((line) => {
            const faceValue = isFaceValueLineType(line.line_type);
            return {
                client_ref: (line.client_ref ?? "").trim(),
                section: (line.trade_section ?? "General").trim() || "General",
                description: (line.description ?? "Works").trim() || "Works",
                quantity: toNumber(line.quantity),
                unit: (line.unit ?? "item").trim() || "item",
                amount_ex_vat: faceValue
                    ? roundMoney(toNumber(line.line_total))
                    : roundMoney(toNumber(line.line_total) * multiplier),
                ...(faceValue ? { line_type: line.line_type } : {}),
            };
        });

    const hasExplicitPrelims = lines.some(isPricedPreliminariesLine);
    if (!hasExplicitPrelims && breakdown.prelimsTotal > 0) {
        items.push({
            client_ref: "",
            section: "Preliminaries",
            description: "Project preliminaries",
            quantity: 1,
            unit: "sum",
            amount_ex_vat: roundMoney(breakdown.prelimsTotal * multiplier),
        });
    }

    if (items.length > 0) {
        const itemTotal = roundMoney(items.reduce((sum, line) => sum + line.amount_ex_vat, 0));
        const residual = roundMoney(contractSum - itemTotal);
        if (residual !== 0) {
            const markedUpCount = items.filter((line) => !line.line_type).length || 1;
            const maxRounding = roundMoney(Math.min(1, markedUpCount * 0.02));
            if (Math.abs(residual) > maxRounding) {
                throw new ClientBoQExportError(
                    `Contract sum tie-out gap of £${formatGBP(residual)} exceeds the rounding tolerance (£${formatGBP(maxRounding)}). Use internal export for review.`,
                );
            }
            items.push({
                client_ref: "",
                section: "General",
                description: CLIENT_BOQ_ROUNDING_RECONCILIATION_LABEL,
                quantity: 1,
                unit: "sum",
                amount_ex_vat: residual,
                roundingReconciliation: true,
            });
        }
    }

    const exportLines: ClientBoQExportLine[] = items.map((item) => {
        const qty = item.quantity;
        const line_total = item.amount_ex_vat;
        const { unit_rate, total_authoritative } = clientBoQDisplayRate(qty, line_total);
        return {
            client_ref: item.client_ref,
            section: item.section,
            description: item.description,
            quantity: qty,
            unit: item.unit,
            unit_rate,
            line_total,
            ...(item.roundingReconciliation ? { is_rounding_reconciliation: true } : {}),
            ...(total_authoritative ? { total_authoritative: true } : {}),
        };
    });

    const linesSum = roundMoney(exportLines.reduce((s, l) => s + l.line_total, 0));
    if (linesSum !== contractSum) {
        throw new ClientBoQExportError(
            `Client BoQ tie-out failed: Σ line totals ${linesSum} ≠ contract sum ${contractSum}.`,
        );
    }

    return { exportLines, contractSum };
}

/** Client-facing summary: contract sum and VAT only (no margin rows). */
export function clientBoQSummaryRows(estimate: Estimate, project?: BoQExportProject): [string, string][] {
    const contractSum = roundMoney(computeContractSum(estimate, estimate.estimate_lines).contractSum);
    const { vatRate, vatTreatment } = vatFor(project ?? {});
    const vat = roundMoney((contractSum * vatRate) / 100);

    const rows: [string, string][] = [["CONTRACT SUM (exc. VAT)", formatGBP(contractSum)]];
    if (vatRate > 0) {
        rows.push([`VAT (${vatRate}%)`, formatGBP(vat)]);
        rows.push(["TOTAL inc. VAT", formatGBP(roundMoney(contractSum + vat))]);
    } else {
        rows.push([
            vatTreatment === "domestic_reverse_charge" ? REVERSE_CHARGE_NOTE : "No VAT is charged.",
            "",
        ]);
    }
    return rows;
}

export type ClientBoQSheetRow = (string | number)[];

export function buildClientBoQSheetRows(estimate: Estimate, project?: BoQExportProject): ClientBoQSheetRow[] {
    const { exportLines } = buildClientSafeBoQLines(estimate, estimate.estimate_lines);
    const needsRateFootnote = exportLines.some((l) => l.total_authoritative);
    const rows: ClientBoQSheetRow[] = [
        [CLIENT_BOQ_EXPORT_TITLE],
        [],
        ["Ref", "Description", "Qty", "Unit", "Rate (£)", "Total (£)"],
    ];
    if (needsRateFootnote) {
        rows.push(["", CLIENT_BOQ_RATE_FOOTNOTE, "", "", "", ""]);
    }

    const bySection = new Map<string, ClientBoQExportLine[]>();
    for (const line of exportLines) {
        const list = bySection.get(line.section) ?? [];
        list.push(line);
        bySection.set(line.section, list);
    }
    const sections = orderedEstimateSections(
        exportLines.map((l) => ({
            ...l,
            id: "",
            estimate_id: estimate.id,
            trade_section: l.section,
            line_type: "standard",
            pricing_mode: "simple" as const,
            estimate_line_components: [],
        })),
    );
    const ordered = sections.length ? sections : [...bySection.keys()];

    for (const section of ordered) {
        const sectionLines = bySection.get(section) ?? [];
        if (!sectionLines.length) continue;
        rows.push(["", section.toUpperCase(), "", "", "", ""]);
        let sectionTotal = 0;
        for (const line of sectionLines) {
            sectionTotal += line.line_total;
            rows.push([
                line.client_ref,
                line.description,
                line.quantity,
                line.unit,
                line.unit_rate != null && line.unit_rate !== 0 ? line.unit_rate : "",
                line.line_total !== 0 ? line.line_total : "",
            ]);
        }
        rows.push(["", `${section} — Subtotal`, "", "", "", formatGBP(roundMoney(sectionTotal))]);
        rows.push([]);
    }

    const labelCol = 4;
    const valueCol = 5;
    for (const [label, value] of clientBoQSummaryRows(estimate, project)) {
        const row: ClientBoQSheetRow = Array(6).fill("");
        row[labelCol] = label;
        row[valueCol] = value;
        rows.push(row);
    }
    return rows;
}

/** Fresh single-sheet workbook; no hidden tabs, comments or custom parts. */
export function createClientBoQWorkbook(sheetRows: ClientBoQSheetRow[]): WorkBook {
    const ws: WorkSheet = XLSX.utils.aoa_to_sheet(sheetRows);
    delete (ws as Record<string, unknown>)["!comments"];
    ws["!cols"] = [{ wch: 10 }, { wch: 55 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Client BoQ");
    return wb;
}

function cellText(v: unknown): string {
    if (v == null) return "";
    return String(v);
}

/** Returns human-readable leak descriptions (empty when clean). */
export function inspectClientBoQWorkbookForLeaks(workbook: WorkBook): string[] {
    const leaks: string[] = [];
    const hiddenMeta = workbook.Workbook?.Sheets;
    for (let i = 0; i < workbook.SheetNames.length; i++) {
        const name = workbook.SheetNames[i];
        const hidden = hiddenMeta?.[i]?.Hidden;
        if (hidden === 1 || hidden === 2) {
            leaks.push(`hidden or very-hidden sheet: ${name}`);
        }
        const ws = workbook.Sheets[name];
        if (!ws) continue;
        if ((ws as Record<string, unknown>)["!comments"]) {
            leaks.push(`cell comments on sheet: ${name}`);
        }
        for (const key of Object.keys(ws)) {
            if (key.startsWith("!")) continue;
            const cell = ws[key];
            if (cell?.c) {
                leaks.push(`cell comment at ${name}!${key}`);
            }
            const text = cellText(cell?.v);
            for (const pattern of FORBIDDEN_SUMMARY_LABELS) {
                if (pattern.test(text)) {
                    leaks.push(`internal label in ${name}!${key}: ${text}`);
                }
            }
            for (const sentinel of CLIENT_BOQ_CONFIDENTIALITY_SENTINELS) {
                if (text.includes(sentinel)) {
                    leaks.push(`confidentiality sentinel in ${name}!${key}`);
                }
            }
        }
    }
    for (const bag of [workbook.Props, workbook.Custprops]) {
        if (!bag) continue;
        const serialised = JSON.stringify(bag);
        for (const sentinel of CLIENT_BOQ_CONFIDENTIALITY_SENTINELS) {
            if (serialised.includes(sentinel)) {
                leaks.push(`confidentiality sentinel in workbook metadata`);
            }
        }
    }
    return leaks;
}

/** Strip metadata SheetJS may attach before handing a file to the client. */
export function sanitiseClientBoQWorkbookForWrite(workbook: WorkBook): void {
    delete workbook.Custprops;
    delete workbook.Props;
}

export function buildClientBoQWorkbook(estimate: Estimate, project?: BoQExportProject): WorkBook {
    const rows = buildClientBoQSheetRows(estimate, project);
    const wb = createClientBoQWorkbook(rows);
    const leaks = inspectClientBoQWorkbookForLeaks(wb);
    if (leaks.length) {
        throw new ClientBoQExportError(`Client BoQ workbook failed confidentiality scan: ${leaks.join("; ")}`);
    }
    sanitiseClientBoQWorkbookForWrite(wb);
    return wb;
}

export function serializeClientBoQWorkbook(workbook: WorkBook): ArrayBuffer {
    const copy = { ...workbook, Sheets: { ...workbook.Sheets }, SheetNames: [...workbook.SheetNames] };
    sanitiseClientBoQWorkbookForWrite(copy);
    return XLSX.write(copy, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

/** Inspect the bytes a client would receive after write/read round-trip. */
export function inspectSerializedClientBoQFile(buffer: ArrayBuffer): string[] {
    const workbook = XLSX.read(buffer, { type: "array" });
    return inspectClientBoQWorkbookForLeaks(workbook);
}