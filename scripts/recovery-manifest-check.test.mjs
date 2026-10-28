import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { REQUIRED_BUCKETS, REQUIRED_CATEGORIES, checkManifest, checkRelativePath } from "./recovery-manifest-check.mjs";

// Synthetic fixtures only: no real project refs, customer data or credentials.
const sha = body => createHash("sha256").update(body).digest("hex");
const appSha = "6".repeat(40);
const fileBody = category => `synthetic ${category}\n`;

function manifest(overrides = {}) {
    const entries = REQUIRED_CATEGORIES.map(category => ({
        path: `${category}/part-1.bin`, category, sha256: sha(fileBody(category)), bytes: Buffer.byteLength(fileBody(category)),
    }));
    const bytesEntry = entries.find(entry => entry.category === "storage-object-bytes");
    return {
        version: 1,
        destination: { location: "operator-approved-private-volume", approvedBy: "named-owner" },
        restoreTarget: { projectRef: "disposable-restore-ref", disposable: true },
        source: { projectRefs: ["synthetic-source-ref"] },
        entries,
        storage: {
            buckets: REQUIRED_BUCKETS.map(id => ({ id })),
            objects: [{ bucket: "logos", name: "user/logo.png", path: bytesEntry.path, sha256: bytesEntry.sha256, bytes: bytesEntry.bytes }],
        },
        git: {
            refs: [{ repository: "app", ref: "refs/heads/backup", sha: appSha }],
            requiredRefs: [{ repository: "app", ref: "refs/heads/backup", sha: appSha }],
        },
        ...overrides,
    };
}

const roots = [];
after(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });
function exportRoot(value) {
    const root = mkdtempSync(path.join(tmpdir(), "a079-manifest-"));
    roots.push(root);
    for (const entry of value.entries) {
        mkdirSync(path.join(root, path.dirname(entry.path)), { recursive: true });
        writeFileSync(path.join(root, entry.path), fileBody(entry.category));
    }
    return root;
}

test("a complete synthetic set passes, with and without byte verification", () => {
    const value = manifest();
    assert.deepEqual(checkManifest(value).errors, []);
    assert.equal(checkManifest(value).verdict, "COMPLETE_SET");
    const report = checkManifest(value, { root: exportRoot(value) });
    assert.equal(report.verdict, "COMPLETE_SET");
    assert.equal(report.bytesVerified, true);
});

for (const [value, reason] of [
    ["../escape", "not a normalised"], ["a/../../b", "not a normalised"], ["/abs/file", "absolute"],
    ["C:/x", "absolute"], ["a\\b", "backslash"], ["a//b", "not a normalised"], ["./a", "not a normalised"],
    ["", "empty"], ["db/.env.local", "credential"], ["keys/service_role.txt", "credential"],
]) {
    test(`unsafe path is refused: ${JSON.stringify(value)}`, () => {
        assert.match(checkRelativePath(value), new RegExp(reason));
    });
}

test("every missing category is named; an owned waiver makes the set PARTIAL, not complete", () => {
    const value = manifest();
    value.entries = value.entries.filter(entry => entry.category !== "ops-export");
    assert.ok(checkManifest(value).errors.includes("missing category ops-export (add entries or an owned waiver)"));
    value.waivers = [{ category: "ops-export", reason: "constructa-ops export reported skipped", owner: "named-owner" }];
    const report = checkManifest(value);
    assert.equal(report.verdict, "PARTIAL");
    assert.deepEqual(report.waived, ["ops-export"]);
});

test("waivers need a reason and owner and cannot cover a category that has entries", () => {
    const value = manifest({ waivers: [{ category: "db-data", reason: "", owner: "x" }, { category: "db-schema", reason: "r", owner: "o" }] });
    const { errors } = checkManifest(value);
    assert.ok(errors.some(error => error.startsWith("waivers[0]: reason and owner")));
    assert.ok(errors.some(error => error.includes("db-schema has entries")));
});

