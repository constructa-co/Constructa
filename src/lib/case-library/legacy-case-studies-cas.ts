import { createHash } from "node:crypto";

/** Stable fingerprint of the stored legacy `profiles.case_studies` list. */
export function legacyCaseStudiesStoredFingerprint(stored: unknown): string {
    const wire = Array.isArray(stored) ? stored : [];
    return createHash("md5").update(JSON.stringify(wire)).digest("hex");
}