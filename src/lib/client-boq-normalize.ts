import type { ClientBoQLine } from "@/app/dashboard/projects/costs/boq-import-action";
import { parseBoQNumberCell, reconcileBoQLineTotal, type BoQNumberCell } from "./boq-number";

function asTrimmedString(value: unknown): string {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
}

function parseNumber(raw: unknown): BoQNumberCell {
    if (raw === null || raw === undefined) return { value: null, malformed: false };
    if (typeof raw === "number") {
        return Number.isFinite(raw) ? { value: raw, malformed: false } : { value: null, malformed: true };
    }
    return parseBoQNumberCell(String(raw));
}

function parseQuantity(raw: unknown): { quantity: number | null; malformed: boolean } {
    const { value, malformed } = parseNumber(raw);
    return { quantity: value, malformed };
}

function parseLineTotal(raw: unknown): { total: number | null; malformed: boolean } {
    const { value, malformed } = parseNumber(raw);
    return { total: value, malformed };
}

function parseRate(raw: unknown): { unit_rate: number; malformed: boolean } {
    const { value, malformed } = parseNumber(raw);
    return { unit_rate: value ?? 0, malformed };
}

function looksLikeSectionTitle(description: string, unit: string): boolean {
    const normalizedUnit = unit.toLowerCase();
    if (["heading", "section", "header"].includes(normalizedUnit)) return true;
    const words = description.trim().split(/\s+/).filter(Boolean);
    return words.length === 1 && description.length > 0 && description.length <= 48;
}

function isDescriptionOnlyHeading(description: string, quantity: number | null, unit: string, unit_rate: number): boolean {
    if (!description || quantity !== null) return false;
    const normalizedUnit = unit.toLowerCase();
    if (["heading", "section", "header"].includes(normalizedUnit)) return true;
    if (unit_rate !== 0) return false;
    // "item" is the placeholder the parser is told to use for headings; a real
    // unit such as nr or m2 marks an unpriced item and is kept as a line.
    if (!unit || normalizedUnit === "item") {
        return description.length > 0 && description.length <= 120;
    }
    return false;
}

/** Normalises AI/client BoQ rows: safe sections, heading rows, flagged bad qty/rate without inventing prices. */
export function normalizeClientBoQLines(rawLines: unknown[]): ClientBoQLine[] {
    const lines: ClientBoQLine[] = [];
    let currentSection = "General";

    for (const raw of rawLines) {
        if (!raw || typeof raw !== "object") continue;
        const row = raw as Record<string, unknown>;

        const sectionText = asTrimmedString(row.section);
        if (sectionText) currentSection = sectionText;

        const description = asTrimmedString(row.description);
        if (!description) continue;

        const unit = asTrimmedString(row.unit) || "item";
        const qty = parseQuantity(row.quantity);
        const rate = parseRate(row.unit_rate);

        const lineTotalParsed = parseLineTotal(row.line_total);
        const parse_warnings: string[] = [];
        if (qty.malformed) parse_warnings.push("quantity");
        if (rate.malformed) parse_warnings.push("unit_rate");
        if (lineTotalParsed.malformed) parse_warnings.push("line_total");

        const hasPricingSignal = qty.quantity !== null || rate.unit_rate !== 0 || lineTotalParsed.total !== null;
        if (!parse_warnings.length && !hasPricingSignal && isDescriptionOnlyHeading(description, qty.quantity, unit, rate.unit_rate)) {
            if (sectionText) currentSection = sectionText;
            else if (looksLikeSectionTitle(description, unit)) currentSection = description;
            const headingSection = sectionText || currentSection;
            lines.push({
                client_ref: asTrimmedString(row.client_ref),
                section: headingSection,
                description,
                quantity: null,
                unit: "item",
                unit_rate: 0,
                line_total: 0,
                ...(parse_warnings.length ? { parse_warnings } : {}),
            });
            continue;
        }

        const quantity = qty.malformed ? null : qty.quantity;
        const unit_rate = rate.malformed ? 0 : rate.unit_rate;
        const explicitTotal = lineTotalParsed.malformed ? null : lineTotalParsed.total;
        const { line_total, total_mismatch } = reconcileBoQLineTotal(quantity, unit_rate, explicitTotal);

        lines.push({
            client_ref: asTrimmedString(row.client_ref),
            section: currentSection,
            description,
            quantity,
            unit,
            unit_rate,
            line_total,
            ...(parse_warnings.length ? { parse_warnings } : {}),
            ...(total_mismatch ? { total_mismatch } : {}),
        });
    }

    return lines;
}