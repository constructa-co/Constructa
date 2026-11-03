import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
