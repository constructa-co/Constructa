import { MAX_PRICE_ACTIVITY_LENGTH } from "@/lib/simple-estimate";

/**
 * Optional names for the new-price-line activity chooser.
 * Estimate activities come first, then saved Brief names. Nothing is written,
 * priced, classified, or trimmed.
 */
export function priceActivitySuggestions(
    lines: readonly { trade_section: string }[],
    briefSections: unknown,
): string[] {
    const seen = new Set<string>();
    const names: string[] = [];
    const add = (name: unknown) => {
        if (typeof name !== "string" || seen.has(name)) return;
        if (name.length === 0 || name.length > MAX_PRICE_ACTIVITY_LENGTH || name === "Preliminaries" || !/\S/.test(name)) return;
        seen.add(name);
        names.push(name);
    };
    for (const line of lines) add(line.trade_section);
    if (Array.isArray(briefSections)) {
        for (const section of briefSections) add(section);
    }
    return names;
}
