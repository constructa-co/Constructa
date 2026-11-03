// A100 private file-based editorial workflow. Local JSON state in an operator-supplied
// directory outside this git worktree. Creates drafts, records review feedback, records
// explicit human editorial approval for one revision, and writes a handoff copy for manual
// publication elsewhere. Does not publish, network, or read credentials from the environment.
import { createHash, randomUUID } from "node:crypto";
import {
    chmodSync,
    existsSync,
    lstatSync,
    mkdirSync,
    readFileSync,
    readlinkSync,
    realpathSync,
    renameSync,
    writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const STATE_VERSION = 1;
export const STATE_BASENAME = "constructa-editorial-state.json";

const DRAFT_ID = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const SECRET_PATTERNS = [
    /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
    /\bsb_secret_[A-Za-z0-9_-]+/,
    /\bpostgres(ql)?:\/\/[^\s:/@]+:[^\s@]+@/i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\b(sk|rk)_live_[A-Za-z0-9]+/,
];

export function findGitRoot(startDir) {
    let dir = realpathSync(startDir);
    for (;;) {
        if (existsSync(path.join(dir, ".git"))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        dir = realpathSync(parent);
    }
}

function followSymlinkForContainment(linkPath) {
    const linked = readlinkSync(linkPath);
    return path.normalize(
        path.isAbsolute(linked) ? linked : path.join(path.dirname(linkPath), linked),
    );
}

export function resolvePathForContainment(target) {
    const resolved = path.resolve(target);
    try {
        const stat = lstatSync(resolved);
        if (stat.isSymbolicLink()) {
            return resolvePathForContainment(followSymlinkForContainment(resolved));
        }
        if (existsSync(resolved)) {
            return realpathSync(resolved);
        }
    } catch (error) {
        if (!error || error.code !== "ENOENT") throw error;
    }
    const tail = [];
    let probe = resolved;
    while (!existsSync(probe)) {
        tail.unshift(path.basename(probe));
        const parent = path.dirname(probe);
        if (parent === probe) {
            return resolved;
        }
        probe = parent;
    }
    const existingRoot = realpathSync(probe);
    if (tail.length === 0) {
        return existingRoot;
    }
    let candidate = existingRoot;
    for (const segment of tail) {
        if (segment === "." || segment === "..") {
            return resolved;
        }
        candidate = path.join(candidate, segment);
        try {
            const stat = lstatSync(candidate);
            if (stat.isSymbolicLink()) {
                candidate = resolvePathForContainment(followSymlinkForContainment(candidate));
            }
        } catch (error) {
            if (!error || error.code !== "ENOENT") throw error;
        }
    }
    return path.normalize(candidate);
}

export function isPathInside(base, target) {
    const root = realpathSync(base);
    let resolved;
    try {
        resolved = realpathSync(target);
    } catch (error) {
        if (error && error.code === "ENOENT") resolved = resolvePathForContainment(target);
        else throw error;
    }
    return resolved === root || resolved.startsWith(root + path.sep);
}

export function assertStorageDirectory(storageDir, repoRoot) {
    if (typeof storageDir !== "string" || storageDir.trim() === "") {
        throw new Error("Missing --dir: state is never written without an explicit directory.");
    }
    if (!path.isAbsolute(storageDir)) {
        throw new Error("Storage directory must be an absolute path.");
    }
    if (repoRoot && isPathInside(repoRoot, storageDir)) {
        throw new Error("Storage directory must be outside the git worktree (refusing repo-contained state).");
    }
}

export function assertOutputPath(outputPath, repoRoot) {
    if (typeof outputPath !== "string" || outputPath.trim() === "") {
        throw new Error("Missing --out for handoff file.");
    }
    if (!path.isAbsolute(outputPath)) {
        throw new Error("Handoff --out must be an absolute path.");
    }
    if (repoRoot && isPathInside(repoRoot, outputPath)) {
        throw new Error("Handoff --out must be outside the git worktree.");
    }
}

export function validateDraftId(id) {
    if (typeof id !== "string" || !DRAFT_ID.test(id)) {
        throw new Error("Draft id must be lowercase alphanumeric with optional hyphens (no path segments).");
    }
}

export function scanForCredentialShapes(text, label) {
    if (typeof text !== "string") return `${label} must be a string`;
    for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(text)) return `${label} contains a credential-shaped value`;
    }
    return null;
}

