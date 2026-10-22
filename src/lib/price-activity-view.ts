import { roundMoney } from "./financial";

interface ActivityLine { trade_section?: string | null; line_total?: number | string | null }
export interface ActivitySubtotal { section: string; lineCount: number; blocks: number; amount: number | null }
export interface ActivityPriceRow<T> {
    line: T;
    heading: { section: string; continued: boolean } | null;
    subtotal: ActivitySubtotal | null;
}

/** Display decorations only. Keep every line/reference in its original order. */
export function priceActivityRows<T extends ActivityLine>(lines: readonly T[]): ActivityPriceRow<T>[] {
    const groups = new Map<string, ActivitySubtotal & { last: number }>();
    let previous: string | null = null;
    lines.forEach((line, index) => {
        const section = line.trade_section || "General";
        const group = groups.get(section) ?? { section, lineCount: 0, blocks: 0, amount: 0, last: index };
        const raw = line.line_total;
        const value = raw === null || raw === undefined || (typeof raw === "string" && !raw.trim()) ? NaN : Number(raw);
        group.lineCount++; group.last = index;
        if (section !== previous) group.blocks++;
        group.amount = group.amount === null || !Number.isFinite(value) ? null : group.amount + value;
        groups.set(section, group); previous = section;
    });
    const seen = new Set<string>();
    previous = null;
    return lines.map((line, index) => {
        const section = line.trade_section || "General", group = groups.get(section)!;
        const heading = section !== previous ? { section, continued: seen.has(section) } : null;
        seen.add(section); previous = section;
        return { line, heading, subtotal: index === group.last ? {
            section, lineCount: group.lineCount, blocks: group.blocks,
            amount: group.amount === null || !Number.isFinite(group.amount) ? null : roundMoney(group.amount),
        } : null };
    });
}
