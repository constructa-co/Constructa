import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("proposal review selection controls", () => {
    it("does not use bright-blue rings for payment or response choices", () => {
        const source = readFileSync(
            path.join(process.cwd(), "src/app/dashboard/projects/proposal/review-send-client.tsx"),
            "utf8",
        );
        expect(source).not.toMatch(/border-blue-500 ring-1 ring-blue-500/);
        expect(source).not.toMatch(/focus-visible:ring-blue-500/);
        expect(source).toContain("coreSelectedChoiceBorder");
        expect(source).toContain("coreFocusVisibleRing");
    });
});
