import Papa from "papaparse";
import { parseBoQNumberCell, reconcileBoQLineTotal, type BoQTotalMismatch } from "./boq-number";

export type EstimateBatchCsvLine = {
    client_ref: string;
    section: string;
    description: string;
    quantity: number | null;
    unit: string;
    unit_rate: number;
    line_total: number;
    parse_warnings?: string[];
    /** The file's Total disagreed with Qty × Rate; line_total holds Qty × Rate. Does not block import. */
    total_mismatch?: BoQTotalMismatch;
};

function headerKey(row: Record<string, string>, names: string[]): string | undefined {
    const entries = Object.entries(row);
    for (const name of names) {
        const hit = entries.find(([key]) => key.trim().toLowerCase() === name.toLowerCase());
        if (hit && hit[1]?.trim()) return hit[1].trim();
    }
    return undefined;
}

function isExplicitHeadingUnit(unit: string): boolean {
    return ["heading", "section", "header"].includes(unit.toLowerCase());
}

function isDescriptionOnlyHeadingRow(
    description: string,
    unitCell: string | undefined,
    qtyCell: string | undefined,
    rateCell: string | undefined,
    totalCell: string | undefined,
): boolean {
    if (qtyCell?.trim() || rateCell?.trim() || totalCell?.trim()) return false;
    if (unitCell && isExplicitHeadingUnit(unitCell)) return description.length > 0;
    // A real unit (m2, nr, tonne…) marks an unpriced item, not a heading.
    if (unitCell && unitCell.toLowerCase() !== "item") return false;
    const words = description.trim().split(/\s+/).filter(Boolean);
    return words.length === 1 && description.length > 0 && description.length <= 48;
}

/** Deterministic BoQ/estimate CSV (no AI). Preserves section headings and row order. */
export function parseEstimateBatchCsv(text: string):
    | { ok: true; lines: EstimateBatchCsvLine[]; sections: string[] }
    | { ok: false; error: string } {
    const parsed = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: "greedy" });
    if (parsed.errors.length) {
        return { ok: false, error: parsed.errors[0]?.message || "Could not read the CSV." };
    }
    const rows = parsed.data.filter(row => Object.values(row).some(cell => String(cell ?? "").trim()));
    if (!rows.length) return { ok: false, error: "The CSV has no data rows." };

    const lines: EstimateBatchCsvLine[] = [];
    let currentSection = "General";

    for (const row of rows) {
        const sectionCell = headerKey(row, ["section", "heading", "trade", "trade section", "activity"]);
        if (sectionCell) currentSection = sectionCell;

        const description = headerKey(row, ["description", "item", "work", "details"]) ?? "";
        if (!description) continue;

        const ref = headerKey(row, ["ref", "reference", "item ref", "client ref"]) ?? "";
        const unitCell = headerKey(row, ["unit", "uom"]);
        const unit = unitCell ?? "item";
        const qtyCell = headerKey(row, ["quantity", "qty", "q"]);
        const rateCell = headerKey(row, ["rate", "unit rate", "unit_rate", "price"]);
        const totalCell = headerKey(row, ["total", "line total", "line_total", "amount"]);
        const quantityParsed = parseBoQNumberCell(qtyCell);
        const rateParsed = parseBoQNumberCell(rateCell);
        const totalParsed = parseBoQNumberCell(totalCell);
        const parse_warnings: string[] = [];
        if (quantityParsed.malformed) parse_warnings.push("quantity");
        if (rateParsed.malformed) parse_warnings.push("unit_rate");
        if (totalParsed.malformed) parse_warnings.push("line_total");
        const quantity = quantityParsed.value;
        const unit_rate = rateParsed.malformed ? 0 : (rateParsed.value ?? 0);

        if (!parse_warnings.length && isDescriptionOnlyHeadingRow(description, unitCell, qtyCell, rateCell, totalCell)) {
            if (sectionCell) currentSection = sectionCell;
            else if (description.split(/\s+/).filter(Boolean).length === 1) currentSection = description;
            lines.push({
                client_ref: ref,
                section: currentSection,
                description,
                quantity: null,
                unit: "item",
                unit_rate: 0,
                line_total: 0,
            });
            continue;
        }

        const qty = quantityParsed.malformed ? null : quantity;
        const explicitTotal = totalParsed.malformed ? null : totalParsed.value;
        const { line_total, total_mismatch } = reconcileBoQLineTotal(qty, unit_rate, explicitTotal);
        const pricedUnit = unit.trim() || "item";
        lines.push({
            client_ref: ref,
            section: currentSection,
            description,
            quantity: qty,
            unit: pricedUnit,
            unit_rate,
            line_total,
            ...(parse_warnings.length ? { parse_warnings } : {}),
            ...(total_mismatch ? { total_mismatch } : {}),
        });
    }

    if (!lines.length) {
        return { ok: false, error: "No line items found. Expected columns such as Section, Description, Qty, Unit, Rate." };
    }

    const sections: string[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
        const section = line.section.trim() || "General";
        if (!seen.has(section)) {
            seen.add(section);
            sections.push(section);
        }
    }

    return { ok: true, lines, sections };
}