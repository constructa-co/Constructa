export const MANUAL_ADDRESS_MAX_LENGTH = 500;

export type ManualAddressParts = {
    line1: string;
    line2: string;
    townCity: string;
    postcode: string;
};

export const EMPTY_MANUAL_ADDRESS_PARTS: ManualAddressParts = {
    line1: "",
    line2: "",
    townCity: "",
    postcode: "",
};

/** Join deliberately entered non-blank parts (edge-trimmed only) with newlines. */
export function joinManualAddressPreview(parts: ManualAddressParts): string {
    return [parts.line1, parts.line2, parts.townCity, parts.postcode]
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .join("\n");
}

export function manualAddressPreviewTooLong(preview: string): boolean {
    return preview.length > MANUAL_ADDRESS_MAX_LENGTH;
}

export function canUseManualAddressPreview(preview: string): boolean {
    return preview.length > 0 && preview.length <= MANUAL_ADDRESS_MAX_LENGTH;
}

/** True when structured fields would produce a preview that has not been applied via Use. */
export function manualAddressDraftPending(parts: ManualAddressParts, lastUsedPreview: string): boolean {
    const preview = joinManualAddressPreview(parts);
    return preview.length > 0 && preview !== lastUsedPreview;
}

/** Shown when Create/Try again is blocked because structured parts were not applied via Use. */
export const MANUAL_ADDRESS_UNAPPLIED_CREATE_MESSAGE =
    "You have address parts that are not applied yet. Choose Use this address for each structured entry, or clear those parts, before creating the job.";
