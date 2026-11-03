import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import {
    addReview,
    approveDraft,
    buildHandoffText,
    createDraft,
    draftExportStatus,
    exportHandoff,
    findGitRoot,
    loadState,
    readStatus,
    runCli,
    saveState,
    updateDraft,
    validateDraftId,
} from "./editorial-workflow.mjs";

const roots = [];
after(() => {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function storageRoot() {
    const root = mkdtempSync(path.join(tmpdir(), "a100-editorial-"));
    roots.push(root);
    return root;
}

function repoRootFromHere() {
    return findGitRoot(path.dirname(fileURLToPath(import.meta.url)));
}

test("minimal flow: create, review, approve, export handoff", () => {
    const dir = storageRoot();
    const repoRoot = repoRootFromHere();
    const state = loadState(dir);
    const { draftId, revision } = createDraft(state, {
        title: "Product review guide headline",
        content: "Synthetic marketing copy for workflow test only.\n",
        id: "guide-draft-1",
    });
    saveState(dir, state);
    addReview(state, draftId, { reviewer: "named-reviewer", feedback: "Looks accurate against ProductReviewGuide tone." });
    approveDraft(state, draftId, { approver: "named-approver" });
    saveState(dir, state);
    const out = path.join(dir, "handoff.txt");
    const exported = exportHandoff(state, draftId, { outputPath: out, repoRoot });
    assert.equal(exported.revision, revision);
    const text = readFileSync(out, "utf8");
    assert.match(text, /NOT PUBLISHED/);
    assert.match(text, /Product review guide headline/);
    assert.doesNotMatch(text, /https?:\/\//);
});

test("stale approval after edit blocks export", () => {
    const dir = storageRoot();
    const repoRoot = repoRootFromHere();
    const state = loadState(dir);
    const { draftId } = createDraft(state, {
        title: "Draft A",
        content: "Version one",
        id: "stale-draft",
    });
    addReview(state, draftId, { reviewer: "r", feedback: "ok" });
    approveDraft(state, draftId, { approver: "a" });
    updateDraft(state, draftId, { content: "Version two" });
    assert.equal(draftExportStatus(state.drafts[draftId]).ready, false);
    assert.throws(() => buildHandoffText(state.drafts[draftId]), /Export refused/);
    const out = path.join(dir, "blocked.txt");
    assert.throws(() => exportHandoff(state, draftId, { outputPath: out, repoRoot }), /Export refused/);
});

test("review feedback alone is not approval", () => {
    const state = { version: 1, drafts: {} };
    const { draftId } = createDraft(state, {
        title: "Draft B",
        content: "Body",
        id: "review-only",
    });
    addReview(state, draftId, { reviewer: "r", feedback: "Please tweak intro." });
    assert.equal(draftExportStatus(state.drafts[draftId]).ready, false);

    const noReview = { version: 1, drafts: {} };
    createDraft(noReview, { title: "X", content: "Y", id: "no-review-yet" });
    assert.throws(() => approveDraft(noReview, "no-review-yet", { approver: "a" }), /no review feedback/);

    approveDraft(state, draftId, { approver: "a" });
    assert.equal(draftExportStatus(state.drafts[draftId]).ready, true);
});

test("safe draft id and no silent overwrite", () => {
    const state = { version: 1, drafts: {} };
    createDraft(state, { title: "T", content: "C", id: "safe-id" });
    assert.throws(() => createDraft(state, { title: "T2", content: "C2", id: "safe-id" }), /already exists/);
    assert.throws(() => validateDraftId("../escape"), /Draft id/);
    assert.throws(() => validateDraftId("bad/slash"), /Draft id/);
});

test("storage and handoff refuse repo-contained paths", () => {
    const repoRoot = repoRootFromHere();
    assert.ok(repoRoot);
    const inside = path.join(repoRoot, "private-editorial-state-refused");
    const result = runCli(["status", "--dir", inside], { repoRoot });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /outside the git worktree/);
});

test("cli status is read-only dry state without network", () => {
    const dir = storageRoot();
    const repoRoot = repoRootFromHere();
    const state = loadState(dir);
    createDraft(state, { title: "T", content: "C", id: "status-id" });
    saveState(dir, state);
    const result = runCli(["status", "status-id", "--dir", dir], { repoRoot });
    assert.equal(result.exitCode, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.report.export.ready, false);
    assert.equal(readStatus(state, "status-id").export.reason, "not approved");
});

test("cli update without --content preserves body (stdin default must not wipe)", () => {
    const dir = storageRoot();
    const repoRoot = repoRootFromHere();
    const create = runCli(
        ["create", "--dir", dir, "--title", "Original title", "--content", "Keep this body", "--id", "title-only-upd"],
        { repoRoot, stdin: "stdin must not apply on update" },
    );
    assert.equal(create.exitCode, 0);
    const result = runCli(
        ["update", "title-only-upd", "--dir", dir, "--title", "Renamed title"],
        { repoRoot, stdin: "stdin must not apply on update" },
    );
    assert.equal(result.exitCode, 0);
    const state = loadState(dir);
    assert.equal(state.drafts["title-only-upd"].title, "Renamed title");
    assert.equal(state.drafts["title-only-upd"].content, "Keep this body");
});

test("cli update with explicit empty --content clears body and invalidates approval", () => {
    const dir = storageRoot();
    const repoRoot = repoRootFromHere();
    const state = loadState(dir);
    createDraft(state, { title: "T", content: "Body text", id: "empty-content-upd" });
    addReview(state, "empty-content-upd", { reviewer: "r", feedback: "ok" });
    approveDraft(state, "empty-content-upd", { approver: "a" });
    saveState(dir, state);
    const result = runCli(["update", "empty-content-upd", "--dir", dir, "--content", ""], { repoRoot });
    assert.equal(result.exitCode, 0);
    const next = loadState(dir);
    assert.equal(next.drafts["empty-content-upd"].content, "");
    assert.equal(next.drafts["empty-content-upd"].approval, null);
});

test("nonexistent --dir through symlink parent into repo is refused", () => {
    const repoRoot = repoRootFromHere();
    assert.ok(repoRoot);
    const outside = storageRoot();
    const linkParent = path.join(outside, "symlink-parent");
    mkdirSync(linkParent);
    const insideRepo = path.join(repoRoot, ".tmp-a100-symlink-target");
    mkdirSync(insideRepo, { recursive: true });
    roots.push(insideRepo);
    const symlinkPath = path.join(linkParent, "into-repo");
    symlinkSync(insideRepo, symlinkPath);
    const statePath = path.join(symlinkPath, "missing", "state-dir");
    const result = runCli(["status", "--dir", statePath], { repoRoot });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /outside the git worktree/);
});

test("nonexistent export --out through symlink parent into repo is refused", () => {
    const repoRoot = repoRootFromHere();
    assert.ok(repoRoot);
    const dir = storageRoot();
    const state = loadState(dir);
    createDraft(state, { title: "T", content: "C", id: "symlink-export" });
    addReview(state, "symlink-export", { reviewer: "r", feedback: "fine" });
    approveDraft(state, "symlink-export", { approver: "a" });
    saveState(dir, state);
    const outside = storageRoot();
    const linkParent = path.join(outside, "symlink-parent-export");
    mkdirSync(linkParent);
    const insideRepo = path.join(repoRoot, ".tmp-a100-export-symlink-target");
    mkdirSync(insideRepo, { recursive: true });
    roots.push(insideRepo);
    symlinkSync(insideRepo, path.join(linkParent, "into-repo"));
    const outPath = path.join(linkParent, "into-repo", "missing-handoff.txt");
    const result = runCli(["export", "symlink-export", "--dir", dir, "--out", outPath], { repoRoot });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /outside the git worktree/);
});