test("required inputs are never defaulted and the restore target cannot be a source", () => {
    for (const patch of [
        { destination: { location: "<approved location>", approvedBy: "x" } },
        { destination: { location: "TBD", approvedBy: "x" } },
        { restoreTarget: { projectRef: "disposable-restore-ref", disposable: false } },
        { restoreTarget: { projectRef: "synthetic-source-ref", disposable: true } },
        { source: { projectRefs: [] } },
    ]) {
        assert.equal(checkManifest(manifest(patch)).verdict, "INVALID", JSON.stringify(patch));
    }
});

test("ordinary labels that start with example are accepted; sentinel placeholders stay rejected", () => {
    const named = manifest({ destination: { location: "example-building-export", approvedBy: "named-owner" } });
    assert.equal(checkManifest(named).verdict, "COMPLETE_SET");
    for (const location of ["example", "EXAMPLE", "TBD", "<EXPORT_DEST>", "${EXPORT_DEST}", ""]) {
        assert.equal(checkManifest(manifest({ destination: { location, approvedBy: "named-owner" } })).verdict, "INVALID", location);
    }
});

test("credential-shaped values fail closed without being echoed", () => {
    for (const secret of [
        `eyJ${"a".repeat(20)}.${"b".repeat(20)}.sig`, "sb_secret_abcdef", "postgresql://user:pw@db.example:5432/postgres",
        // Assembled from pieces so the committed fixture is not itself credential-shaped.
        `${"-".repeat(5)}BEGIN RSA ${"PRIVATE"} KEY${"-".repeat(5)}`, ["sk", "live", "abc123"].join("_"),
    ]) {
        const report = checkManifest(manifest({ note: secret }));
        assert.equal(report.verdict, "INVALID");
        assert.ok(!JSON.stringify(report.errors).includes(secret));
    }
});

test("case-folded duplicate paths and bad hashes or sizes are refused", () => {
    const value = manifest();
    value.entries.push({ ...value.entries[0], path: value.entries[0].path.toUpperCase() });
    value.entries[1] = { ...value.entries[1], sha256: "ABC" };
    value.entries[2] = { ...value.entries[2], bytes: -1 };
    const { errors } = checkManifest(value);
    assert.ok(errors.some(error => error.includes("duplicate path")));
    assert.ok(errors.some(error => error.includes("sha256 must be")));
    assert.ok(errors.some(error => error.includes("bytes must be")));
});

test("storage config and object bytes are checked separately", () => {
    const value = manifest();
    value.storage.buckets = value.storage.buckets.filter(bucket => bucket.id !== "site-photos");
    value.storage.objects.push({ bucket: "undeclared", name: "x", path: "nope", sha256: "0".repeat(64), bytes: 0 });
    value.storage.objects.push({ ...value.storage.objects[0], sha256: "f".repeat(64) });
    value.storage.objects.push({ ...value.storage.objects[0], path: "db-schema/part-1.bin" });
    const { errors } = checkManifest(value);
    assert.ok(errors.includes("storage.buckets is missing site-photos"));
    assert.ok(errors.some(error => error.includes("bucket undeclared is not declared")));
    assert.ok(errors.some(error => error.includes("hash/size differs")));
    assert.ok(errors.some(error => error.includes("must reference a storage-object-bytes entry")));
});

test("a declared bytes file with no storage.objects row is refused", () => {
    const value = manifest();
    const body = "orphan object\n";
    value.entries.push({ path: "storage-object-bytes/orphan.bin", category: "storage-object-bytes", sha256: sha(body), bytes: Buffer.byteLength(body) });
    assert.ok(checkManifest(value).errors.includes("storage-object-bytes/orphan.bin: storage-object-bytes entry has no storage.objects row"));
});

test("conflicting duplicate git ref keys are refused before requiredRefs can match the last sha only", () => {
    const value = manifest();
    const firstSha = "1".repeat(40);
    const secondSha = "2".repeat(40);
    value.git.refs = [
        { repository: "app", ref: "refs/heads/backup", sha: firstSha },
        { repository: "app", ref: "refs/heads/backup", sha: secondSha },
    ];
    value.git.requiredRefs = [{ repository: "app", ref: "refs/heads/backup", sha: secondSha }];
    const report = checkManifest(value);
    assert.equal(report.verdict, "INVALID");
    assert.ok(report.errors.some(error => error.includes("conflicting") && error.includes("refs/heads/backup")));
});

