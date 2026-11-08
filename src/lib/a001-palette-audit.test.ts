import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findForbiddenPrimaryActionLines } from "./a001-palette-audit";

const ROOT = process.cwd();

function collectTsxFiles(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) {
            if (name === "(marketing)" || name === "node_modules") continue;
            collectTsxFiles(full, out);
        } else if (name.endsWith(".tsx") && !name.includes(".test.")) {
            out.push(full);
        }
    }
    return out;
}

const DASHBOARD_ROOT = path.join(ROOT, "src/app/dashboard");
const SHARED_ROOT = path.join(ROOT, "src/components");

describe("A001 palette audit (dashboard + shared components)", () => {
    it("has no legacy brand-blue primary action pairs under dashboard", () => {
        const files = collectTsxFiles(DASHBOARD_ROOT);
        const violations: { file: string; lines: string[] }[] = [];
        for (const file of files) {
            const rel = path.relative(ROOT, file);
            const source = readFileSync(file, "utf8");
            const lines = findForbiddenPrimaryActionLines(source);
            if (lines.length > 0) violations.push({ file: rel, lines });
        }
        expect(violations).toEqual([]);
    });

    it("has no legacy brand-blue primary action pairs in shared components (excluding marketing subtree)", () => {
        const files = collectTsxFiles(SHARED_ROOT).filter(
            f => !f.includes(`${path.sep}marketing${path.sep}`),
        );
        const violations: { file: string; lines: string[] }[] = [];
        for (const file of files) {
            const rel = path.relative(ROOT, file);
            const source = readFileSync(file, "utf8");
            const lines = findForbiddenPrimaryActionLines(source);
            if (lines.length > 0) violations.push({ file: rel, lines });
        }
        expect(violations).toEqual([]);
    });

    it("pipeline filter controls use emerald focus tokens, not blue rings", () => {
        const source = readFileSync(path.join(ROOT, "src/app/dashboard/dashboard-client.tsx"), "utf8");
        expect(source).toContain("coreFocusRing");
        expect(source).not.toMatch(/focus:ring-blue-/);
    });

    it("Initialize Kit name field uses core focus ring", () => {
        const source = readFileSync(
            path.join(ROOT, "src/app/dashboard/library/templates/create-kit-form.tsx"),
            "utf8",
        );
        expect(source).toContain("coreFocusRing");
        expect(source).not.toMatch(/focus:ring-blue-/);
    });
});
