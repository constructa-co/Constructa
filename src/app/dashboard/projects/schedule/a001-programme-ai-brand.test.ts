import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("A001 programme AI weekly update brand chrome", () => {
    it("Generate Update uses core sage primary; purple brand literals removed", () => {
        const source = read("src/app/dashboard/projects/schedule/programme-ai-update.tsx");
        expect(source).toContain("core-editing-palette");
        expect(source).toContain("corePrimaryButton");
        expect(source).not.toMatch(/bg-purple-600|hover:bg-purple-500/);
        expect(source).not.toMatch(/border-purple-500/);
        expect(source).toMatch(/text-emerald-400/);
    });
});