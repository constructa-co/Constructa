/** Line-like shape for batch section ordering (estimate import / advanced workspace). */
export type SectionedLine = { trade_section?: string | null };

/** Sections in first-seen line order — matches client BoQ batch and CSV import sequence. */
export function orderedEstimateSections(lines: readonly SectionedLine[]): string[] {
    const order: string[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
        const section = (line.trade_section?.trim() || "General");
        if (seen.has(section)) continue;
        seen.add(section);
        order.push(section);
    }
    return order;
}

/** Groups lines by trade_section without reordering rows inside a section. */
export function groupLinesBySection<T extends SectionedLine>(lines: readonly T[]): Record<string, T[]> {
    const groups: Record<string, T[]> = Object.create(null);
    for (const line of lines) {
        const section = line.trade_section?.trim() || "General";
        (groups[section] ??= []).push(line);
    }
    return groups;
}

/** Unique section headings in the order they first appear on parsed batch rows. */
export function batchSectionHeadings(lines: readonly { section: string }[]): string[] {
    const order: string[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
        const section = line.section.trim();
        if (!section || seen.has(section)) continue;
        seen.add(section);
        order.push(section);
    }
    return order;
}