import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { INVENTORY_VERSION, SECTIONS, manifestObjectCounts, migrationVersionsFromNames, reconcile } from "./recovery-reconcile.mjs";

// Synthetic inventories only: no real table contents, project refs, users or credentials.
function inventory(overrides = {}) {
    return {
        version: INVENTORY_VERSION,
        tableRowCounts: { "public.projects": 4, "auth.users": 2, "auth.identities": 2 },
        storageObjectsPerBucket: { logos: 2, receipts: 1 },
        rlsEnabledTables: ["public.projects", "storage.objects"],
        policies: ["public.projects:owner_all", "storage.objects:logos_read"],
        triggers: ["auth.users:on_auth_user_created"],
        roles: ["authenticated", "anon"],
        grants: ["authenticated:SELECT:public.projects"],
        extensions: { pgcrypto: "1.3", "uuid-ossp": "1.1" },
        migrationVersions: ["20260117000000", "20260117000001"],
        ...overrides,
    };
}

const failures = result => result.rows.filter(row => !row.pass).map(row => row.check);

test("identical synthetic inventories reconcile", () => {
    const result = reconcile({ source: inventory(), restored: inventory() });
    assert.equal(result.verdict, "RECONCILED");
    assert.equal(result.summary.fail, 0);
    assert.ok(result.rows.length > 10);
});

test("a changed row count, missing policy or trigger, and extension version drift are each named", () => {
    const restored = inventory({
        tableRowCounts: { "public.projects": 3, "auth.users": 2, "auth.identities": 2 },
        policies: ["public.projects:owner_all"],
        triggers: [],
        extensions: { pgcrypto: "1.2", "uuid-ossp": "1.1" },
    });
    const result = reconcile({ source: inventory(), restored });
    assert.equal(result.verdict, "MISMATCH");
    const names = failures(result);
    assert.ok(names.some(n => n.includes("row count public.projects")));
    assert.ok(names.some(n => n.includes("policy storage.objects:logos_read")));
    assert.ok(names.some(n => n.includes("trigger auth.users:on_auth_user_created")));
    assert.ok(names.some(n => n.includes("extension version pgcrypto")));
    assert.equal(names.length, 4);
});

test("extra items on the restored side fail, so a grant or table added by the restore is not hidden", () => {
    const restored = inventory({
        tableRowCounts: { "public.projects": 4, "auth.users": 2, "auth.identities": 2, "public.extra": 0 },
        grants: ["authenticated:SELECT:public.projects", "anon:SELECT:public.projects"],
    });
    const names = failures(reconcile({ source: inventory(), restored }));
    assert.ok(names.some(n => n.includes("row count public.extra")));
    assert.ok(names.some(n => n.includes("grant anon:SELECT:public.projects")));
});

test("a section missing from either inventory is invalid, never a pass by omission", () => {
    for (const section of Object.keys(SECTIONS)) {
        const broken = inventory();
        delete broken[section];
        assert.equal(reconcile({ source: broken, restored: inventory() }).verdict, "INVALID", `source without ${section}`);
        assert.equal(reconcile({ source: inventory(), restored: broken }).verdict, "INVALID", `restored without ${section}`);
    }
});

test("malformed values are refused: negative or fractional counts, duplicates, blanks, wrong version", () => {
    const bad = [
        { tableRowCounts: { "public.projects": -1 } },
        { tableRowCounts: { "public.projects": 1.5 } },
        { storageObjectsPerBucket: { logos: "2" } },
        { policies: ["a", "a"] },
        { triggers: [""] },
        { extensions: { pgcrypto: "" } },
        { version: 2 },
    ];
    for (const override of bad) {
        assert.equal(reconcile({ source: inventory(override), restored: inventory() }).verdict, "INVALID", JSON.stringify(override));
    }
    assert.equal(reconcile({ source: [], restored: inventory() }).verdict, "INVALID");
});

test("an empty section recorded on both sides is an explicit pass, not an absence", () => {
    const empty = inventory({ triggers: [], grants: [] });
    const result = reconcile({ source: empty, restored: empty });
    assert.equal(result.verdict, "RECONCILED");
    assert.ok(result.rows.some(row => row.check === "triggers: recorded empty on both sides"));
});

test("object keys that look like prototype members are compared as data", () => {
    const source = inventory({ tableRowCounts: JSON.parse('{"__proto__": 1, "constructor": 2}') });
    const restored = inventory({ tableRowCounts: { "constructor": 2 } });
    const result = reconcile({ source, restored });
    assert.equal(result.verdict, "MISMATCH");
    assert.ok(failures(result).some(n => n.includes("row count __proto__")));
});