export function computeRevision(title, content) {
    return createHash("sha256").update(String(title), "utf8").update("\0", "utf8").update(String(content), "utf8").digest("hex");
}

export function stateFilePath(storageDir) {
    return path.join(storageDir, STATE_BASENAME);
}

function ensureStorageDir(storageDir) {
    if (!existsSync(storageDir)) {
        mkdirSync(storageDir, { recursive: true, mode: 0o700 });
    }
    chmodSync(storageDir, 0o700);
}

export function loadState(storageDir) {
    const file = stateFilePath(storageDir);
    if (!existsSync(file)) {
        return { version: STATE_VERSION, drafts: {} };
    }
    const raw = readFileSync(file, "utf8");
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error("State file is not valid JSON.");
    }
    if (!parsed || typeof parsed !== "object" || parsed.version !== STATE_VERSION || typeof parsed.drafts !== "object") {
        throw new Error("State file has an unsupported shape.");
    }
    return parsed;
}

export function saveState(storageDir, state) {
    ensureStorageDir(storageDir);
    const file = stateFilePath(storageDir);
    const tmp = `${file}.${process.pid}.tmp`;
    const body = `${JSON.stringify(state, null, 2)}\n`;
    writeFileSync(tmp, body, { encoding: "utf8", mode: 0o600 });
    chmodSync(tmp, 0o600);
    renameSync(tmp, file);
    chmodSync(file, 0o600);
}

function nowIso() {
    return new Date().toISOString();
}

function requireLabel(value, name) {
    if (typeof value !== "string" || value.trim() === "") throw new Error(`${name} is required.`);
    const secret = scanForCredentialShapes(value, name);
    if (secret) throw new Error(secret);
    return value.trim();
}

function requireBody(value, name) {
    if (typeof value !== "string") throw new Error(`${name} is required.`);
    const secret = scanForCredentialShapes(value, name);
    if (secret) throw new Error(secret);
    return value;
}

export function createDraft(state, { title, content, id }) {
    const safeTitle = requireLabel(title, "title");
    const safeContent = requireBody(content, "content");
    const draftId = id ?? randomUUID();
    validateDraftId(draftId);
    if (state.drafts[draftId]) {
        throw new Error(`Draft id already exists: ${draftId}`);
    }
    const revision = computeRevision(safeTitle, safeContent);
    const stamp = nowIso();
    state.drafts[draftId] = {
        id: draftId,
        title: safeTitle,
        content: safeContent,
        revision,
        createdAt: stamp,
        updatedAt: stamp,
        reviews: [],
        approval: null,
    };
    return { draftId, revision };
}

export function updateDraft(state, draftId, { title, content }) {
    validateDraftId(draftId);
    const draft = state.drafts[draftId];
    if (!draft) throw new Error(`Unknown draft: ${draftId}`);
    const nextTitle = title !== undefined ? requireLabel(title, "title") : draft.title;
    const nextContent = content !== undefined ? requireBody(content, "content") : draft.content;
    draft.title = nextTitle;
    draft.content = nextContent;
    draft.revision = computeRevision(nextTitle, nextContent);
    draft.updatedAt = nowIso();
    draft.approval = null;
    return { draftId, revision: draft.revision };
}

export function addReview(state, draftId, { reviewer, feedback }) {
    validateDraftId(draftId);
    const draft = state.drafts[draftId];
    if (!draft) throw new Error(`Unknown draft: ${draftId}`);
    const entry = {
        at: nowIso(),
        reviewer: requireLabel(reviewer, "reviewer"),
        feedback: requireBody(feedback, "feedback"),
        revision: draft.revision,
    };
    draft.reviews.push(entry);
    draft.updatedAt = entry.at;
    return { draftId, revision: draft.revision, reviewCount: draft.reviews.length };
}

