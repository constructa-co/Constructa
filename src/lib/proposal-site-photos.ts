/**
 * Site photographs belong to one job.
 *
 * A photo added on the proposal screen is stored in the `proposal-photos`
 * bucket under `<user id>/proposal/<project id>/`. The same bucket also holds
 * company branding and case-study images, and other jobs' photographs. A link
 * that plainly names one of those is not a photograph of this site, so it is
 * never saved to this job or shown under "Site photographs".
 *
 * A link that does not follow the upload layout at all (an older upload, or
 * an image hosted elsewhere) says nothing about which job it is from. It is
 * left as it is: nothing here guesses.
 */

const BUCKET_MARKER = "/proposal-photos/";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** What the profile uploader stores in the same bucket. Never a site photograph. */
const OTHER_PURPOSES = new Set(["branding", "case-study"]);

export type SitePhotoOrigin = "this-job" | "elsewhere" | "unknown";

export interface SitePhotoJob {
    projectId: string;
    /** When known, the photo must also sit in this contractor's own folder. */
    userId?: string | null;
}

export const SITE_PHOTO_ELSEWHERE_ERROR =
    "One of the photos was not uploaded for this job, so it can't be used here. Remove it and add the photo again.";

function segment(value: string | undefined): string {
    if (!value) return "";
    try {
        return decodeURIComponent(value).toLowerCase();
    } catch {
        return "";
    }
}

/** Where a site photo link says it was uploaded, read from the link alone. */
export function sitePhotoOrigin(url: string, job: SitePhotoJob): SitePhotoOrigin {
    let path: string;
    try {
        path = new URL(url).pathname;
    } catch {
        return "unknown";
    }
    const at = path.indexOf(BUCKET_MARKER);
    if (at === -1) return "unknown";

    const [owner = "", purpose = "", project = ""] = path.slice(at + BUCKET_MARKER.length).split("/").map(segment);
    if (!UUID.test(owner)) return "unknown";
    if (OTHER_PURPOSES.has(purpose)) return "elsewhere";
    if (purpose !== "proposal" || !UUID.test(project)) return "unknown";

    if (project !== String(job.projectId ?? "").toLowerCase()) return "elsewhere";
    if (job.userId && owner !== job.userId.toLowerCase()) return "elsewhere";
    return "this-job";
}

/** The photos that can be shown as this job's site photographs, in their saved order. */
export function sitePhotosForJob<T extends { url: string }>(photos: readonly T[], job: SitePhotoJob): T[] {
    return photos.filter((photo) => sitePhotoOrigin(photo.url, job) !== "elsewhere");
}

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