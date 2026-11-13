import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("A001 pipeline list/board brand links and stage actions", () => {
    it("project-list Proposal link uses theme-aware pipeline token, status Estimating chip colours preserved", () => {
        const source = read("src/app/dashboard/project-list.tsx");
        expect(source).toContain("corePipelineTextLinkSmThemed(isDark)");
        expect(source).toContain("corePipelineTextLinkSmThemed");
        expect(source).not.toMatch(/text-blue-600 hover:underline/);
        expect(source).not.toMatch(/text-emerald-500/);
        expect(source).toMatch(/Estimating[\s\S]*bg-blue-500\/10/);
    });

    it("project-board Start Estimating CTA and P&L micro-link use sage/emerald colour tokens; 9px/900 typography preserved", () => {
        const source = read("src/app/dashboard/project-board.tsx");
        expect(source).toContain("corePipelineMutedIconButton(isDark)");
        expect(source).not.toMatch(/hover:text-blue-400/);
        expect(source).not.toMatch(/hover:text-blue-600/);
        expect(source).toContain("corePipelineMicroLinkColor(isDark)");
        expect(source).toMatch(/P&amp;L →[\s\S]*text-\[9px\] font-black uppercase tracking-widest/);
        expect(source).not.toMatch(/corePipelineTextLinkSm/);
        expect(source).toMatch(/Start Estimating[\s\S]*#c9efcf/);
        expect(source).toMatch(/id: "Estimating"[\s\S]*text-blue-400/);
    });
});
