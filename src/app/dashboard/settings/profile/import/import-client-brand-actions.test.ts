import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("website import profile form brand accents (A001)", () => {
    it("checkbox accents use emerald, not blue", () => {
        const source = readFileSync(
            path.join(process.cwd(), "src/app/dashboard/settings/profile/import/import-client.tsx"),
            "utf8",
        );
        expect(source).toContain("coreFormAccent");
        expect(source).not.toMatch(/accent-blue/);
    });
});
