/**
 * Up to three photographs per case study in the library journey. Pure.
 *
 * Same https-or-local-http rule as proposal publication. Synthetic fixture
 * URLs only in tests.
 */

export const CASE_STUDY_PHOTO_COUNT = 3;
export const PHOTO_CAPTION_MAX = 300;
export const PHOTO_URL_MAX = 2000;

export interface CaseStudyPhotoSlot {
    url: string;
    caption: string;
}

const SINGLE_LINE_CONTROL = /[\u0001-\u001F\u007F]/;
const characters = (value: string) => Array.from(value).length;

/** Same rule as `safeImageUrl` in proposal-publication (kept here to avoid import cycles). */
export function safeCaseStudyPhotoUrl(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed || characters(trimmed) > PHOTO_URL_MAX) return null;
    try {
        const url = new URL(trimmed);
        const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
        if (url.username || url.password) return null;
        return url.protocol === "https:" || (url.protocol === "http:" && local) ? url.toString() : null;
    } catch {
        return null;
    }
}

export function emptyPhotoSlots(): CaseStudyPhotoSlot[] {
    return Array.from({ length: CASE_STUDY_PHOTO_COUNT }, () => ({ url: "", caption: "" }));
}

/** Three slots always; legacy string entries become url-only slots. */
export function normalisePhotoSlots(value: unknown): CaseStudyPhotoSlot[] {
    if (!Array.isArray(value)) return emptyPhotoSlots();
    return Array.from({ length: CASE_STUDY_PHOTO_COUNT }, (_, index) => {
        const entry = value[index];
        if (typeof entry === "string") {
            return { url: entry.replace(/\r\n?/g, "\n").trim().slice(0, PHOTO_URL_MAX), caption: "" };
        }
        if (entry && typeof entry === "object" && !Array.isArray(entry)) {
            const row = entry as Record<string, unknown>;
            const url = typeof row.url === "string" ? row.url.trim().slice(0, PHOTO_URL_MAX) : "";
            const caption = typeof row.caption === "string" ? row.caption.trim().slice(0, PHOTO_CAPTION_MAX) : "";
            return { url, caption };
        }
        return { url: "", caption: "" };
    });
}

export function photoSlotsProblem(slots: readonly CaseStudyPhotoSlot[]): string | null {
    if (slots.length !== CASE_STUDY_PHOTO_COUNT) return "photos";
    for (const slot of slots) {
        if (characters(slot.caption) > PHOTO_CAPTION_MAX) return "photos";
        if (characters(slot.url) > PHOTO_URL_MAX) return "photos";
        if (SINGLE_LINE_CONTROL.test(slot.url) || SINGLE_LINE_CONTROL.test(slot.caption)) return "photos";
        if (slot.url.trim() !== "" && safeCaseStudyPhotoUrl(slot.url) === null) return "photos";
    }
    return null;
}

/** URLs only, in slot order, for proposal snapshots (captions stay on the slot for future use). */
export function proposalPhotoUrls(slots: readonly CaseStudyPhotoSlot[]): string[] {
    return slots.map((slot) => safeCaseStudyPhotoUrl(slot.url)).filter((url): url is string => url !== null);
}
