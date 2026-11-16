/**
 * CON-034 — postcodes.io lookup behind an explicit deployment flag, with a clear
 * manual fallback when address search is not enabled.
 */

import {
    normalizePostcodeForLookup,
    POSTCODE_LOOKUP_FAILED_MESSAGE,
    POSTCODE_LOOKUP_NOT_FOUND_MESSAGE,
    type PostcodeLookupFn,
    type PostcodeLookupResult,
} from "@/lib/postcode-address";

export const POSTCODE_LOOKUP_ENV = "NEXT_PUBLIC_POSTCODE_LOOKUP_ENABLED";

export const POSTCODE_LOOKUP_CONFIGURATION_GAP =
    "Address search is not enabled on this deployment (set NEXT_PUBLIC_POSTCODE_LOOKUP_ENABLED=1 to use postcodes.io). Until then, type the address below or use the structured parts helper.";

export const POSTCODE_LOOKUP_PROVIDER = "postcodes.io";

function titleCase(str: string): string {
    return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isPostcodeLookupEnabled(): boolean {
    return process.env.NEXT_PUBLIC_POSTCODE_LOOKUP_ENABLED === "1";
}

export function postcodeLookupConfigurationGap(): string | null {
    return isPostcodeLookupEnabled() ? null : POSTCODE_LOOKUP_CONFIGURATION_GAP;
}

/** Area-level candidates from the authorised postcodes.io API (no paid street index). */
export const postcodesIoLookup: PostcodeLookupFn = async (normalizedPostcode) => {
    const trimmed = normalizePostcodeForLookup(normalizedPostcode);
    if (!trimmed) return { kind: "not_found" };

    let response: Response;
    try {
        response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed)}`);
    } catch {
        return { kind: "error" };
    }

    let data: { status?: number; result?: Record<string, unknown> };
    try {
        data = (await response.json()) as { status?: number; result?: Record<string, unknown> };
    } catch {
        return { kind: "error" };
    }

    if (data.status === 200 && data.result) {
        const r = data.result;
        const postcode = String(r.postcode ?? trimmed).toUpperCase();
        const label = [
            r.parish,
            r.admin_ward,
            r.admin_district,
            r.admin_county || r.region,
            postcode,
        ]
            .filter((part) => typeof part === "string" && part.trim().length > 0)
            .map((part) => titleCase(String(part).trim()))
            .join("\n");

        if (!label) return { kind: "not_found" };

        return {
            kind: "ok",
            candidates: [{ id: postcode.replace(/\s+/g, ""), label }],
        } satisfies PostcodeLookupResult;
    }

    if (data.status === 404) return { kind: "not_found" };
    return { kind: "error" };
};

/** Lookup passed into client address pickers when the deployment flag is on. */
export function clientPostcodeLookup(): PostcodeLookupFn | undefined {
    return isPostcodeLookupEnabled() ? postcodesIoLookup : undefined;
}

export { POSTCODE_LOOKUP_FAILED_MESSAGE, POSTCODE_LOOKUP_NOT_FOUND_MESSAGE };