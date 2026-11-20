/**
 * Case-study photo behaviour (CON-061 / D63): primary ordering, duplicate
 * detection by content hash, and legacy urls kept after the three active slots.
 * Pure — no storage or server calls.
 */

import { CASE_STUDY_PHOTO_COUNT, normalisePhotoSlots, safeCaseStudyPhotoUrl, type CaseStudyPhotoSlot } from "./photos";

export const CASE_STUDY_DUPLICATE_PHOTO_MESSAGE =
    "That exact picture is already on this example, so it was not added again.";

export const CASE_STUDY_PRIMARY_LABEL = "Main photo";

/** SHA-256 hex digest of a file's bytes (same rule in the browser and in tests). */
export async function caseStudyPhotoContentHash(file: Blob): Promise<string> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (typeof globalThis.crypto?.subtle?.digest === "function") {
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    throw new Error("This browser cannot check photo contents safely.");
}

/** First three positions are editable; further urls are legacy tail preserved on save. */
export function splitLegacyProfilePhotoUrls(photos: unknown): { active: [string, string, string]; legacyTail: string[] } {
    const list = Array.isArray(photos) ? photos.map((entry) => (typeof entry === "string" ? entry : "")) : ["", "", ""];
    const active: [string, string, string] = [
        list[0] ?? "",
        list[1] ?? "",
        list[2] ?? "",
    ];
    const legacyTail = list.slice(3).map((url) => url.trim()).filter((url) => url !== "");
    return { active, legacyTail };
}

export function mergeLegacyProfilePhotoUrls(active: readonly string[], legacyTail: readonly string[]): string[] {
    const slots = Array.from({ length: CASE_STUDY_PHOTO_COUNT }, (_, index) => (active[index] ?? "").trim());
    return [...slots, ...legacyTail.map((url) => url.trim()).filter((url) => url !== "")];
}

export function legacyTailPhotoCount(photos: unknown): number {
    return splitLegacyProfilePhotoUrls(photos).legacyTail.length;
}

/** Resolved primary index in 0..2; default is the first non-empty active slot. */
export function resolvePrimaryPhotoSlot(active: readonly string[], explicit: unknown): number {
    if (typeof explicit === "number" && Number.isInteger(explicit) && explicit >= 0 && explicit < CASE_STUDY_PHOTO_COUNT && (active[explicit] ?? "").trim() !== "") {
        return explicit;
    }
    const first = active.findIndex((url) => url.trim() !== "");
    return first === -1 ? 0 : first;
}

/** Proposal order: primary first, then other filled active slots; legacy tail is not published. */
export function legacyProfileCaseStudyPhotos(photos: unknown, primaryPhotoIndex: unknown): string[] {
    const { active } = splitLegacyProfilePhotoUrls(photos);
    const primary = resolvePrimaryPhotoSlot(active, primaryPhotoIndex);
    const ordered: string[] = [];
    const pushSafe = (url: string) => {
        const safe = safeCaseStudyPhotoUrl(url);
        if (safe && !ordered.includes(safe)) ordered.push(safe);
    };
    pushSafe(active[primary] ?? "");
    for (let index = 0; index < CASE_STUDY_PHOTO_COUNT; index++) {
        if (index === primary) continue;
        pushSafe(active[index] ?? "");
    }
    return ordered.slice(0, CASE_STUDY_PHOTO_COUNT);
}

/** Library slots: same primary ordering for publication. */
export function libraryCaseStudyProposalPhotos(slots: readonly CaseStudyPhotoSlot[], primaryPhotoIndex: unknown): string[] {
    const active = normalisePhotoSlots(slots).map((slot) => slot.url);
    return legacyProfileCaseStudyPhotos(active, primaryPhotoIndex);
}

export function legacyTailUrlsProblem(tail: readonly string[]): string | null {
    for (const url of tail) {
        if (safeCaseStudyPhotoUrl(url) === null) return "photos";
    }
    return null;
}