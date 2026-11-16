import "server-only";

import { createHash } from "node:crypto";

/**
 * The same data with every object's keys in one order. Storage does not keep
 * the order keys were sent in, so a list as it was sent and the same list read
 * back must come out alike.
 */
function inKeyOrder(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(inKeyOrder);
    if (value === null || typeof value !== "object") return value;
    const entry = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(entry).sort().map((key) => [key, inKeyOrder(entry[key])]));
}

/** Stable fingerprint of the stored legacy `profiles.case_studies` list, whatever order its keys are in. */
export function legacyCaseStudiesStoredFingerprint(stored: unknown): string {
    const wire = Array.isArray(stored) ? stored : [];
    return createHash("md5").update(JSON.stringify(inKeyOrder(wire))).digest("hex");
}

/**
 * Whether what is stored is something the saving tab already knows about: the
 * list it last knew to be stored, or a list it sent itself in a save whose
 * answer never came back. Anything else was put there from somewhere else.
 */
export function legacyCaseStudiesStoredIsKnown(stored: unknown, expectedFingerprint: string, unconfirmed: unknown): boolean {
    const now = legacyCaseStudiesStoredFingerprint(stored);
    if (now === expectedFingerprint) return true;
    if (!Array.isArray(unconfirmed)) return false;
    return unconfirmed.some((sent) => Array.isArray(sent) && legacyCaseStudiesStoredFingerprint(sent) === now);
}
