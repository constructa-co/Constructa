import path from "node:path";

/**
 * A001 whole-app brand consistency guard helpers.
 * Decorative / primary-action drift only — not semantic status, data-vis, or module-scoped AI chrome.
 */

export const FORBIDDEN_PRIMARY_ACTION_RE =
    /bg-blue-600\s+hover:bg-blue-700/;

/** Solid off-brand primary pairs (blue/purple/violet), not /opacity semantic chips. */
export const FORBIDDEN_OFF_BRAND_SOLID_PRIMARY_RE =
    /\b(bg-(?:blue|purple|violet)-600)\b[^\n`]{0,200}\bhover:bg-(?:blue|purple|violet)-(?:500|700)\b/;

/** Marketing feature blocks use sage/emerald accents, not purple decorative glows. */
export const FORBIDDEN_MARKETING_PURPLE_DECOR_RE = /\bbg-purple-500(?:\/|\b)/;

/** Decorative background orbs must use brand green, not link blue. */
export const FORBIDDEN_DECORATIVE_BLUE_ORB_RE = /\bbg-blue-600 rounded-full blur/;

/**
 * Files where purple/violet solid primary pairs are an approved module identity
 * (Contract Shield, contract-admin AI drafts). New files must not be added here
 * without product sign-off.
 */
export const A001_SOLID_PRIMARY_EXCEPTION_PATHS: Readonly<Record<string, string>> = {
    "src/app/dashboard/projects/contracts/client-contract-editor.tsx":
        "Contract Shield tier: approved purple AI primary actions",
    "src/app/dashboard/projects/contract-admin/contract-admin-client.tsx":
        "Contract admin: scoped purple AI draft controls (not global primaries)",
};

export function findLinesMatching(source: string, re: RegExp): string[] {
    const hits: string[] = [];
    for (const line of source.split("\n")) {
        if (re.test(line)) hits.push(line.trim());
    }
    return hits;
}

export function relativePosixPath(fullPath: string, root: string): string {
    return path.relative(root, fullPath).split(path.sep).join("/");
}