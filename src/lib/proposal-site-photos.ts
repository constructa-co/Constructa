/** Where a newly uploaded site photo should sit in the draft list. */
export type SitePhotoUploadTarget = "scope" | "cover";

export interface SitePhotoDraft {
    url: string;
    caption: string;
}

/** Cover uses the first site photo; cover uploads must prepend, scope uploads append. */
export function sitePhotosAfterUpload(
    photos: readonly SitePhotoDraft[],
    url: string,
    target: SitePhotoUploadTarget,
): SitePhotoDraft[] {
    const row: SitePhotoDraft = { url, caption: "" };
    return target === "cover" ? [row, ...photos] : [...photos, row];
}