test("dangling --dir symlink pointing into repo is refused", () => {
    const repoRoot = repoRootFromHere();
    assert.ok(repoRoot);
    const outside = storageRoot();
    const targetInRepo = path.join(repoRoot, ".tmp-a100-dangling-state-dir");
    roots.push(targetInRepo);
    const danglingDir = path.join(outside, "state-link");
    symlinkSync(targetInRepo, danglingDir);
    const result = runCli(["status", "--dir", danglingDir], { repoRoot });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /outside the git worktree/);
});

test("dangling export --out symlink into repo is refused without creating target", () => {
    const repoRoot = repoRootFromHere();
    assert.ok(repoRoot);
    const dir = storageRoot();
    const state = loadState(dir);
    createDraft(state, { title: "T", content: "C", id: "dangling-out" });
    addReview(state, "dangling-out", { reviewer: "r", feedback: "fine" });
    approveDraft(state, "dangling-out", { approver: "a" });
    saveState(dir, state);
    const outside = storageRoot();
    const targetInRepo = path.join(repoRoot, ".tmp-a100-dangling-handoff.txt");
    roots.push(targetInRepo);
    const outLink = path.join(outside, "handoff-link");
    symlinkSync(targetInRepo, outLink);
    const result = runCli(["export", "dangling-out", "--dir", dir, "--out", outLink], { repoRoot });
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /outside the git worktree/);
    assert.equal(existsSync(targetInRepo), false);
});

test("export output is a local file only (no publication claim in json)", () => {
    const dir = storageRoot();
    const repoRoot = repoRootFromHere();
    const state = loadState(dir);
    createDraft(state, { title: "T", content: "C", id: "export-json" });
    addReview(state, "export-json", { reviewer: "r", feedback: "fine" });
    approveDraft(state, "export-json", { approver: "a" });
    const out = path.join(dir, "out.txt");
    const result = runCli(["export", "export-json", "--dir", dir, "--out", out], { repoRoot });
    assert.equal(result.exitCode, 0);
    const payload = JSON.parse(result.stdout);
    assert.match(payload.note, /not publication/i);
});
