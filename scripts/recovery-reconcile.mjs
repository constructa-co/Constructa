// A079 offline reconciliation (runbook sections 3, 5 and 8). Compares two operator-written JSON
// inventories (source taken at export time, restored taken from the disposable target) and, when
// given, the repository migration list and the manifest's storage.objects. It reads local files
// only: no database, Supabase, Storage or network access, and it never opens a user record.
// A RECONCILED verdict is a comparison of two inventories, not a demonstrated restore.
import { readdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { SECRET_PATTERNS } from "./recovery-manifest-check.mjs";

export const INVENTORY_VERSION = 1;

// Each section is required in the source inventory so that a check cannot pass by omission.
// "counts" maps a name to a non-negative integer; "set" is a list of unique strings;
// "map" maps a name to a string (extension name to version).
export const SECTIONS = {
    tableRowCounts: { kind: "counts", label: "row count" },          // "public.projects", "auth.users", "auth.identities", in-scope session or MFA tables
    storageObjectsPerBucket: { kind: "counts", label: "storage.objects rows in bucket" },
    rlsEnabledTables: { kind: "set", label: "RLS enabled on" },
    policies: { kind: "set", label: "policy" },                      // "schema.table:policy_name", including storage.objects
    triggers: { kind: "set", label: "trigger" },                     // "schema.table:trigger_name", including auth.users:on_auth_user_created
    roles: { kind: "set", label: "role" },
    grants: { kind: "set", label: "grant" },                         // "grantee:privilege:schema.object"
    extensions: { kind: "map", label: "extension version" },
    migrationVersions: { kind: "set", label: "migration version" },
};

const isCount = value => Number.isSafeInteger(value) && value >= 0;
const nonEmpty = value => typeof value === "string" && value !== "";

function checkShape(name, inventory, errors) {
    if (!inventory || typeof inventory !== "object" || Array.isArray(inventory)) { errors.push(`${name}: inventory is not an object`); return false; }
    if (inventory.version !== INVENTORY_VERSION) errors.push(`${name}: version must be ${INVENTORY_VERSION}`);
    for (const [section, { kind }] of Object.entries(SECTIONS)) {
        const value = inventory[section];
        if (value === undefined) { errors.push(`${name}: section ${section} is missing`); continue; }
        if (kind === "set") {
            if (!Array.isArray(value) || !value.every(nonEmpty)) errors.push(`${name}.${section}: must be an array of non-empty strings`);
            else if (new Set(value).size !== value.length) errors.push(`${name}.${section}: contains duplicates`);
        } else if (!value || typeof value !== "object" || Array.isArray(value)) {
            errors.push(`${name}.${section}: must be an object`);
        } else if (kind === "counts" && !Object.values(value).every(isCount)) {
            errors.push(`${name}.${section}: every value must be a non-negative integer`);
        } else if (kind === "map" && !Object.values(value).every(nonEmpty)) {
            errors.push(`${name}.${section}: every value must be a non-empty string`);
        }
    }
    return true;
}

// Migration files are named <digits>_<slug>.sql; the digits are the version the database records.
export function migrationVersionsFromNames(names) {
    const versions = [];
    for (const name of names) {
        const match = /^(\d+)_.+\.sql$/.exec(name);
        if (match) versions.push(match[1]);
    }
    return versions;
}

function compareValues(rows, section, source, restored) {
    const { kind, label } = SECTIONS[section];
    if (kind === "set") {
        const a = new Set(source), b = new Set(restored);
        for (const item of [...a].sort()) rows.push({ check: `${section}: ${label} ${item}`, source: "present", restored: b.has(item) ? "present" : "absent", pass: b.has(item) });
        for (const item of [...b].sort()) if (!a.has(item)) rows.push({ check: `${section}: ${label} ${item}`, source: "absent", restored: "present", pass: false });
        if (a.size === 0 && b.size === 0) rows.push({ check: `${section}: recorded empty on both sides`, source: "empty", restored: "empty", pass: true });
        return;
    }
    const keys = [...new Set([...Object.keys(source), ...Object.keys(restored)])].sort();
    for (const key of keys) {
        const s = Object.hasOwn(source, key) ? source[key] : undefined;
        const r = Object.hasOwn(restored, key) ? restored[key] : undefined;
        rows.push({ check: `${section}: ${label} ${key}`, source: s ?? "absent", restored: r ?? "absent", pass: s !== undefined && s === r });
    }
    if (keys.length === 0) rows.push({ check: `${section}: recorded empty on both sides`, source: "empty", restored: "empty", pass: true });
}

// Distinct (bucket, name) pairs in the manifest, counted per bucket.
export function manifestObjectCounts(manifest) {
    const pairs = new Map();
    for (const object of Array.isArray(manifest?.storage?.objects) ? manifest.storage.objects : []) {
        if (!nonEmpty(object?.bucket) || !nonEmpty(object?.name)) continue;
        if (!pairs.has(object.bucket)) pairs.set(object.bucket, new Set());
        pairs.get(object.bucket).add(object.name);
    }
    return Object.fromEntries([...pairs].map(([bucket, names]) => [bucket, names.size]));
}

export function reconcile({ source, restored, repoMigrationVersions, manifest, rawTexts = [] } = {}) {
    const errors = [];
    const rows = [];
    for (const raw of rawTexts) {
        for (const pattern of SECRET_PATTERNS) if (pattern.test(raw)) errors.push(`an input contains a credential-shaped value (${pattern.source.slice(0, 16)}…)`);
    }
    if (manifest !== undefined && (!Array.isArray(manifest?.storage?.objects)
        || !manifest.storage.objects.every(object => nonEmpty(object?.bucket) && nonEmpty(object?.name)))) {
        errors.push("manifest.storage.objects must list valid bucket and object names");
    }
    const sourceOk = checkShape("source", source, errors);
    const restoredOk = checkShape("restored", restored, errors);
    if (!sourceOk || !restoredOk || errors.length > 0) return { verdict: "INVALID", errors, rows, summary: { pass: 0, fail: 0 } };

    for (const section of Object.keys(SECTIONS)) compareValues(rows, section, source[section], restored[section]);

    // Section 3: database migration history against the exact ref's supabase/migrations.
    if (repoMigrationVersions) {
        const db = new Set(source.migrationVersions), repo = new Set(repoMigrationVersions);
        for (const v of [...db].sort()) if (!repo.has(v)) rows.push({ check: `migration ${v} is in the database`, source: "in database", restored: "not in repository", pass: false });
        for (const v of [...repo].sort()) if (!db.has(v)) rows.push({ check: `migration ${v} is in the repository`, source: "not in database", restored: "in repository", pass: false });
        if (db.size === repo.size && [...db].every(v => repo.has(v))) rows.push({ check: `source migration history equals the repository (${repo.size})`, source: db.size, restored: repo.size, pass: true });
    }

    // Section 5: completeness of the declared object set against the source count per bucket, which
    // recovery-manifest-check cannot do. Compares distinct (bucket, name) pairs, so a repeated row adds nothing.
    if (manifest !== undefined) {
        const declared = manifestObjectCounts(manifest);
        for (const bucket of [...new Set([...Object.keys(source.storageObjectsPerBucket), ...Object.keys(declared)])].sort()) {
            const s = Object.hasOwn(source.storageObjectsPerBucket, bucket) ? source.storageObjectsPerBucket[bucket] : 0;
            const m = Object.hasOwn(declared, bucket) ? declared[bucket] : 0;
            rows.push({ check: `manifest declares every source object in bucket ${bucket}`, source: s, restored: m, pass: s === m });
        }
    }

    const fail = rows.filter(row => !row.pass).length;
    return { verdict: fail === 0 ? "RECONCILED" : "MISMATCH", errors, rows, summary: { pass: rows.length - fail, fail } };
}

function readJson(file, label, raws) {
    const raw = readFileSync(file, "utf8");
    raws.push(raw);
    try { return JSON.parse(raw); } catch { throw new Error(`${label} is not valid JSON`); }
}

function parseArgs(argv) {
    const options = {};
    const known = new Set(["--source", "--restored", "--migrations-dir", "--manifest"]);
    for (let i = 0; i < argv.length; i += 2) {
        if (!known.has(argv[i]) || !argv[i + 1]) return null;
        options[argv[i].slice(2)] = argv[i + 1];
    }
    return options.source && options.restored ? options : null;
}

function main(argv) {
    const options = parseArgs(argv.slice(2));
    if (!options) {
        console.error("Usage: node scripts/recovery-reconcile.mjs --source <source.json> --restored <restored.json> [--migrations-dir <supabase/migrations>] [--manifest <manifest.json>]");
        return 64;
    }
    const raws = [];
    let input;
    try {
        input = {
            source: readJson(options.source, "source", raws),
            restored: readJson(options.restored, "restored", raws),
            rawTexts: raws,
        };
        if (options["migrations-dir"]) input.repoMigrationVersions = migrationVersionsFromNames(readdirSync(options["migrations-dir"]));
        if (options.manifest) input.manifest = readJson(options.manifest, "manifest", raws);
    } catch (error) {
        console.error(error instanceof Error ? error.message : "Could not read an input.");
        return 64;
    }
    const report = reconcile(input);
    console.log(JSON.stringify({ ...report, note: "Offline comparison of two inventories; not a demonstrated restore." }, null, 2));
    return report.verdict === "RECONCILED" ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = main(process.argv);
