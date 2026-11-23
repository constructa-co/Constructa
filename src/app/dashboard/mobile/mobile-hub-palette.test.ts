import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(process.cwd(), "src/app/dashboard/mobile/mobile-hub-client.tsx"), "utf8");

describe("A001 mobile hub brand chrome", () => {
    it("uses sage/emerald for quick-log primary chrome, not legacy brand blue", () => {
        expect(source).toContain("core-editing-palette");
        expect(source).toContain("bg-emerald-600");
        expect(source).not.toMatch(/bg-blue-600 text-white/);
        expect(source).not.toMatch(/"bg-blue-600"/);
    });
});