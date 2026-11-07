/**
 * Older `profiles.case_studies` entries store up to three photograph urls per
 * job (plain strings, not library slots). Pure.
 */

import { CASE_STUDY_PHOTO_COUNT, normalisePhotoSlots, photoInputWouldBeCut, photoSlotsProblem } from "./photos";

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

/** Wording when a save is refused for pictures on an older case study. */
export const LEGACY_CASE_STUDY_PHOTOS_MESSAGE =
    "Check the pictures on each past work example. Each one can have up to three. Each link must start with https (or use http://localhost or http://127.0.0.1 when testing locally).";

/** Null when `photos` is acceptable on one older entry; otherwise `"photos"`. */
export function legacyEntryPhotosProblem(photos: unknown): "photos" | null {
    if (!Array.isArray(photos)) return "photos";
    if (photos.length > CASE_STUDY_PHOTO_COUNT) return "photos";
    if (photoInputWouldBeCut(photos)) return "photos";
    return photoSlotsProblem(normalisePhotoSlots(photos));
}

/**
 * Index of the first older entry whose `photos` cannot be stored, or null when
 * every entry is acceptable (including entries with no `photos` key).
 */
export function legacyCaseStudiesPhotosProblem(list: unknown): number | null {
    if (!Array.isArray(list)) return null;
    for (let index = 0; index < list.length; index++) {
        const entry = list[index];
        if (isObject(entry) && Object.prototype.hasOwnProperty.call(entry, "photos")) {
            if (legacyEntryPhotosProblem(entry.photos) !== null) return index;
        }
    }
    return null;
}
