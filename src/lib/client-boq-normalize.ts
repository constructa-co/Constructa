import type { ClientBoQLine } from "@/app/dashboard/projects/costs/boq-import-action";

function asTrimmedString(value: unknown): string {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
}

function parseQuantity(raw: unknown): { quantity: number | null; malformed: boolean } {
    if (raw === null || raw === undefined) return { quantity: null, malformed: false };
    if (typeof raw === "number") {
        return Number.isFinite(raw) ? { quantity: raw, malformed: false } : { quantity: null, malformed: true };
    }
    const text = String(raw).trim();
    if (!text || text === "-") return { quantity: null, malformed: false };
    const value = Number(text.replace(/,/g, ""));
    return Number.isFinite(value) ? { quantity: value, malformed: false } : { quantity: null, malformed: true };
}

function parseRate(raw: unknown): { unit_rate: number; malformed: boolean } {
    if (raw === null || raw === undefined || raw === "") return { unit_rate: 0, malformed: false };
    if (typeof raw === "number") {
        return Number.isFinite(raw) ? { unit_rate: raw, malformed: false } : { unit_rate: 0, malformed: true };
    }
    const text = String(raw).trim();
    if (!text || text === "-") return { unit_rate: 0, malformed: false };
    const value = Number(text.replace(/,/g, ""));
    return Number.isFinite(value) ? { unit_rate: value, malformed: false } : { unit_rate: 0, malformed: true };
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
    if (!unit || normalizedUnit === "item" || normalizedUnit === "nr") {
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

        const sectionText = typeof row.section === "string" ? row.section.trim() : "";
        if (sectionText) currentSection = sectionText;

        const description = asTrimmedString(row.description);
        if (!description) continue;

        const unit = asTrimmedString(row.unit) || "item";
        const qty = parseQuantity(row.quantity);
        const rate = parseRate(row.unit_rate);

        const parse_warnings: string[] = [];
        if (qty.malformed) parse_warnings.push("quantity");
        if (rate.malformed) parse_warnings.push("unit_rate");

        if (isDescriptionOnlyHeading(description, qty.quantity, unit, rate.unit_rate)) {
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
        const line_total = quantity !== null && !qty.malformed && !rate.malformed
            ? quantity * unit_rate
            : 0;

        lines.push({
            client_ref: asTrimmedString(row.client_ref),
            section: currentSection,
            description,
            quantity,
            unit,
            unit_rate,
            line_total,
            ...(parse_warnings.length ? { parse_warnings } : {}),
        });
    }

    return lines;
}