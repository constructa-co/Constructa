// Client-side Excel export for priced Client BoQ
// Uses SheetJS (xlsx) — dynamically imported to keep bundle lean

import type { Estimate, EstimateLine } from "./types";
import { requireLaunchCapability } from "@/lib/launch-profile";
import { computeContractSum, MARKUP_METHOD_NOTE, roundMoney } from "@/lib/financial";
import { vatFor } from "@/lib/proposal-review";
import { groupLinesBySection, orderedEstimateSections } from "@/lib/estimate-batch-sections";

function formatGBP(n: number): string {
    return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** The one job setting the export needs: how VAT is charged on this job. */
export type BoQExportProject = { is_vat_reverse_charge?: boolean | null };

const REVERSE_CHARGE_NOTE = "The VAT domestic reverse charge applies to these works. The customer accounts for the VAT to HMRC.";

/**
 * Summary rows under the priced BoQ. Every figure comes from the canonical
 * contract-sum helper (the one the proposal publication uses) and the job's
 * VAT treatment from vatFor, so the sheet cannot drift from the proposal.
 * Prime-cost / provisional sums are carried at face value, a blank
 * Preliminaries line does not suppress the percentage allowance, and credits
 * reduce the totals. Takes every estimate line, as the proposal does.
 */
export function boqSummaryRows(estimate: Estimate, project?: BoQExportProject): [string, string][] {
    const b = computeContractSum(estimate, estimate.estimate_lines);
    const { vatRate, vatTreatment } = vatFor(project ?? {});
    const contractSum = roundMoney(b.contractSum);
    const vat = roundMoney(contractSum * vatRate / 100);

    const rows: [string, string][] = [["Direct Construction Cost", formatGBP(b.directCost)]];
    if (b.prelimsTotal !== 0) rows.push(["Preliminaries", formatGBP(b.prelimsTotal)]);
    rows.push(["Total Construction Cost", formatGBP(b.totalConstructionCost)]);
    if (estimate.overhead_pct > 0) rows.push([`Overhead (${estimate.overhead_pct}%)`, formatGBP(b.overheadAmount)]);
    if (estimate.risk_pct > 0) rows.push([`Risk (${estimate.risk_pct}%)`, formatGBP(b.riskAmount)]);
    if (estimate.profit_pct > 0) rows.push([`Profit (${estimate.profit_pct}%)`, formatGBP(b.profitAmount)]);
    if ((estimate.discount_pct || 0) > 0) rows.push([`Discount (${estimate.discount_pct}%)`, `-${formatGBP(b.discountAmount)}`]);
    if (b.faceValueTotal !== 0) rows.push(["Prime cost / provisional sums (at face value)", formatGBP(b.faceValueTotal)]);
    rows.push(["CONTRACT SUM (exc. VAT)", formatGBP(contractSum)]);
    if (vatRate > 0) {
        rows.push([`VAT (${vatRate}%)`, formatGBP(vat)]);
        rows.push(["TOTAL inc. VAT", formatGBP(roundMoney(contractSum + vat))]);
    } else {
        rows.push([vatTreatment === "domestic_reverse_charge" ? REVERSE_CHARGE_NOTE : "No VAT is charged.", ""]);
    }
    return rows;
}

export async function exportBoQToExcel(estimate: Estimate, project?: BoQExportProject): Promise<void> {
    requireLaunchCapability("client-boq-import");
    const XLSX = await import("xlsx");

    const isClientBoQ = !!estimate.is_client_boq;
    const lines = estimate.estimate_lines.filter(l => l.description?.trim());

    const sectionOrder = orderedEstimateSections(lines);
    const sectionGroups = groupLinesBySection(lines);

    type Row = (string | number)[];

    const rows: Row[] = [];

    // Title row
    rows.push([estimate.version_name || "Estimate"]);
    rows.push([]); // blank

    // Column headers
    if (isClientBoQ) {
        rows.push(["Ref", "Description", "Qty", "Unit", "Rate (£)", "Total (£)"]);
    } else {
        rows.push(["Description", "Qty", "Unit", "Rate (£)", "Total (£)"]);
    }

    let grandTotal = 0;

    for (const section of sectionOrder) {
        const sectionLines = sectionGroups[section];
        const sectionTotal = sectionLines.reduce((s, l) => s + (l.line_total || 0), 0);
        grandTotal += sectionTotal;

        // Section heading row
        if (isClientBoQ) {
            rows.push(["", section.toUpperCase(), "", "", "", ""]);
        } else {
            rows.push([section.toUpperCase(), "", "", "", ""]);
        }

        // Line items
        for (const line of sectionLines) {
            if (isClientBoQ) {
                rows.push([
                    line.client_ref || "",
                    line.description,
                    line.quantity,
                    line.unit,
                    line.unit_rate !== 0 ? line.unit_rate : "",
                    line.line_total !== 0 ? line.line_total : "",
                ]);
            } else {
                rows.push([
                    line.description,
                    line.quantity,
                    line.unit,
                    line.unit_rate !== 0 ? line.unit_rate : "",
                    line.line_total !== 0 ? line.line_total : "",
                ]);
            }
        }

        // Section subtotal
        if (isClientBoQ) {
            rows.push(["", `${section} — Subtotal`, "", "", "", formatGBP(sectionTotal)]);
        } else {
            rows.push([`${section} — Subtotal`, "", "", "", formatGBP(sectionTotal)]);
        }
        rows.push([]); // blank spacer
    }

    // Summary rows
    const colCount = isClientBoQ ? 6 : 5;
    const labelCol = colCount - 2; // second to last
    const valueCol = colCount - 1; // last

    const summaryRows = boqSummaryRows(estimate, project);
    if (estimate.overhead_pct > 0 || estimate.risk_pct > 0 || estimate.profit_pct > 0) {
        const { markupMethod } = computeContractSum(estimate, lines);
        summaryRows.push([MARKUP_METHOD_NOTE[markupMethod], ""]);
    }

    for (const [label, value] of summaryRows) {
        const row: Row = Array(colCount).fill("");
        row[labelCol] = label;
        row[valueCol] = value;
        rows.push(row);
    }

    // Build worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    ws["!cols"] = isClientBoQ
        ? [{ wch: 10 }, { wch: 55 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }]
        : [{ wch: 55 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    const sheetName = isClientBoQ ? "Client BoQ" : "Estimate";
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const filename = estimate.is_client_boq && estimate.client_boq_filename
        ? `Priced_${estimate.client_boq_filename.replace(/\.[^.]+$/, "")}.xlsx`
        : `${(estimate.version_name || "Estimate").replace(/[^a-z0-9]/gi, "_")}.xlsx`;

    XLSX.writeFile(wb, filename);
}
