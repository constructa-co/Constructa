// Client-side Excel export for priced Client BoQ
// Uses SheetJS (xlsx) — dynamically imported to keep bundle lean

import type { Estimate, EstimateLine } from "./types";

function formatGBP(n: number): string {
    return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function exportBoQToExcel(estimate: Estimate): Promise<void> {
    const XLSX = await import("xlsx");

    const isClientBoQ = !!estimate.is_client_boq;
    const lines = estimate.estimate_lines.filter(l => l.description?.trim());

    // Group by section preserving order
    const sectionOrder: string[] = [];
    const sectionGroups: Record<string, EstimateLine[]> = {};
    for (const line of lines) {
        const sec = line.trade_section || "General";
        if (!sectionGroups[sec]) {
            sectionGroups[sec] = [];
            sectionOrder.push(sec);
        }
        sectionGroups[sec].push(line);
    }

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
                    line.unit_rate > 0 ? line.unit_rate : "",
                    line.line_total > 0 ? line.line_total : "",
                ]);
            } else {
                rows.push([
                    line.description,
                    line.quantity,
                    line.unit,
                    line.unit_rate > 0 ? line.unit_rate : "",
                    line.line_total > 0 ? line.line_total : "",
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

    const summaryRows: [string, string][] = [];

    const directCost = lines
        .filter(l => l.trade_section !== "Preliminaries" && l.line_total > 0)
        .reduce((s, l) => s + l.line_total, 0);

    const explicitPrelims = lines.filter(l => l.trade_section === "Preliminaries");
    const prelimsTotal = explicitPrelims.length > 0
        ? explicitPrelims.reduce((s, l) => s + l.line_total, 0)
        : directCost * (estimate.prelims_pct / 100);

    const constructionTotal = directCost + prelimsTotal;
    const overhead = constructionTotal * (estimate.overhead_pct / 100);
    const risk = (constructionTotal + overhead) * (estimate.risk_pct / 100);
    const profit = (constructionTotal + overhead + risk) * (estimate.profit_pct / 100);
    const contractSum = constructionTotal + overhead + risk + profit;
    const discountAmt = contractSum * ((estimate.discount_pct || 0) / 100);
    const contractSumAfterDiscount = contractSum - discountAmt;
    const vat = contractSumAfterDiscount * 0.2;

    summaryRows.push(["Direct Construction Cost", formatGBP(directCost)]);
    if (prelimsTotal > 0) summaryRows.push(["Preliminaries", formatGBP(prelimsTotal)]);
    summaryRows.push(["Total Construction Cost", formatGBP(constructionTotal)]);
    if (estimate.overhead_pct > 0) summaryRows.push([`Overhead (${estimate.overhead_pct}%)`, formatGBP(overhead)]);
    if (estimate.risk_pct > 0) summaryRows.push([`Risk (${estimate.risk_pct}%)`, formatGBP(risk)]);
    if (estimate.profit_pct > 0) summaryRows.push([`Profit (${estimate.profit_pct}%)`, formatGBP(profit)]);
    if ((estimate.discount_pct || 0) > 0) summaryRows.push([`Discount (${estimate.discount_pct}%)`, `-${formatGBP(discountAmt)}`]);
    summaryRows.push(["CONTRACT SUM (exc. VAT)", formatGBP(contractSumAfterDiscount)]);
    summaryRows.push(["VAT (20%)", formatGBP(vat)]);
    summaryRows.push(["TOTAL inc. VAT", formatGBP(contractSumAfterDiscount + vat)]);

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