export function approveDraft(state, draftId, { approver }) {
    validateDraftId(draftId);
    const draft = state.drafts[draftId];
    if (!draft) throw new Error(`Unknown draft: ${draftId}`);
    const name = requireLabel(approver, "approver");
    const reviewed = draft.reviews.some(review => review.revision === draft.revision);
    if (!reviewed) {
        throw new Error("Cannot approve: no review feedback recorded for the current revision.");
    }
    draft.approval = {
        at: nowIso(),
        approver: name,
        revision: draft.revision,
        label: "editorial review only — not financial or release authority",
    };
    draft.updatedAt = draft.approval.at;
    return { draftId, revision: draft.revision, approver: name };
}

export function draftExportStatus(draft) {
    if (!draft) return { ready: false, reason: "unknown draft" };
    if (!draft.approval) return { ready: false, reason: "not approved" };
    if (draft.approval.revision !== draft.revision) {
        return { ready: false, reason: "approval is stale (content changed after approval)" };
    }
    return { ready: true, reason: "approved for handoff" };
}

export function buildHandoffText(draft) {
    const status = draftExportStatus(draft);
    if (!status.ready) throw new Error(`Export refused: ${status.reason}.`);
    return [
        "=== CONSTRUCTA EDITORIAL HANDOFF (NOT PUBLISHED) ===",
        "Approved copy for human manual publication only.",
        "Saving or copying this file does not publish anything externally.",
        `Draft id: ${draft.id}`,
        `Revision: ${draft.revision}`,
        `Approved by: ${draft.approval.approver} at ${draft.approval.at}`,
        `Approval note: ${draft.approval.label}`,
        "",
        `# ${draft.title}`,
        "",
        draft.content,
        "",
        "=== END HANDOFF ===",
    ].join("\n");
}

export function exportHandoff(state, draftId, { outputPath, repoRoot }) {
    validateDraftId(draftId);
    const draft = state.drafts[draftId];
    if (!draft) throw new Error(`Unknown draft: ${draftId}`);
    assertOutputPath(outputPath, repoRoot);
    const text = buildHandoffText(draft);
    writeFileSync(outputPath, text, { encoding: "utf8", mode: 0o600 });
    chmodSync(outputPath, 0o600);
    return { draftId, revision: draft.revision, outputPath, bytes: Buffer.byteLength(text, "utf8") };
}

export function readStatus(state, draftId) {
    if (draftId === undefined || draftId === null) {
        const summaries = Object.values(state.drafts).map(draft => ({
            id: draft.id,
            title: draft.title,
            revision: draft.revision,
            ...draftExportStatus(draft),
            reviewCount: draft.reviews.length,
        }));
        return { drafts: summaries };
    }
    validateDraftId(draftId);
    const draft = state.drafts[draftId];
    if (!draft) throw new Error(`Unknown draft: ${draftId}`);
    return {
        id: draft.id,
        title: draft.title,
        revision: draft.revision,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
        reviews: draft.reviews.map(review => ({
            at: review.at,
            reviewer: review.reviewer,
            revision: review.revision,
            feedbackPreview: review.feedback.slice(0, 120),
        })),
        approval: draft.approval,
        export: draftExportStatus(draft),
    };
}

function parseArgs(argv) {
    const args = [...argv];
    const options = { dir: undefined, out: undefined, title: undefined, content: undefined, reviewer: undefined, feedback: undefined, approver: undefined, id: undefined };
    let command;
    const positional = [];
    while (args.length > 0) {
        const token = args.shift();
        if (token === "--dir") {
            options.dir = args.shift();
            continue;
        }
        if (token === "--out") {
            options.out = args.shift();
            continue;
        }
        if (token === "--title") {
            options.title = args.shift();
            continue;
        }
        if (token === "--content") {
            options.content = args.shift();
            continue;
        }
        if (token === "--reviewer") {
            options.reviewer = args.shift();
            continue;
        }
        if (token === "--feedback") {
            options.feedback = args.shift();
            continue;
        }
        if (token === "--approver") {
            options.approver = args.shift();
            continue;
        }
        if (token === "--id") {
            options.id = args.shift();
            continue;
        }
        if (!command && !token.startsWith("-")) {
            command = token;
            continue;
        }
        positional.push(token);
    }
    return { command, positional, options };
}

