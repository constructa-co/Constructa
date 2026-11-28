import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    A001_SOLID_PRIMARY_EXCEPTION_PATHS,
    FORBIDDEN_DECORATIVE_BLUE_ORB_RE,
    FORBIDDEN_MARKETING_PURPLE_DECOR_RE,
    FORBIDDEN_OFF_BRAND_SOLID_PRIMARY_RE,
    FORBIDDEN_PRIMARY_ACTION_RE,
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
            if (rel.includes(`${path.sep}admin${path.sep}`)) continue;
            const source = readFileSync(file, "utf8");
            const lines = check(rel, source);
            if (lines && lines.length > 0) violations.push({ file: rel, lines });
        }
    }
    return violations;
}

describe("A001 whole-app brand consistency guard (marketing + signed-in)", () => {
    const APP_ROOTS = ["src/app", "src/components"];

    it("has no legacy brand-blue primary action pairs (bg-blue-600 hover:bg-blue-700)", () => {
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

    it("off-brand solid primary hover pairs are confined to scoped module exceptions", () => {
        const violations = scanTree(APP_ROOTS, (rel, source) => {
            const lines = findLinesMatching(source, FORBIDDEN_OFF_BRAND_SOLID_PRIMARY_RE);
            if (lines.length === 0) return null;
            if (rel in A001_SOLID_PRIMARY_EXCEPTION_PATHS) return null;
            return lines;
        });
        expect(violations).toEqual([]);
    });

    it("documents scoped solid-primary exceptions with reasons", () => {
        expect(Object.keys(A001_SOLID_PRIMARY_EXCEPTION_PATHS).length).toBeGreaterThan(0);
        for (const [file, reason] of Object.entries(A001_SOLID_PRIMARY_EXCEPTION_PATHS)) {
            expect(file.startsWith("src/")).toBe(true);
            expect(reason.length).toBeGreaterThan(10);
        }
    });
});