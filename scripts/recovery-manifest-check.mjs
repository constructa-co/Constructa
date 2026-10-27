// A079 offline recovery-set check. Reads an operator-written manifest (and, with --root, the
// exported files beside it) and reports whether the set is internally complete. It never
// connects to Supabase, Git remotes or any provider, and a COMPLETE_SET verdict is not a
// demonstrated restore: acceptance still needs the restore read-back in the runbook.
import { createHash } from "node:crypto";
import { lstatSync, openSync, readSync, closeSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MANIFEST_VERSION = 1;

// Every category must have at least one entry or an owned waiver. Waivers keep the set PARTIAL.
export const REQUIRED_CATEGORIES = [
    "db-schema", "db-data", "db-roles-privileges", "db-migration-history",
    "auth-users", "auth-config-boundary",
    "storage-bucket-config", "storage-policies", "storage-object-metadata", "storage-object-bytes",
    "git-bundle", "git-refs", "git-lfs-assets", "private-work-reconciliation",
    "deployment-identity", "programme-backup", "ops-export",
];

// Buckets created by migrations (logos, proposal-photos, receipts) plus buckets the source reads
// but no migration creates (contracts, site-photos): a migrations-only restore would miss these.
export const REQUIRED_BUCKETS = ["logos", "proposal-photos", "receipts", "contracts", "site-photos"];

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const REF = /^refs\/(heads|tags|remotes|notes)\/[A-Za-z0-9._/-]+$/;
// Whole-value sentinels only: a real label such as "example-building-export" is allowed.
const PLACEHOLDER = /^(|tbd|todo|<.*>|\$\{.*\}|changeme|example)$/i;
// Credential shapes that must never appear in a manifest that may be copied into evidence.
const SECRET_PATTERNS = [
    /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
    /\bsb_secret_[A-Za-z0-9_-]+/,
    /\bpostgres(ql)?:\/\/[^\s:/@]+:[^\s@]+@/i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\b(sk|rk)_live_[A-Za-z0-9]+/,
];
const SECRET_FILE = /(^|\/)(\.env(\..*)?|.*\.pem|.*\.key|id_rsa.*|.*service[_-]?role.*)$/i;

export function checkRelativePath(value) {
    if (typeof value !== "string" || value.length === 0) return "path is empty";
    if (value.includes("\0")) return "path contains NUL";
    if (value.includes("\\")) return "path uses a backslash";
    if (value.startsWith("/") || /^[A-Za-z]:/.test(value)) return "path is absolute";
    const parts = value.split("/");
    if (parts.some(part => part === "" || part === "." || part === "..")) return "path is not a normalised relative path";
    if (SECRET_FILE.test(value)) return "path names a credential file";
    return null;
}

function text(value) {
    return typeof value === "string" && !PLACEHOLDER.test(value.trim());
}

function sha256File(file) {
    const hash = createHash("sha256");
    const buffer = Buffer.allocUnsafe(1 << 20);
    const fd = openSync(file, "r");
    try {
        for (let read; (read = readSync(fd, buffer, 0, buffer.length, null)) > 0;) hash.update(buffer.subarray(0, read));
    } finally {
        closeSync(fd);
    }
    return hash.digest("hex");
}

export function checkManifest(manifest, { root, rawText } = {}) {
    const errors = [];
    const fail = message => errors.push(message);
    const serialised = rawText ?? JSON.stringify(manifest ?? null);
    for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(serialised)) fail(`manifest contains a credential-shaped value (${pattern.source.slice(0, 16)}…)`);
    }
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
        return { verdict: "INVALID", errors: [...errors, "manifest is not an object"], waived: [], counts: {} };
    }
    if (manifest.version !== MANIFEST_VERSION) fail(`version must be ${MANIFEST_VERSION}`);

    // Required inputs are named by the authorised operator, never defaulted here.
    const { destination, restoreTarget, source } = manifest;
    if (!text(destination?.location) || !text(destination?.approvedBy)) fail("destination.location and destination.approvedBy are required inputs");
    if (!text(restoreTarget?.projectRef) || restoreTarget?.disposable !== true) fail("restoreTarget.projectRef is required and restoreTarget.disposable must be true");
    const sourceRefs = Array.isArray(source?.projectRefs) ? source.projectRefs : [];
    if (sourceRefs.length === 0 || !sourceRefs.every(text)) fail("source.projectRefs must name every exported Supabase project");
    if (sourceRefs.includes(restoreTarget?.projectRef)) fail("restoreTarget.projectRef must not be an export source project");

    const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
    if (!Array.isArray(manifest.entries)) fail("entries must be an array");
    const byPath = new Map();
    const folded = new Set();
    const counts = Object.fromEntries(REQUIRED_CATEGORIES.map(category => [category, 0]));
    for (const [index, entry] of entries.entries()) {
        const label = `entries[${index}]`;
        const pathError = checkRelativePath(entry?.path);
        if (pathError) { fail(`${label}: ${pathError}`); continue; }
        // macOS volumes are usually case-insensitive: two names differing only by case collide on restore.
        const key = entry.path.normalize("NFC").toLowerCase();
        if (folded.has(key)) fail(`${label}: duplicate path ${entry.path}`);
        folded.add(key);
        byPath.set(entry.path, entry);
        if (!REQUIRED_CATEGORIES.includes(entry.category)) fail(`${label}: unknown category ${String(entry.category)}`);
        else counts[entry.category] += 1;
        if (!SHA256.test(entry.sha256 ?? "")) fail(`${label}: sha256 must be 64 lowercase hex`);
        if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0) fail(`${label}: bytes must be a non-negative integer`);
    }

    const waivers = Array.isArray(manifest.waivers) ? manifest.waivers : [];
    const waived = [];
    for (const [index, waiver] of waivers.entries()) {
        if (!REQUIRED_CATEGORIES.includes(waiver?.category)) { fail(`waivers[${index}]: unknown category`); continue; }
        if (!text(waiver.reason) || !text(waiver.owner)) { fail(`waivers[${index}]: reason and owner are required`); continue; }
        if (counts[waiver.category] > 0) fail(`waivers[${index}]: ${waiver.category} has entries and cannot also be waived`);
        waived.push(waiver.category);
    }
    for (const category of REQUIRED_CATEGORIES) {
        if (counts[category] === 0 && !waived.includes(category)) fail(`missing category ${category} (add entries or an owned waiver)`);
    }

    // Storage: bucket configuration is separate from object bytes; each object must be backed by a hashed file.
    const storage = manifest.storage ?? {};
    const buckets = new Set((Array.isArray(storage.buckets) ? storage.buckets : []).map(bucket => bucket?.id));
    const storageWaived = waived.includes("storage-bucket-config");
    if (!storageWaived) {
        for (const bucket of REQUIRED_BUCKETS) if (!buckets.has(bucket)) fail(`storage.buckets is missing ${bucket}`);
    }
    const objects = Array.isArray(storage.objects) ? storage.objects : [];
    // Reverse mapping keeps the declared set internally consistent. It cannot find an object missing
    // from both the source inventory and this manifest: that needs the source count reconciliation.
    const referenced = new Set(objects.map(object => object?.path));
    for (const entry of byPath.values()) {
        if (entry.category === "storage-object-bytes" && !referenced.has(entry.path)) {
            fail(`${entry.path}: storage-object-bytes entry has no storage.objects row`);
        }
    }
    for (const [index, object] of objects.entries()) {
        const label = `storage.objects[${index}]`;
        if (!buckets.has(object?.bucket)) fail(`${label}: bucket ${String(object?.bucket)} is not declared`);
        if (typeof object?.name !== "string" || object.name === "" || object.name.split("/").includes("..")) fail(`${label}: object name is unsafe`);
        const backing = byPath.get(object?.path);
        if (!backing || backing.category !== "storage-object-bytes") fail(`${label}: path must reference a storage-object-bytes entry`);
        else if (backing.sha256 !== object.sha256 || backing.bytes !== object.bytes) fail(`${label}: hash/size differs from its bytes entry`);
    }

    // Git: every required ref must be recorded at its expected commit.
    const refs = new Map();
    for (const [index, ref] of (Array.isArray(manifest.git?.refs) ? manifest.git.refs : []).entries()) {
        if (!REF.test(ref?.ref ?? "") || ref.ref.includes("..")) { fail(`git.refs[${index}]: unsafe ref name`); continue; }
        if (!GIT_SHA.test(ref.sha ?? "")) { fail(`git.refs[${index}]: sha must be 40 lowercase hex`); continue; }
        refs.set(`${ref.repository ?? ""} ${ref.ref}`, ref.sha);
    }
    for (const [index, required] of (Array.isArray(manifest.git?.requiredRefs) ? manifest.git.requiredRefs : []).entries()) {
        const found = refs.get(`${required?.repository ?? ""} ${required?.ref}`);
        if (!found) fail(`git.requiredRefs[${index}]: ${required?.repository}:${required?.ref} is not recorded`);
        else if (required.sha && found !== required.sha) fail(`git.requiredRefs[${index}]: ${required.ref} is ${found}, expected ${required.sha}`);
    }

    // Bytes: only when the operator points at the export root. Symlinks are refused rather than followed.
    if (root !== undefined) {
        const realRoot = realpathSync(root);
        for (const entry of byPath.values()) {
            const file = path.join(realRoot, entry.path);
            let stat;
            try { stat = lstatSync(file); } catch { fail(`${entry.path}: file is missing`); continue; }
            if (!stat.isFile()) { fail(`${entry.path}: not a regular file (symlinks are refused)`); continue; }
            if (!realpathSync(file).startsWith(realRoot + path.sep)) { fail(`${entry.path}: resolves outside the export root`); continue; }
            if (stat.size !== entry.bytes) fail(`${entry.path}: size ${stat.size} differs from manifest ${entry.bytes}`);
            else if (sha256File(file) !== entry.sha256) fail(`${entry.path}: sha256 differs from manifest`);
        }
    }

    const verdict = errors.length > 0 ? "INVALID" : waived.length > 0 ? "PARTIAL" : "COMPLETE_SET";
    return { verdict, errors, waived, counts, bytesVerified: root !== undefined };
}

function main(argv) {
    const args = argv.slice(2);
    const rootIndex = args.indexOf("--root");
    const root = rootIndex >= 0 ? args.splice(rootIndex, 2)[1] : undefined;
    if (args.length !== 1 || (rootIndex >= 0 && !root)) {
        console.error("Usage: node scripts/recovery-manifest-check.mjs <manifest.json> [--root <export-dir>]");
        return 64;
    }
    const rawText = readFileSync(args[0], "utf8");
    let manifest;
    try { manifest = JSON.parse(rawText); } catch { console.error("Manifest is not valid JSON."); return 1; }
    const report = checkManifest(manifest, { root, rawText });
    // The report carries paths, counts and messages only; never echo manifest values that failed the secret check.
    console.log(JSON.stringify({ ...report, note: "Offline set check only; not a demonstrated restore." }, null, 2));
    return report.verdict === "COMPLETE_SET" ? 0 : report.verdict === "PARTIAL" ? 2 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = main(process.argv);
