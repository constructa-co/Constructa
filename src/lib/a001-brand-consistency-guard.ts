import path from "node:path";

/**
 * A001 whole-app brand consistency guard helpers.
 * Decorative / primary-action drift only — not semantic status, data-vis, or module-scoped AI chrome.
 */

export const APPROVED_ROOT_BODY_FONT_STACK =
    '"Avenir Next", Avenir, "Gill Sans", "Trebuchet MS", sans-serif';

/** PWA / browser chrome — matches manifest `background_color` charcoal. */
export const APPROVED_CHARCOAL_THEME_COLOR = "#0d0d0d";

export const FORBIDDEN_PRIMARY_ACTION_RE =
    /bg-blue-600\s+hover:bg-blue-700/;

/** Solid off-brand primary pairs (blue/purple/violet), not /opacity semantic chips. */
export const FORBIDDEN_OFF_BRAND_SOLID_PRIMARY_RE =
    /\b(bg-(?:blue|purple|violet)-600)\b[^\n`]{0,200}\bhover:bg-(?:blue|purple|violet)-(?:500|700)\b/;

/** Marketing feature blocks use sage/emerald accents, not purple decorative glows. */
export const FORBIDDEN_MARKETING_PURPLE_DECOR_RE = /\bbg-purple-500(?:\/|\b)/;

/** Decorative background orbs must use brand green, not link blue. */
export const FORBIDDEN_DECORATIVE_BLUE_ORB_RE = /\bbg-blue-600 rounded-full blur/;

export const FORBIDDEN_NEXT_FONT_GOOGLE_RE = /from\s+["']next\/font\/google["']/;

export const FORBIDDEN_THEME_COLOR_BRAND_BLUE_RE =
    /name=["']theme-color["'][^>]*content=["']#2563eb["']/i;

export const FORBIDDEN_MANIFEST_BRAND_BLUE_THEME_RE =
    /"theme_color"\s*:\s*"#2563eb"/;

/** Stray display serif on dashboard route headings (not proposal document preview). */
export const FORBIDDEN_DASHBOARD_HEADING_SERIF_RE =
    /<h[1-3]\b[^>]*className=(?:\{|")[^>\n]*font-serif/;

export interface A001SolidPrimaryLineException {
    /** Match `relativePosixPath` ending. */
    fileSuffix: string;
    linePattern: RegExp;
    reason: string;
}

/**
 * Line-level exceptions only — not whole-file immunity. New purple primaries
 * elsewhere still fail until explicitly scoped.
 */
export const A001_SOLID_PRIMARY_LINE_EXCEPTIONS: readonly A001SolidPrimaryLineException[] = [
    {
        fileSuffix: "projects/contracts/client-contract-editor.tsx",
        linePattern: /\bbg-purple-600\b[^\n`]{0,120}\bhover:bg-purple-700\b/,
        reason: "Contract Shield tier: approved purple AI primary actions",
    },
];

export function findLinesMatching(source: string, re: RegExp): string[] {
    const hits: string[] = [];
    for (const line of source.split("\n")) {
        if (re.test(line)) hits.push(line.trim());
    }
    return hits;
}

export function isAllowedSolidPrimaryLine(rel: string, line: string): boolean {
    return A001_SOLID_PRIMARY_LINE_EXCEPTIONS.some(
        (ex) => rel.endsWith(ex.fileSuffix) && ex.linePattern.test(line),
    );
}

export function filterForbiddenSolidPrimaryLines(rel: string, lines: string[]): string[] {
    return lines.filter((line) => !isAllowedSolidPrimaryLine(rel, line));
}

export function relativePosixPath(fullPath: string, root: string): string {
    return path.relative(root, fullPath).split(path.sep).join("/");
}