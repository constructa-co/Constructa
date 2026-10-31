import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// A001 resources hub primary actions (staff / plant / portfolio): the real
// add/save primary buttons now use the approved charcoal/sage core palette with
// a visible focus ring, not brand blue. Geometry, disabled rules, handlers,
// copy and semantic blues (badges, info banners, money figures, input focus)
// are retained. Source-level check, not computed contrast.
const ROOT = path.join(process.cwd(), "src/app/dashboard/resources");

const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

// Literal source template used by the corrected buttons (not the evaluated value).
const BRAND_PRIMARY_SOURCE = "${corePrimaryButton} hover:bg-[#e0f9e3] ${coreFocusVisibleRing}";

function forbiddenActionBlue(source: string): string[] {
    const hits: string[] = [];
    for (const pattern of [/bg-blue-600/g, /hover:bg-blue-[57]00/g]) {
        hits.push(...(source.match(pattern) ?? []));
    }
    return hits;
}

describe("A001 resources primary palette", () => {
    it.each([
        ["staff/staff-client.tsx", 3],
        ["plant/plant-client.tsx", 3],
        ["portfolio/portfolio-client.tsx", 3],
    ] as const)("%s: primary actions use the core sage palette + focus ring, no brand blue", (rel, count) => {
        const source = read(rel);
        expect(source).toContain("core-editing-palette");
        expect(source.split(BRAND_PRIMARY_SOURCE).length - 1).toBe(count);
        const forbidden = forbiddenActionBlue(source);
        expect(forbidden, `brand blue remnants: ${forbidden.join(", ")}`).toEqual([]);
    });

    it("staff: submit keeps type/disabled semantics and copy; cancel stays outline; semantic blues stay", () => {
        const source = read("staff/staff-client.tsx");
        expect(source).toContain('type="submit"');
        expect(source).toContain("disabled={isPending}");
        expect(source).toContain('{isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Staff Member"}');
        expect(source).toContain("+ Add Staff Member");
        // Cancel stays the outline secondary; destructive table actions untouched.
        expect(source).toContain('variant="outline"');
        expect(source).toContain("deleteStaffResourceAction(row.id)");
        // Status badge and chargeout money figures are semantic, not actions.
        expect(source).toMatch(/bg-blue-900\/50 text-blue-300/);
        expect(source).toContain("text-blue-300 font-semibold");
        // Ordinary field focus stays as-is (separate seam from primary actions).
        expect(source).toContain("focus:border-blue-500");
    });

    it("plant: submit keeps disabled rules and spinner; add copies retained; money/selection blues stay", () => {
        const source = read("plant/plant-client.tsx");
        expect(source).toContain("disabled={isPending || !form.name.trim()}");
        expect(source).toContain("disabled:opacity-50 disabled:pointer-events-none");
        expect(source).toContain("<Loader2 className=\"w-4 h-4 animate-spin\" />");
        expect(source).toContain("Add Plant Item");
        expect(source).toContain("Add First Asset");
        // Money figures and the rate-mode selected card stay semantic blue.
        expect(source).toContain("text-blue-300 tabular-nums");
        expect(source).toContain('? "border-blue-500 bg-blue-950/40"');
        // Ordinary field focus stays as-is.
        expect(source).toContain("focus:ring-blue-600");
    });

    it("portfolio: allocation/save copies retained; info banner and legend blues stay", () => {
        const source = read("portfolio/portfolio-client.tsx");
        expect(source).toContain("Add Allocation");
        expect(source).toContain("Save");
        // The informational banner and Gantt legend swatch are not actions.
        expect(source).toContain("bg-blue-900/20 border border-blue-700/40");
        expect(source).toContain("bg-blue-500/60 border border-blue-500/40");
        // Secondary actions keep their existing neutral treatment.
        expect(source).toContain("border border-slate-700 text-slate-300");
        expect(source).toContain("Record Absence");
    });
});
