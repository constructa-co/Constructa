import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PROFILE_FORM = path.join(
    process.cwd(),
    "src/app/dashboard/settings/profile/profile-form.tsx",
);

describe("company profile form brand action palette (A001)", () => {
    it("business_type and controls use shared sage/emerald tokens, not link blue", () => {
        const source = readFileSync(PROFILE_FORM, "utf8");
        expect(source).toContain('name="business_type"');
        expect(source).toContain("core-editing-palette");
        expect(source).toContain("coreProfileField");
        expect(source).not.toMatch(/focus:ring-blue/);
        expect(source).not.toMatch(/bg-blue-600/);
        expect(source).not.toMatch(/accent-blue/);
        expect(source).not.toMatch(/border-blue-400/);
    });

    it("preserves semantic PDF theme swatch colours (not brand-action blue)", () => {
        const source = readFileSync(PROFILE_FORM, "utf8");
        expect(source).toContain("#0A1628");
        expect(source).toContain("#0D0D0D");
        expect(source).toContain("#1A3A2A");
    });
});
