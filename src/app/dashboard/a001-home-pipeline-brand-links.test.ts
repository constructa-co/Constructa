import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("A001 home command-centre pipeline navigation brand links", () => {
    it("uses pipeline link tokens for pipeline entry affordances; status and module semantics stay coloured", () => {
        const source = read("src/app/dashboard/home/home-client.tsx");
        expect(source).toContain("corePipelineTextLinkSmThemed");
        expect(source).toContain("corePipelineTextLinkSmThemed(true)");
        expect(source).not.toMatch(/hover:text-blue-300/);
        expect(source).toMatch(/New Project[\s\S]*text-emerald-400/);
        expect(source).toMatch(/View Pipeline[\s\S]*text-emerald-400/);
        // Semantic stage / module colours are not navigation-brand fixes.
        expect(source).toMatch(/estimating:\s*"bg-blue-500\/15 text-blue-400"/);
        expect(source).toMatch(/potential_value > 0 && <p className="text-sm font-semibold text-emerald-400"/);
        expect(source).toMatch(/proposal_sent:\s*"bg-purple-500\/15 text-purple-400"/);
        expect(source).not.toMatch(/Win Rate \(90d\)[\s\S]*text-purple-400/);
    });
});
