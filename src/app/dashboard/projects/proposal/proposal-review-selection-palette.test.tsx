import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("proposal review selection controls", () => {
    const sourcePath = path.join(process.cwd(), "src/app/dashboard/projects/proposal/review-send-client.tsx");

    it("does not use bright-blue rings for payment or response choices", () => {
        const source = readFileSync(sourcePath, "utf8");
        expect(source).not.toMatch(/border-blue-500 ring-1 ring-blue-500/);
        expect(source).not.toMatch(/focus-visible:ring-blue-500/);
        expect(source).toContain("coreSelectedChoiceBorder");
        expect(source).toContain("coreFocusVisibleRing");
    });

    it("applies coreFormAccent to native payment/response/cover radios and checkboxes", () => {
        const source = readFileSync(sourcePath, "utf8");
        expect(source).toContain("coreFormAccent");
        expect(source).not.toMatch(/type="radio"[^>]*className="mt-1 w-5 h-5 flex-shrink-0"/);
        expect(source).not.toMatch(/type="checkbox"[^>]*className="mt-1 w-5 h-5 flex-shrink-0"/);
        const accentedNative =
            source.match(/className=\{`mt-1 w-5 h-5 flex-shrink-0 \$\{coreFormAccent\}`\}/g) ?? [];
        expect(accentedNative.length).toBe(8);
    });
});
