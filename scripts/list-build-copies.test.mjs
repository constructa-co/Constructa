import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import {
    KEEP_COUNT,
    directoryBytes,
    findStoreRoots,
    formatReport,
    isBuildCopy,
    planBuildCopies,
} from "./list-build-copies.mjs";

// Synthetic fixtures only, inside $TMPDIR: no real build stores are touched.
const roots = [];
after(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });

function fixtureRoot() {
    const root = mkdtempSync(path.join(tmpdir(), "build-copies-"));
    roots.push(root);
    return root;
}

function makeBuildCopy(store, name, bytes, mtimeMs) {
    const dir = path.join(store, name);
    mkdirSync(path.join(dir, "server"), { recursive: true });
    mkdirSync(path.join(dir, "static"), { recursive: true });
    writeFileSync(path.join(dir, "server", "app.js"), "x".repeat(bytes));
    utimesSync(dir, new Date(mtimeMs), new Date(mtimeMs));
    return dir;
}

test("isBuildCopy accepts compiled output and rejects inputs snapshots and stray dirs", () => {
    const root = fixtureRoot();
    const store = path.join(root, ".next-company-first");
    const build = makeBuildCopy(store, "a001-build-20261028", 10, Date.now());
    mkdirSync(path.join(store, "a001-inputs-20261028"), { recursive: true });
    writeFileSync(path.join(store, "a001-inputs-20261028", "tsconfig.json"), "{}");
    mkdirSync(path.join(store, "a-worktree-checkout"), { recursive: true });
    writeFileSync(path.join(store, "a-worktree-checkout", "package.json"), "{}");
    assert.equal(isBuildCopy(build, "a001-build-20261028"), true);
    assert.equal(isBuildCopy(path.join(store, "a001-inputs-20261028"), "a001-inputs-20261028"), false);
    assert.equal(isBuildCopy(path.join(store, "a-worktree-checkout"), "a-worktree-checkout"), false);
});

test("findStoreRoots collects the workspace store and nested worktree stores, skipping noise", () => {
    const root = fixtureRoot();
    const store = path.join(root, ".next-company-first");
    mkdirSync(store, { recursive: true });
    const worktree = path.join(store, "a079-recovery-worktree");
    const nestedStore = path.join(worktree, ".next-company-first");
    mkdirSync(nestedStore, { recursive: true });
    mkdirSync(path.join(root, "node_modules", ".next-company-first"), { recursive: true });
    mkdirSync(path.join(root, ".git", ".next-company-first"), { recursive: true });
    const found = findStoreRoots(root);
    assert.deepEqual(found, [store, nestedStore].sort());
});

test("planBuildCopies sorts newest first, keeps the newest three and sums the rest", () => {
    const root = fixtureRoot();
    const store = path.join(root, ".next-company-first");
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const copies = [
        ["build-oldest", 2 * 1024 * 1024, now - 5 * day],
        ["build-4th", 4 * 1024 * 1024, now - 2 * day],
        ["build-newest", 8 * 1024 * 1024, now],
        ["build-2nd", 16 * 1024 * 1024, now - day],
        ["build-3rd", 32 * 1024 * 1024, now - 12 * 60 * 60 * 1000],
    ];
    for (const [name, bytes, mtime] of copies) makeBuildCopy(store, name, bytes, mtime);
    const plan = planBuildCopies([store]);
    assert.deepEqual(plan.map(copy => copy.name), ["build-newest", "build-3rd", "build-2nd", "build-4th", "build-oldest"]);
    assert.deepEqual(plan.map(copy => copy.keep), [true, true, true, false, false]);
    const freed = plan.filter(copy => !copy.keep).reduce((sum, copy) => sum + copy.bytes, 0);
    assert.equal(freed, 6 * 1024 * 1024);
    assert.equal(KEEP_COUNT, 3);
});

test("fewer copies than the keep count keeps everything and frees zero", () => {
    const root = fixtureRoot();
    const store = path.join(root, ".next-company-first");
    makeBuildCopy(store, "only-build", 1024, Date.now());
    const plan = planBuildCopies([store]);
    assert.deepEqual(plan.map(copy => copy.keep), [true]);
    const report = formatReport(plan);
    assert.match(report, /would free 0 MiB/);
});

test("formatReport marks KEEP vs remove, shows MiB and the read-only footer", () => {
    const root = fixtureRoot();
    const store = path.join(root, ".next-company-first");
    const now = Date.now();
    makeBuildCopy(store, "keep-build", 3 * 1024 * 1024, now);
    makeBuildCopy(store, "drop-build", 5 * 1024 * 1024, now - 60 * 1000);
    for (let i = 0; i < 3; i++) makeBuildCopy(store, `older-${i}`, 1024, now - (i + 2) * 60 * 1000);
    const report = formatReport(planBuildCopies([store]));
    const keepLine = report.split("\n").find(line => line.includes("keep-build"));
    const dropLine = report.split("\n").find(line => line.includes("older-2"));
    assert.match(keepLine, /KEEP/);
    assert.match(dropLine, /remove/);
    assert.match(keepLine, /3\.0/);
    assert.match(report, /would free 0\.0 MiB \(2048 bytes\)/);
    assert.match(report, /nothing was deleted, moved or modified/);
});

test("directoryBytes sums real file bytes only", () => {
    const root = fixtureRoot();
    const dir = path.join(root, "some-dir");
    mkdirSync(path.join(dir, "nested"), { recursive: true });
    writeFileSync(path.join(dir, "a.bin"), "a".repeat(100));
    writeFileSync(path.join(dir, "nested", "b.bin"), "b".repeat(50));
    assert.equal(directoryBytes(dir), 150);
});

test("CLI prints the inventory and deletes nothing", () => {
    const root = fixtureRoot();
    const store = path.join(root, ".next-company-first");
    const now = Date.now();
    const kept = makeBuildCopy(store, "cli-keep", 1024, now);
    const dropped = makeBuildCopy(store, "cli-drop", 2048, now - 1000);
    const result = spawnSync(process.execPath, [new URL("./list-build-copies.mjs", import.meta.url).pathname, "--root", root], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /cli-keep/);
    assert.match(result.stdout, /cli-drop/);
    assert.match(result.stdout, /would free 0 MiB/);
    assert.match(result.stdout, /nothing was deleted/);
    assert.ok(existsSync(kept), "kept copy must still exist after the run");
    assert.ok(existsSync(dropped), "removal candidate must still exist after the run");
});
