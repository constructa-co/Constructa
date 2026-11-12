/** Synthetic QA and injected lookups only — no live provider is activated here. */

export type PostcodeAddressCandidate = {
    id: string;
    /** Full multi-line address shown to the contractor and applied on explicit selection. */
    label: string;
};

export type PostcodeLookupResult =
    | { kind: "ok"; candidates: PostcodeAddressCandidate[] }
    | { kind: "not_found" }
    | { kind: "error" };

export type PostcodeLookupFn = (normalizedPostcode: string) => Promise<PostcodeLookupResult>;

export const POSTCODE_LOOKUP_NOT_AVAILABLE_MESSAGE =
    "Address search is not connected yet. Type the address below, use the structured parts helper, or describe an unusual site in your own words.";

export const POSTCODE_LOOKUP_NOT_FOUND_MESSAGE =
    "No addresses matched that postcode. Type the address below or use the structured parts helper.";

export const POSTCODE_LOOKUP_FAILED_MESSAGE =
    "Address search did not complete. Type the address below or use the structured parts helper.";

/** Normalise user input for lookup calls only (trim outer space, remove inner spaces, uppercase). */
export function normalizePostcodeForLookup(raw: string): string {
    return raw.trim().replace(/\s+/g, "").toUpperCase();
}

export function isPostcodeLookupInputPresent(raw: string): boolean {
    return normalizePostcodeForLookup(raw).length > 0;
}
