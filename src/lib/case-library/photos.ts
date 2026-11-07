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
/** The check in `case_library_photo_slot_ok`. Narrower than `safeCaseStudyPhotoUrl`: it reads the url as typed, so `HTTPS://` is refused. */
const DATABASE_PHOTO_URL = /^(?:https:\/\/|http:\/\/(?:localhost|127\.0\.0\.1)(?:[:/]|$))/;
const characters = (value: string) => Array.from(value).length;
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

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
        if (slot.url.trim() !== "" && (safeCaseStudyPhotoUrl(slot.url) === null || !DATABASE_PHOTO_URL.test(slot.url.trim()))) return "photos";
    }
    return null;
}

/** `case_library_photos_ok`: exactly three slots of exactly `url` and `caption`, read as stored. Nothing is tidied first. */
export function storedPhotoSlotsProblem(value: unknown): string | null {
    if (!Array.isArray(value)) return "photos";
    const exact = value.every((slot) => isObject(slot) && Object.keys(slot).sort().join() === "caption,url" && typeof slot.url === "string" && typeof slot.caption === "string");
    return exact ? photoSlotsProblem(value as CaseStudyPhotoSlot[]) : "photos";
}

/** True when `normalisePhotoSlots` would quietly lose part of this: a fourth picture, or a url or caption cut to fit. */
export function photoInputWouldBeCut(value: unknown): boolean {
    if (!Array.isArray(value)) return false;
    // Match the UTF-16 slice used by normalisePhotoSlots before it can cut input.
    const tooLong = (text: unknown, max: number) => typeof text === "string" && text.trim().length > max;
    return value.length > CASE_STUDY_PHOTO_COUNT
        || value.some((entry) => (isObject(entry) ? tooLong(entry.url, PHOTO_URL_MAX) || tooLong(entry.caption, PHOTO_CAPTION_MAX) : tooLong(entry, PHOTO_URL_MAX)));
}

/** URLs only, in slot order, for proposal snapshots (captions stay on the slot for future use). */
export function proposalPhotoUrls(slots: readonly CaseStudyPhotoSlot[]): string[] {
    return slots.map((slot) => safeCaseStudyPhotoUrl(slot.url)).filter((url): url is string => url !== null);
}
