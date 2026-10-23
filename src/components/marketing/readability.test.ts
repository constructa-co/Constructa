import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const css = postcss.parse(readFileSync(new URL("./phase-one.module.css", import.meta.url), "utf8"));
const sidebar = readFileSync(new URL("../sidebar-nav.tsx", import.meta.url), "utf8");
function declarations(selector: string, phone = false) {
    const values: Record<string, string> = {};
    css.walkRules(rule => {
        if (rule.selector !== selector) return;
        const media = rule.parent?.type === "atrule" ? String("params" in rule.parent ? rule.parent.params : "") : "";
        if (media && !(phone && media === "(max-width: 450px)")) return;
        rule.walkDecls(decl => { values[decl.prop] = decl.value; });
    });
    return values;
}
function rgb(hex: string) { return hex.replace("#", "").match(/../g)!.map(value => parseInt(value, 16)); }
function contrast(a: number[], b: number[]) {
    const luminance = (rgb: number[]) => rgb.map(value => {
        const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
    const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
const over = (fg: string, bg: string, alpha: number) => rgb(fg).map((c, i) => alpha * c + (1 - alpha) * rgb(bg)[i]);

describe("declared readability checks, not a rendered accessibility certification", () => {
    it.each([
        [".reviewNote", 14], [".visualHeader", 12], [".visual figcaption", 13], [".stageTop", 12],
        [".journey small", 14], [".photo > span", 13], [".scopeList > .scopeNote", 14],
        [".invitation small", 13], [".footerTop nav", 14], [".footerBottom", 13],
    ] as const)("keeps %s at the selected readable size", (selector, min) => {
        expect(parseFloat(declarations(selector)["font-size"])).toBeGreaterThanOrEqual(min);
    });
    it("does not shrink the mobile eyebrow below the desktop 12px label", () => {
        expect(parseFloat(declarations(".eyebrow")["font-size"])).toBeGreaterThanOrEqual(12);
        expect(parseFloat(declarations(".eyebrow", true)["font-size"])).toBeGreaterThanOrEqual(12);
    });
    it("checks new sidebar foregrounds and focus outline against the actual declared black", () => {
        expect(sidebar).toContain("bg-[#0d0d0d]");
        for (const foreground of ["#b7c8bb", "#d6ded7", "#c9efcf"]) {
            expect(sidebar).toContain(foreground);
            expect(contrast(rgb(foreground), rgb("#0d0d0d"))).toBeGreaterThanOrEqual(4.5);
        }
        expect(sidebar).not.toContain("w-3 h-3 text-slate-600 group-hover:text-slate-400");
    });
    it("distinguishes old readable text from the weaker chevron using the installed palette", () => {
        const colors = createRequire(import.meta.url)("tailwindcss/colors");
        expect(contrast(rgb(colors.slate[400]), rgb("#0d0d0d"))).toBeGreaterThan(4.5);
        expect(contrast(rgb(colors.slate[600]), rgb("#0d0d0d"))).toBeLessThan(3);
    });
    it("checks normal marketing muted text across declared base/panel/journey and gradient endpoint envelopes", () => {
        const variables = declarations(".theme"), foreground = rgb(variables["--muted"]);
        const backgrounds = [rgb(variables["--base"]), rgb(variables["--panel"]), rgb("#151a16"),
            over("#263d2b", "#101211", 0x55 / 255), over("#35563b", "#101211", 0x50 / 255), over("#35563b", "#19241d", 0x80 / 255)];
        for (const background of backgrounds) expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(rgb(declarations(".journey small").color), rgb("#151a16"))).toBeGreaterThanOrEqual(4.5);
        for (const background of ["#314136", "#1b241e"]) expect(contrast(rgb(declarations(".visual figcaption").color), rgb(background))).toBeGreaterThanOrEqual(4.5);
    });
});
