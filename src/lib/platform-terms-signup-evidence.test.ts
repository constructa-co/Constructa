import { describe, expect, it } from "vitest";
import {
    PLATFORM_TERMS_AUTH_METADATA_ACCEPTED_AT,
    PLATFORM_TERMS_AUTH_METADATA_REVISION,
    PLATFORM_TERMS_CURRENT_REVISION,
} from "@/lib/platform-terms";
import { buildPlatformTermsSignupEvidence } from "@/lib/platform-terms-signup-evidence";

describe("platform terms sign-up evidence payload", () => {
    it("pairs the trusted revision with a server timestamp", () => {
        const acceptedAt = "2026-11-07T08:00:00.000Z";
        expect(buildPlatformTermsSignupEvidence(PLATFORM_TERMS_CURRENT_REVISION, acceptedAt)).toEqual({
            [PLATFORM_TERMS_AUTH_METADATA_REVISION]: PLATFORM_TERMS_CURRENT_REVISION,
            [PLATFORM_TERMS_AUTH_METADATA_ACCEPTED_AT]: acceptedAt,
        });
    });
});
