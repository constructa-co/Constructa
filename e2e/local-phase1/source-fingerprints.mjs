// Evidence form of a bundle's source-manifest.json.
//
// The local compilers write { sourceHashes: { "<absolute path>": "<sha256 hex>" } }.
// When a committed evidence copy keeps that shape, a path such as ".../core/api.cjs"
// or ".../company-credentials-summary.tsx" sits directly in front of a 64-character
// hex value, and generic secret scanners read the pair as a key assignment. The
// evidence copy therefore lists each file as { path, sha256 }: the hash sits under a
// field that says what it is, a content fingerprint of a source file.
//
// Only SHA-256 hex digests are accepted, so this field cannot carry anything else.

export const SOURCE_FINGERPRINTS_FORMAT = "constructa-source-fingerprints/v1";

const SHA256_HEX = /^[a-f0-9]{64}$/;

export function toSourceFingerprints(manifest) {
    const hashes = manifest?.sourceHashes;
    if (!hashes || typeof hashes !== "object" || Array.isArray(hashes)) {
        throw Error("Bundle manifest has no sourceHashes map.");
    }
    const sourceFingerprints = Object.entries(hashes).map(([path, sha256]) => {
        if (typeof sha256 !== "string" || !SHA256_HEX.test(sha256)) {
            throw Error(`Source fingerprint for ${path} is not a SHA-256 hex digest.`);
        }
        return { path, sha256 };
    });
    return {
        format: SOURCE_FINGERPRINTS_FORMAT,
        note: "Provenance only: SHA-256 content fingerprints of the source files compiled into this bundle.",
        sourceFingerprints,
        modules: manifest.modules,
        scope: manifest.scope,
    };
}

export function serializeSourceFingerprints(manifest) {
    return JSON.stringify(toSourceFingerprints(manifest), null, 2) + "\n";
}
