import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("CON-032 advanced estimating panel layout", () => {
    const css = readFileSync(path.resolve(import.meta.dirname, "../../../../components/estimating.module.css"), "utf8");
    const client = readFileSync(path.resolve(import.meta.dirname, "estimate-client.tsx"), "utf8");
    const advanced = readFileSync(path.resolve(import.meta.dirname, "advanced-estimate.tsx"), "utf8");

    it("lifts the advanced workspace above the sticky total dock and reserves bottom space", () => {
        expect(css).toMatch(/\.advancedWorkspaceRoot[\s\S]*z-index:\s*15/);
        expect(css).toMatch(/\.advancedWorkspaceRoot[\s\S]*padding-bottom:\s*6rem/);
        expect(css).toMatch(/\.totalDock[\s\S]*z-index:\s*20/);
        expect(css).toMatch(/\.advancedWorkspaceScroller[\s\S]*overflow:\s*visible/);
        expect(css).toMatch(/\.advancedWorkspaceWide[\s\S]*overflow-y:\s*visible/);
        expect(client).toContain("ui.advancedWorkspaceRoot");
        expect(client).toContain("ui.advancedWorkspaceScroller");
        expect(advanced).toContain("createPortal");
    });
});