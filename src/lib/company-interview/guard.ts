/**
 * Tripwires for text that is about to be shown as a draft or saved.
 *
 * These are NOT fact checking. They cannot tell whether a statement is true.
 * They catch the commonest ways generated wording adds a claim nobody made
 * (a number, a membership, an award, a testimonial) so that such a reply is
 * dropped in favour of the fixed-rule draft. The contractor still reads and
 * approves everything; that approval, not this file, is the safeguard.
 */

/** Terms that assert a credential, guarantee or ranking. Flagged only when the sources do not contain them. */
const CLAIM_TERMS = [
    "gas safe", "niceic", "napit", "elecsa", "fmb", "federation of master builders", "trustmark", "checkatrade", "chas", "safecontractor",
    "constructionline", "nhbc", "iso 9001", "iso 14001", "city & guilds", "city and guilds", "nvq", "cscs", "fensa", "hetas", "oftec", "mcs",
    "accredited", "accreditation", "certified", "certificate", "registered", "approved", "qualified", "licensed", "chartered",
    "award", "guarantee", "guaranteed", "warranty", "insured", "insurance", "indemnity", "liability",
    "leading", "best", "number one", "no. 1", "#1", "top-rated", "five-star", "5-star", "trusted by", "hundreds of", "thousands of",
];

const normalise = (text: string) => text.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ");

export interface GuardOptions {
    maxWords?: number;
    maxChars?: number;
}

/**
 * Reasons a piece of generated text must not be used, given everything it was
 * allowed to draw on. Empty means no tripwire fired, which is not the same as
 * the text being true.
 */
export function addedClaims(output: string, sources: string[], options: GuardOptions = {}): string[] {
    const reasons: string[] = [];
    const text = normalise(output);
    const allowed = normalise(sources.join(" \n "));

    const allowedNumbers = new Set((allowed.match(/\d[\d,.]*\d|\d/g) ?? []).map((value) => value.replace(/,/g, "")));
    const addedNumbers = (text.match(/\d[\d,.]*\d|\d/g) ?? []).map((value) => value.replace(/,/g, "")).filter((value) => !allowedNumbers.has(value));
    if (addedNumbers.length > 0) reasons.push(`adds a number: ${Array.from(new Set(addedNumbers)).slice(0, 3).join(", ")}`);

    const addedTerms = CLAIM_TERMS.filter((term) => text.includes(term) && !allowed.includes(term));
    if (addedTerms.length > 0) reasons.push(`adds a claim: ${addedTerms.slice(0, 3).join(", ")}`);

    if (/["“”]/.test(output)) reasons.push("contains quoted speech");
    if (/[<>]|https?:|www\.|\S@\S|[*_#`]{2}|^\s*[-*#]\s/m.test(output)) reasons.push("contains markup, a link or an email address");
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(output)) reasons.push("contains control characters");

    const words = output.trim().split(/\s+/).filter(Boolean).length;
    if (words === 0) reasons.push("is empty");
    if (words > (options.maxWords ?? 220) || output.length > (options.maxChars ?? 2000)) reasons.push("is too long");
    return reasons;
}

/** Why text a contractor typed cannot be saved as it is, or null. Shape only: what they claim is theirs to claim. */
export function plainTextProblem(text: string, maxChars: number): string | null {
    const trimmed = text.trim();
    if (!trimmed) return "Write something first, or go back and answer a question.";
    if (trimmed.length > maxChars) return `That's too long. Please keep it under ${maxChars} characters.`;
    if (/[<>]/.test(trimmed) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(trimmed)) return "Use plain text only, without angle brackets or special characters.";
    return null;
}
