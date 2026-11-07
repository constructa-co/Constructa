import {
    PLATFORM_TERMS_AUTH_METADATA_ACCEPTED_AT,
    PLATFORM_TERMS_AUTH_METADATA_REVISION,
} from "@/lib/platform-terms";

/** Shape written to auth user metadata at sign-up when terms are accepted. */
export interface PlatformTermsSignupEvidence {
    [PLATFORM_TERMS_AUTH_METADATA_REVISION]: string;
    [PLATFORM_TERMS_AUTH_METADATA_ACCEPTED_AT]: string;
}

/**
 * Builds the server-side sign-up consent payload: trusted revision plus a
 * server timestamp (never read from the browser).
 */
export function buildPlatformTermsSignupEvidence(
    revision: string,
    acceptedAt: string,
): PlatformTermsSignupEvidence {
    return {
        [PLATFORM_TERMS_AUTH_METADATA_REVISION]: revision,
        [PLATFORM_TERMS_AUTH_METADATA_ACCEPTED_AT]: acceptedAt,
    };
}