export function runCli(argv, { repoRoot, stdin = "" } = {}) {
    const { command, positional, options } = parseArgs(argv);
    const usage = "Usage: node scripts/editorial-workflow.mjs --dir <absolute-path-outside-repo> <create|update|review|approve|export|status> ...";

    if (!command || command === "help") {
        return { exitCode: 64, stdout: "", stderr: `${usage}\nRead-only status still requires --dir.\n` };
    }

    if (!options.dir) {
        return { exitCode: 64, stdout: "", stderr: "Missing --dir: refusing to read or write state without an explicit directory.\n" };
    }

    try {
        assertStorageDirectory(options.dir, repoRoot);
    } catch (error) {
        return { exitCode: 1, stdout: "", stderr: `${error.message}\n` };
    }

    let state;
    try {
        state = loadState(options.dir);
    } catch (error) {
        return { exitCode: 1, stdout: "", stderr: `${error.message}\n` };
    }

    try {
        if (command === "create") {
            const content = options.content ?? stdin;
            const result = createDraft(state, { title: options.title, content, id: options.id });
            saveState(options.dir, state);
            return { exitCode: 0, stdout: `${JSON.stringify({ ok: true, action: "create", ...result }, null, 2)}\n`, stderr: "" };
        }
        if (command === "update") {
            const draftId = positional[0];
            if (!draftId) throw new Error("update requires a draft id.");
            const content = options.content !== undefined ? options.content : undefined;
            const result = updateDraft(state, draftId, { title: options.title, content });
            saveState(options.dir, state);
            return { exitCode: 0, stdout: `${JSON.stringify({ ok: true, action: "update", ...result }, null, 2)}\n`, stderr: "" };
        }
        if (command === "review") {
            const draftId = positional[0];
            if (!draftId) throw new Error("review requires a draft id.");
            const result = addReview(state, draftId, { reviewer: options.reviewer, feedback: options.feedback });
            saveState(options.dir, state);
            return { exitCode: 0, stdout: `${JSON.stringify({ ok: true, action: "review", ...result }, null, 2)}\n`, stderr: "" };
        }
        if (command === "approve") {
            const draftId = positional[0];
            if (!draftId) throw new Error("approve requires a draft id.");
            const result = approveDraft(state, draftId, { approver: options.approver });
            saveState(options.dir, state);
            return { exitCode: 0, stdout: `${JSON.stringify({ ok: true, action: "approve", ...result }, null, 2)}\n`, stderr: "" };
        }
        if (command === "export") {
            const draftId = positional[0];
            if (!draftId) throw new Error("export requires a draft id.");
            if (!options.out) throw new Error("export requires --out (absolute path outside the repo).");
            const result = exportHandoff(state, draftId, { outputPath: options.out, repoRoot });
            return { exitCode: 0, stdout: `${JSON.stringify({ ok: true, action: "export", ...result, note: "Handoff file is not publication." }, null, 2)}\n`, stderr: "" };
        }
        if (command === "status") {
            const draftId = positional[0];
            const report = readStatus(state, draftId);
            return { exitCode: 0, stdout: `${JSON.stringify({ ok: true, action: "status", report }, null, 2)}\n`, stderr: "" };
        }
        return { exitCode: 64, stdout: "", stderr: `Unknown command: ${command}\n${usage}\n` };
    } catch (error) {
        return { exitCode: 1, stdout: "", stderr: `${error.message}\n` };
    }
}

function main(argv) {
    const repoRoot = findGitRoot(path.dirname(fileURLToPath(import.meta.url)));
    const result = runCli(argv.slice(2), { repoRoot });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    return result.exitCode;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = main(process.argv);
