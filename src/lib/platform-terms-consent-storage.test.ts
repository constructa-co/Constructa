import { describe, expect, it } from "vitest";
import {
    PLATFORM_TERMS_CONSENT_TABLE_MISSING_CODES,
    isPlatformTermsConsentTableMissing,
} from "@/lib/platform-terms-consent-storage";

describe("platform-terms consent table readiness", () => {
    it("treats PostgREST and Postgres missing-relation codes as not installed", () => {
        for (const code of PLATFORM_TERMS_CONSENT_TABLE_MISSING_CODES) {
            expect(isPlatformTermsConsentTableMissing({ code, message: "relation missing" })).toBe(true);
        }
        expect(isPlatformTermsConsentTableMissing({ code: "23505", message: "duplicate" })).toBe(false);
        expect(isPlatformTermsConsentTableMissing(null)).toBe(false);
    });
});
