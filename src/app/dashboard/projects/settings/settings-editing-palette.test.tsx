import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("project settings editing palette", () => {
    it("uses core emerald focus rings on ordinary fields, not blue", () => {
        const source = readFileSync(
            path.join(process.cwd(), "src/app/dashboard/projects/settings/client-page.tsx"),
            "utf8",
        );
        expect(source).toContain("coreFocusRing");
        expect(source).not.toMatch(/focus:ring-blue/);
    });
});