test("the same ref name in different repositories remains valid", () => {
    const value = manifest();
    const programmeSha = "3".repeat(40);
    value.git.refs = [
        { repository: "app", ref: "refs/heads/backup", sha: appSha },
        { repository: "programme", ref: "refs/heads/backup", sha: programmeSha },
    ];
    value.git.requiredRefs = [
        { repository: "app", ref: "refs/heads/backup", sha: appSha },
        { repository: "programme", ref: "refs/heads/backup", sha: programmeSha },
    ];
    assert.equal(checkManifest(value).verdict, "COMPLETE_SET");
});

test("required Git refs must be recorded at the expected commit with safe names", () => {
    const value = manifest();
    value.git.requiredRefs.push({ repository: "programme", ref: "refs/heads/backup", sha: "3".repeat(40) });
    value.git.refs.push({ repository: "app", ref: "refs/heads/../main", sha: appSha }, { repository: "app", ref: "refs/heads/x", sha: "abc" });
    value.git.requiredRefs[0].sha = "7".repeat(40);
    const { errors } = checkManifest(value);
    assert.ok(errors.some(error => error.includes("programme:refs/heads/backup is not recorded")));
    assert.ok(errors.some(error => error.includes(`expected ${"7".repeat(40)}`)));
    assert.ok(errors.some(error => error.includes("unsafe ref name")));
    assert.ok(errors.some(error => error.includes("sha must be 40")));
});

test("byte verification catches missing, altered, resized and symlinked files", () => {
    const value = manifest();
    const root = exportRoot(value);
    const [missing, altered, resized, linked] = value.entries;
    rmSync(path.join(root, missing.path));
    writeFileSync(path.join(root, altered.path), fileBody(altered.category).replace("synthetic", "SYNTHETIC"));
    writeFileSync(path.join(root, resized.path), "short");
    rmSync(path.join(root, linked.path));
    symlinkSync(path.join(root, value.entries[5].path), path.join(root, linked.path));
    const { errors, verdict } = checkManifest(value, { root });
    assert.equal(verdict, "INVALID");
    assert.ok(errors.includes(`${missing.path}: file is missing`));
    assert.ok(errors.includes(`${altered.path}: sha256 differs from manifest`));
    assert.ok(errors.some(error => error.startsWith(`${resized.path}: size`)));
    assert.ok(errors.includes(`${linked.path}: not a regular file (symlinks are refused)`));
});

test("a directory symlink cannot pull a file in from outside the export root", () => {
    const value = manifest();
    const root = exportRoot(value);
    const outside = exportRoot(value);
    const target = value.entries[0];
    rmSync(path.join(root, path.dirname(target.path)), { recursive: true });
    symlinkSync(path.join(outside, path.dirname(target.path)), path.join(root, path.dirname(target.path)));
    assert.ok(checkManifest(value, { root }).errors.includes(`${target.path}: resolves outside the export root`));
});

test("CLI exit codes distinguish complete, partial and invalid sets", () => {
    const run = value => {
        const dir = mkdtempSync(path.join(tmpdir(), "a079-cli-"));
        roots.push(dir);
        const file = path.join(dir, "manifest.json");
        writeFileSync(file, JSON.stringify(value));
        return spawnSync(process.execPath, [new URL("./recovery-manifest-check.mjs", import.meta.url).pathname, file], { encoding: "utf8" });
    };
    assert.equal(run(manifest()).status, 0);
    const partial = manifest();
    partial.entries = partial.entries.filter(entry => entry.category !== "ops-export");
    partial.waivers = [{ category: "ops-export", reason: "skipped", owner: "named-owner" }];
    assert.equal(run(partial).status, 2);
    const leaked = run(manifest({ note: "sb_secret_do_not_echo" }));
    assert.equal(leaked.status, 1);
    assert.ok(!leaked.stdout.includes("sb_secret_do_not_echo"));
});

test("non-object manifests and wrong versions are invalid", () => {
    for (const value of [null, [], "x"]) assert.equal(checkManifest(value).verdict, "INVALID");
    assert.equal(checkManifest(manifest({ version: 2 })).verdict, "INVALID");
});
