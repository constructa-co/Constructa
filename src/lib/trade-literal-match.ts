/**
 * A031: which existing names appear whole in the contractor's own text.
 *
 * Case, Unicode width and punctuation are folded, nothing else: no splitting
 * of compound names, stemming, plurals, synonyms, fuzzy or AI matching, and no
 * mapping between words and trades. A hyphen or apostrophe inside a word
 * joins it ("re-roofing" is not "Roofing"). Pure, with no imports.
 */
function fold(value: string): string {
    return value.normalize("NFKC").toLowerCase()
        .replace(/(?<=[\p{L}\p{N}])['’\-‐‑](?=[\p{L}\p{N}])/gu, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
}

/** The names whose whole folded form appears in the text, in the names' own order, each once. */
export function literalNameMatches(names: readonly string[], text: string): string[] {
    const haystack = ` ${fold(text ?? "")} `;
    if (!haystack.trim()) return [];
    const matches: string[] = [];
    for (const name of names) {
        const needle = fold(name);
        if (needle && !matches.includes(name) && haystack.includes(` ${needle} `)) matches.push(name);
    }
    return matches;
}
