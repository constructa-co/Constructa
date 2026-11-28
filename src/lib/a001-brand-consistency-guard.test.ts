import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    A001_SOLID_PRIMARY_LINE_EXCEPTIONS,
    APPROVED_CHARCOAL_THEME_COLOR,
    APPROVED_ROOT_BODY_FONT_STACK,
    FORBIDDEN_DASHBOARD_HEADING_SERIF_RE,
    FORBIDDEN_DECORATIVE_BLUE_ORB_RE,
    FORBIDDEN_MANIFEST_BRAND_BLUE_THEME_RE,
    FORBIDDEN_MARKETING_PURPLE_DECOR_RE,
    FORBIDDEN_NEXT_FONT_GOOGLE_RE,
    FORBIDDEN_OFF_BRAND_SOLID_PRIMARY_RE,
    FORBIDDEN_PRIMARY_ACTION_RE,
    FORBIDDEN_THEME_COLOR_BRAND_BLUE_RE,
    filterForbiddenSolidPrimaryLines,
    findLinesMatching,
    relativePosixPath,
} from "./a001-brand-consistency-guard";

const ROOT = process.cwd();

function collectSourceFiles(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) {
            if (name === "node_modules" || name.endsWith(".test")) continue;
            collectSourceFiles(full, out);
        } else if (
            (name.endsWith(".tsx") || name.endsWith(".ts") || name.endsWith(".css")) &&
            !name.includes(".test.")
        ) {
            out.push(full);
        }
    }
    return out;
}

function scanTree(
    roots: string[],
    check: (rel: string, source: string) => string[] | null,
): { file: string; lines: string[] }[] {
    const violations: { file: string; lines: string[] }[] = [];
    for (const root of roots) {
        const abs = path.join(ROOT, root);
        for (const file of collectSourceFiles(abs)) {
            const rel = relativePosixPath(file, ROOT);
            const source = readFileSync(file, "utf8");
            const lines = check(rel, source);
            if (lines && lines.length > 0) violations.push({ file: rel, lines });
        }
    }
    return violations;
}

