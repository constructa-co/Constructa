import Papa from "papaparse";

export type EstimateBatchCsvLine = {
    client_ref: string;
    section: string;
    description: string;
    quantity: number | null;
    unit: string;
    unit_rate: number;
    line_total: number;
    parse_warnings?: string[];
};

function headerKey(row: Record<string, string>, names: string[]): string | undefined {
    const entries = Object.entries(row);
    for (const name of names) {
        const hit = entries.find(([key]) => key.trim().toLowerCase() === name.toLowerCase());
        if (hit && hit[1]?.trim()) return hit[1].trim();
    }
    return undefined;
}

function parseFiniteNumber(raw: string | undefined): { value: number | null; malformed: boolean } {
    if (raw === undefined || !raw.trim() || raw.trim() === "-") return { value: null, malformed: false };
    const value = Number(raw.replace(/,/g, "").trim());
    return Number.isFinite(value) ? { value, malformed: false } : { value: null, malformed: true };
}

function isHeadingRow(description: string, quantity: number | null, unit: string, rate: number | null): boolean {
    if (quantity !== null) return false;
  if (rate !== null && rate !== 0) return false;
    const normalizedUnit = unit.toLowerCase();
    if (["heading", "section", "header"].includes(normalizedUnit)) return true;
    if (!unit || normalizedUnit === "item" || normalizedUnit === "nr") {
        return description.length > 0 && description.length <= 120;
    }
    return false;
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
        const unit = headerKey(row, ["unit", "uom"]) ?? "item";
        const qtyCell = headerKey(row, ["quantity", "qty", "q"]);
        const rateCell = headerKey(row, ["rate", "unit rate", "unit_rate", "price"]);
        const quantityParsed = parseFiniteNumber(qtyCell);
        const rateParsed = parseFiniteNumber(rateCell);
        const parse_warnings: string[] = [];
        if (quantityParsed.malformed) parse_warnings.push("quantity");
        if (rateParsed.malformed) parse_warnings.push("unit_rate");
        const quantity = quantityParsed.value;
        const unit_rate = rateParsed.malformed ? 0 : (rateParsed.value ?? 0);

        const isDescriptionOnly =
            !qtyCell?.trim() && !rateCell?.trim() && (quantity === null) && unit_rate === 0
            && description.length > 0 && description.length <= 120;

        if (isDescriptionOnly || isHeadingRow(description, quantity, unit, rateParsed.malformed ? null : (rateParsed.value ?? 0))) {
            if (sectionCell) currentSection = sectionCell;
            lines.push({
                client_ref: ref,
                section: currentSection,
                description,
                quantity: null,
                unit: "item",
                unit_rate: 0,
                line_total: 0,
                ...(parse_warnings.length ? { parse_warnings } : {}),
            });
            continue;
        }

        const qty = quantityParsed.malformed ? null : quantity;
        const line_total = qty !== null && !quantityParsed.malformed && !rateParsed.malformed ? qty * unit_rate : 0;
        lines.push({
            client_ref: ref,
            section: currentSection,
            description,
            quantity: qty,
            unit,
            unit_rate,
            line_total,
            ...(parse_warnings.length ? { parse_warnings } : {}),
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