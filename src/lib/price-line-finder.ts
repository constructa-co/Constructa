interface FindablePriceLine { id: string; description?: string | null; trade_section?: string | null }

/** Find existing rows only; never replace, filter or reinterpret their prices. */
export function findPriceLineIds(lines: readonly FindablePriceLine[], query: string): string[] {
    const text = query.trim().toLowerCase();
    if (!text) return [];
    return lines.filter(line => (line.description ?? "").toLowerCase().includes(text)
        || (line.trade_section ?? "").toLowerCase().includes(text)).map(line => line.id);
}

export function nextPriceLineMatch(ids: readonly string[], active: string | null, direction: 1 | -1): string | null {
    if (!ids.length) return null;
    const index = active === null ? -1 : ids.indexOf(active);
    return ids[index < 0 ? direction === 1 ? 0 : ids.length - 1 : (index + direction + ids.length) % ids.length];
}