test("migration history is compared with the repository in both directions", () => {
    const repo = migrationVersionsFromNames(["20260117000000_a.sql", "20260117000001_b.sql", "README.md"]);
    assert.deepEqual(repo, ["20260117000000", "20260117000001"]);
    assert.equal(reconcile({ source: inventory(), restored: inventory(), repoMigrationVersions: repo }).verdict, "RECONCILED");

    const dbExtra = inventory({ migrationVersions: ["20260117000000", "20260117000001", "20260999000000"] });
    const one = reconcile({ source: dbExtra, restored: dbExtra, repoMigrationVersions: repo });
    assert.equal(one.verdict, "MISMATCH");
    assert.ok(failures(one).some(n => n.includes("migration 20260999000000 is in the database")));

    const repoExtra = [...repo, "20261030220000"];
    const two = reconcile({ source: inventory(), restored: inventory(), repoMigrationVersions: repoExtra });
    assert.ok(failures(two).some(n => n.includes("migration 20261030220000 is in the repository")));
});

test("the manifest must declare every source storage object per bucket, counting distinct names", () => {
    const row = (bucket, name) => ({ bucket, name, path: `storage/objects/${bucket}/${name}`, sha256: "0".repeat(64), bytes: 1 });
    const manifest = { storage: { objects: [row("logos", "a.png"), row("logos", "b.png"), row("receipts", "r.pdf")] } };
    assert.deepEqual(manifestObjectCounts(manifest), { logos: 2, receipts: 1 });
    assert.equal(reconcile({ source: inventory(), restored: inventory(), manifest }).verdict, "RECONCILED");

    // An exact repeat of a row must not make up for a missing object.
    const repeated = { storage: { objects: [row("logos", "a.png"), row("logos", "a.png"), row("receipts", "r.pdf")] } };
    const short = reconcile({ source: inventory(), restored: inventory(), manifest: repeated });
    assert.equal(short.verdict, "MISMATCH");
    assert.ok(failures(short).some(n => n.includes("bucket logos")));

    // A bucket the source has objects in but the manifest never mentions, and the reverse.
    const missingBucket = reconcile({ source: inventory(), restored: inventory(), manifest: { storage: { objects: [row("logos", "a.png"), row("logos", "b.png")] } } });
    assert.ok(failures(missingBucket).some(n => n.includes("bucket receipts")));
    const undeclared = reconcile({ source: inventory(), restored: inventory(), manifest: { storage: { objects: [...manifest.storage.objects, row("contracts", "c.pdf")] } } });
    assert.ok(failures(undeclared).some(n => n.includes("bucket contracts")));
});

test("credential-shaped values make the run invalid without being echoed", () => {
    const result = reconcile({ source: inventory(), restored: inventory(), rawTexts: ["note sb_secret_do_not_echo"] });
    assert.equal(result.verdict, "INVALID");
    assert.ok(!JSON.stringify(result).includes("sb_secret_do_not_echo"));
});

const dirs = [];
after(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }); });

test("CLI exit codes: 0 reconciled, 1 mismatch or invalid, 64 bad usage or unreadable input", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "a079-reconcile-"));
    dirs.push(dir);
    const write = (name, value) => { const file = path.join(dir, name); writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value)); return file; };
    const script = new URL("./recovery-reconcile.mjs", import.meta.url).pathname;
    const run = args => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });

    const source = write("source.json", inventory());
    assert.equal(run(["--source", source, "--restored", write("same.json", inventory())]).status, 0);
    const drift = run(["--source", source, "--restored", write("drift.json", inventory({ roles: ["anon"] }))]);
    assert.equal(drift.status, 1);
    assert.equal(JSON.parse(drift.stdout).verdict, "MISMATCH");
    assert.equal(run(["--source", source]).status, 64);
    assert.equal(run(["--source", source, "--restored", path.join(dir, "missing.json")]).status, 64);
    assert.equal(run(["--source", source, "--restored", write("bad.json", "{not json")]).status, 64);
    assert.equal(run(["--source", source, "--restored", write("same2.json", inventory()), "--bogus", "x"]).status, 64);

    const migrations = path.join(dir, "migrations");
    spawnSync("mkdir", [migrations]);
    writeFileSync(path.join(migrations, "20260117000000_a.sql"), "-- synthetic\n");
    writeFileSync(path.join(migrations, "20260117000001_b.sql"), "-- synthetic\n");
    assert.equal(run(["--source", source, "--restored", write("same3.json", inventory()), "--migrations-dir", migrations]).status, 0);
    writeFileSync(path.join(migrations, "20260117000002_c.sql"), "-- synthetic\n");
    assert.equal(run(["--source", source, "--restored", write("same4.json", inventory()), "--migrations-dir", migrations]).status, 1);
});
