import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { workspaceStyles } from "./workspace-styles";
import { ProjectPickerControls } from "@/components/sidebar-nav";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
function luminance(hex: string) {
    const values = hex.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16) / 255)
        .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
function contrast(a: string, b: string) {
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (values[0] + 0.05) / (values[1] + 0.05);
}
describe("Phase1 shared charcoal and sage-green controls", () => {
    it.each([true, false])("retains primary sizing and uses the established accent with readable dark ink: dark=%s", dark => {
        const styles = workspaceStyles(dark);
        expect(styles.primaryButton).toContain("bg-[#c9efcf]");
        expect(styles.primaryButton).toContain("text-[#182c1b]");
        expect(styles.primaryButton).toContain("min-h-12");
        expect(styles.input).toContain("text-base");
        expect(styles.input).toContain("ring-emerald-600");
        expect(styles.quietButton).not.toContain("blue-");
        expect(styles.errorBox).toContain("red-"); expect(styles.noticeBox).toContain("amber-");
        expect(styles.successBox).toContain("emerald-");
    });
    it("uses the same accent for selected project controls and preserves native labels/expansion state", () => {
        const html = renderToStaticMarkup(<ProjectPickerControls selected name="Example job" open={false} onToggle={() => {}} onClear={() => {}} />);
        expect(html).toContain("text-[#c9efcf]"); expect(html).not.toContain("blue-");
        expect(html).toContain('aria-expanded="false"'); expect(html).toContain('aria-label="Deselect project"');
        expect(html).toContain("min-h-11"); expect(html).toContain("Example job");
    });
    it("does not leave blue branding in the actual sidebar or shared guided controls", () => {
        expect(read("src/components/sidebar-nav.tsx")).not.toMatch(/(?:bg|text|border|ring)-blue-/);
        expect(read("src/lib/workspace-styles.ts")).not.toMatch(/(?:bg|text|border|ring)-blue-/);
    });
    it("checks the explicit palette pairs without claiming native accessibility certification", () => {
        expect(contrast("c9efcf", "182c1b")).toBeGreaterThan(7);
        expect(contrast("e0f9e3", "182c1b")).toBeGreaterThan(7);
        expect(contrast("059669", "ffffff")).toBeGreaterThan(3);
        expect(contrast("059669", "0d0d0d")).toBeGreaterThan(3);
    });
});
