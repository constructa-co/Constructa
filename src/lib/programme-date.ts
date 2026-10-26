/** UTC midnight for a YYYY-MM-DD date, or null when it is not a real date. */
export function parseIsoDate(value: unknown): number | null {
    if (typeof value !== "string") return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim().slice(0, 10));
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const ms = Date.UTC(year, month - 1, day);
    const date = new Date(ms);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return ms;
}