describe("A001 whole-app brand consistency guard", () => {
    const APP_ROOTS = ["src/app", "src/components"];

    it("root layout uses charcoal theme-color and not next/font/google Inter", () => {
        const layout = readFileSync(path.join(ROOT, "src/app/layout.tsx"), "utf8");
        expect(findLinesMatching(layout, FORBIDDEN_NEXT_FONT_GOOGLE_RE)).toEqual([]);
        expect(findLinesMatching(layout, FORBIDDEN_THEME_COLOR_BRAND_BLUE_RE)).toEqual([]);
        expect(layout).toContain(APPROVED_CHARCOAL_THEME_COLOR);
    });

    it("globals.css applies approved Avenir body stack", () => {
        const globals = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
        expect(globals).toContain("Avenir Next");
        expect(globals).toContain(APPROVED_ROOT_BODY_FONT_STACK);
    });

    it("PWA manifest theme_color matches charcoal (not brand link blue)", () => {
        const manifest = readFileSync(path.join(ROOT, "public/manifest.json"), "utf8");
        expect(findLinesMatching(manifest, FORBIDDEN_MANIFEST_BRAND_BLUE_THEME_RE)).toEqual([]);
        expect(manifest).toContain(`"theme_color": "${APPROVED_CHARCOAL_THEME_COLOR}"`);
    });

    it("has no next/font/google imports under src/app or src/components", () => {
        const violations = scanTree(APP_ROOTS, (_rel, source) =>
            findLinesMatching(source, FORBIDDEN_NEXT_FONT_GOOGLE_RE),
        );
        expect(violations).toEqual([]);
    });

    it("negative: guard patterns flag representative bad input samples", () => {
        expect(
            findLinesMatching(
                'import { Inter } from "next/font/google";\n<meta name="theme-color" content="#2563eb" />',
                FORBIDDEN_NEXT_FONT_GOOGLE_RE,
            ),
        ).toHaveLength(1);
        expect(
            findLinesMatching('<meta name="theme-color" content="#2563eb" />', FORBIDDEN_THEME_COLOR_BRAND_BLUE_RE),
        ).toHaveLength(1);
        expect(
            findLinesMatching(
                'className="px-2 bg-blue-600 hover:bg-blue-700 text-white"',
                FORBIDDEN_PRIMARY_ACTION_RE,
            ),
        ).toHaveLength(1);
        expect(
            findLinesMatching(
                'const x = ["#2563eb","#7c3aed","#059669"];',
                FORBIDDEN_OFF_BRAND_SOLID_PRIMARY_RE,
            ),
        ).toEqual([]);
    });

    it("has no legacy brand-blue primary action pairs (whole app incl. admin)", () => {
        const violations = scanTree(APP_ROOTS, (_rel, source) =>
            findLinesMatching(source, FORBIDDEN_PRIMARY_ACTION_RE),
        );
        expect(violations).toEqual([]);
    });

    it("marketing surfaces do not use purple decorative accent tokens", () => {
        const marketingRoot = path.join(ROOT, "src/components/marketing");
        const violations: { file: string; lines: string[] }[] = [];
        for (const file of collectSourceFiles(marketingRoot)) {
            const rel = relativePosixPath(file, ROOT);
            const source = readFileSync(file, "utf8");
            const lines = findLinesMatching(source, FORBIDDEN_MARKETING_PURPLE_DECOR_RE);
            if (lines.length > 0) violations.push({ file: rel, lines });
        }
        expect(violations).toEqual([]);
    });

    it("has no decorative blue background orbs on dashboard surfaces", () => {
        const violations = scanTree(["src/app/dashboard"], (_rel, source) =>
            findLinesMatching(source, FORBIDDEN_DECORATIVE_BLUE_ORB_RE),
        );
        expect(violations).toEqual([]);
    });

    it("off-brand solid primary hover pairs use line-scoped exceptions only", () => {
        const violations = scanTree(APP_ROOTS, (rel, source) => {
            const lines = filterForbiddenSolidPrimaryLines(
                rel,
                findLinesMatching(source, FORBIDDEN_OFF_BRAND_SOLID_PRIMARY_RE),
            );
            return lines.length ? lines : null;
        });
        expect(violations).toEqual([]);
    });

    it("dashboard headings avoid stray font-serif except proposal doc preview", () => {
        const violations = scanTree(["src/app/dashboard"], (rel, source) => {
            const lines = findLinesMatching(source, FORBIDDEN_DASHBOARD_HEADING_SERIF_RE);
            if (!lines.length) return null;
            if (rel.endsWith("projects/proposal/review-send-client.tsx")) return null;
            return lines;
        });
        expect(violations).toEqual([]);
    });

    it("semantic data-vis colour arrays are not treated as solid primaries (portfolio palette)", () => {
        const source = readFileSync(
            path.join(ROOT, "src/app/dashboard/resources/portfolio/portfolio-client.tsx"),
            "utf8",
        );
        expect(source).toMatch(/#2563eb/);
        expect(filterForbiddenSolidPrimaryLines("src/app/dashboard/resources/portfolio/portfolio-client.tsx", 
            findLinesMatching(source, FORBIDDEN_OFF_BRAND_SOLID_PRIMARY_RE))).toEqual([]);
    });

    it("documents line-scoped solid-primary exceptions with reasons", () => {
        expect(A001_SOLID_PRIMARY_LINE_EXCEPTIONS.length).toBeGreaterThan(0);
        for (const ex of A001_SOLID_PRIMARY_LINE_EXCEPTIONS) {
            expect(ex.fileSuffix.length).toBeGreaterThan(5);
            expect(ex.reason.length).toBeGreaterThan(10);
        }
    });
});