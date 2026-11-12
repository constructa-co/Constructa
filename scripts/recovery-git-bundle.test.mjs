import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { checkManifest } from "./recovery-manifest-check.mjs";
import { runBundle } from "./recovery-git-bundle.mjs";

// Synthetic repositories only, built in temp folders. No remote, network or provider is touched.
const roots = [];
after(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });
const temp = label => {
    const root = realpathSync(mkdtempSync(path.join(tmpdir(), `a079-${label}-`)));
    roots.push(root);
    return root;
};

const fixtureEnv = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
function g(cwd, ...args) {
    const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", env: fixtureEnv });
    assert.equal(result.status, 0, `git ${args.join(" ")}: ${result.stderr}`);
    return result.stdout.trim();
}

function makeRepo() {
    const repo = temp("repo");
    g(repo, "init", "-q", "-b", "main");
    writeFileSync(path.join(repo, "a.txt"), "one\n");
    g(repo, "add", "a.txt");
    g(repo, "commit", "-q", "-m", "first");
    g(repo, "branch", "backup");
    g(repo, "tag", "v1");
    writeFileSync(path.join(repo, "a.txt"), "two\n");
    g(repo, "commit", "-q", "-am", "second");
    return { repo, backupSha: g(repo, "rev-parse", "backup"), mainSha: g(repo, "rev-parse", "main") };
}

// A stand-in `git-lfs` on PATH, so the tests do not depend on LFS being installed.
const fakeBin = temp("lfs");
const fakeLfs = path.join(fakeBin, "git-lfs");
writeFileSync(fakeLfs, '#!/bin/sh\ncase "$FAKE_LFS_MODE:$1" in\n  missing:*) echo "git: lfs is not a git command" >&2; exit 1;;\n  nonempty:ls-files) echo "0123456789 * big.bin";;\n  *:version) echo "git-lfs/test";;\n  *:ls-files) ;;\nesac\n');
chmodSync(fakeLfs, 0o755);
function withLfs(mode, fn) {
    const saved = { PATH: process.env.PATH, FAKE_LFS_MODE: process.env.FAKE_LFS_MODE };
    process.env.PATH = `${fakeBin}${path.delimiter}${saved.PATH}`;
    process.env.FAKE_LFS_MODE = mode;
    try { return fn(); } finally {
        process.env.PATH = saved.PATH;
        if (saved.FAKE_LFS_MODE === undefined) delete process.env.FAKE_LFS_MODE; else process.env.FAKE_LFS_MODE = saved.FAKE_LFS_MODE;
    }
}

const run = (fixture, dest, overrides = {}) => withLfs("ok", () => runBundle({
    repo: fixture.repo, name: "app", dest, approvedBy: "named-owner",
    required: [{ ref: "refs/heads/backup", sha: fixture.backupSha }], ...overrides,
}));
const failed = report => report.checks.filter(entry => !entry.pass).map(entry => entry.check);

test("bundles, reads back, and the fragment satisfies the manifest check for the git categories", () => {
    const fixture = makeRepo();
    const dest = temp("dest");
    const report = run(fixture, dest, { required: [{ ref: "refs/heads/backup", sha: fixture.backupSha }, { ref: "refs/heads/main", sha: fixture.mainSha }] });
    assert.deepEqual(failed(report), []);
    assert.equal(report.verdict, "BUNDLED_AND_READ_BACK");
    assert.ok(report.requiredRefs.every(item => item.pass && item.bundle === item.expected));
    for (const name of ["app.bundle", "app-refs.txt", "app-bundle-heads.txt", "app-lfs.txt"]) {
        assert.equal(statSync(path.join(dest, "git", name)).mode & 0o077, 0, `${name} must be private`);
    }
    assert.equal(readFileSync(path.join(dest, "git", "app-lfs.txt"), "utf8"), "");
    assert.match(readFileSync(path.join(dest, "git", "app-bundle-heads.txt"), "utf8"), new RegExp(`${fixture.backupSha} refs/heads/backup`));
    assert.equal(report.refCount, 3); // refs/heads/main, refs/heads/backup, refs/tags/v1
    // The fragment is what the operator pastes into manifest.json; check it against the bytes on disk.
    const result = checkManifest({
        version: 1, ...report.manifestFragment, restoreTarget: { projectRef: "disposable-restore-ref", disposable: true },
        source: { projectRefs: ["synthetic-source-ref"] }, waivers: [],
    }, { root: dest });
    assert.ok(result.errors.every(error => /^missing category |storage\.buckets is missing /.test(error)), result.errors.join("\n"));
    assert.deepEqual([result.counts["git-bundle"], result.counts["git-refs"], result.counts["git-lfs-assets"]], [1, 2, 1]);
    assert.equal(result.bytesVerified, true);
});

test("check-only runs every check and writes nothing", () => {
    const fixture = makeRepo();
    const dest = temp("dest");
    const report = run(fixture, dest, { checkOnly: true });
    assert.equal(report.verdict, "PREFLIGHT_OK");
    assert.equal(existsSync(path.join(dest, "git")), false);
    assert.equal(report.privateWork.worktrees, 1);
});

test("a required ref at the wrong SHA stops before anything is written", () => {
    const fixture = makeRepo();
    const dest = temp("dest");
    const report = run(fixture, dest, { required: [{ ref: "refs/heads/backup", sha: fixture.mainSha }] });
    assert.equal(report.verdict, "FAIL");
    assert.deepEqual(failed(report), ["every required ref is in the clone at its expected SHA"]);
    assert.equal(existsSync(path.join(dest, "git")), false);
});

test("a ref missing from the clone is refused", () => {
    const fixture = makeRepo();
    const report = run(fixture, temp("dest"), { required: [{ ref: "refs/heads/absent", sha: fixture.mainSha }] });
    assert.equal(report.verdict, "FAIL");
    assert.equal(report.requiredRefs[0].clone, null);
});

test("unsafe destinations are refused with the exact failing check and nothing is written", () => {
    const fixture = makeRepo();
    const cases = [];

    const groupReadable = temp("dest");
    chmodSync(groupReadable, 0o750);
    cases.push([groupReadable, "destination is private (no group or other access)"]);

    const insideClone = path.join(fixture.repo, "export");
    mkdirSync(insideClone, { mode: 0o700 });
    cases.push([insideClone, "destination is outside the source clone, and the clone is outside it"]);

    const elsewhere = makeRepo();
    const insideOtherRepo = path.join(elsewhere.repo, "export");
    mkdirSync(insideOtherRepo, { mode: 0o700 });
    cases.push([insideOtherRepo, "destination is not inside any Git repository"]);

    const synced = path.join(temp("parent"), "Dropbox", "backups");
    mkdirSync(synced, { recursive: true, mode: 0o700 });
    cases.push([synced, "destination path is not in a known cloud-synced folder"]);

    const withGit = temp("dest");
    mkdirSync(path.join(withGit, "git"), { mode: 0o700 });
    cases.push([withGit, "destination has no existing git/ folder (evidence is never overwritten)"]);

    const real = temp("dest");
    const link = path.join(temp("parent"), "link");
    symlinkSync(real, link);
    cases.push([link, "destination is a real directory (not a symlink) given by its real path"]);

    for (const [dest, expected] of cases) {
        const report = run(fixture, dest);
        assert.equal(report.verdict, "FAIL", dest);
        assert.ok(failed(report).includes(expected), `${expected}: got ${failed(report).join("; ")}`);
    }
    assert.equal(existsSync(path.join(groupReadable, "git")), false);
    assert.equal(existsSync(path.join(real, "git")), false);
});

test("a destination that does not exist is refused, not created", () => {
    const dest = path.join(temp("parent"), "does-not-exist");
    const report = run(makeRepo(), dest);
    assert.deepEqual(failed(report), ["destination exists"]);
    assert.equal(existsSync(dest), false);
});

test("a shallow clone is refused because its bundle would hold partial history", () => {
    const fixture = makeRepo();
    const shallow = path.join(temp("parent"), "shallow");
    const cloned = spawnSync("git", ["clone", "-q", "--depth", "1", `file://${fixture.repo}`, shallow], { encoding: "utf8", env: fixtureEnv });
    assert.equal(cloned.status, 0, cloned.stderr);
    const dest = temp("dest");
    const report = run({ ...fixture, repo: shallow }, dest, { required: [{ ref: "refs/heads/main", sha: fixture.mainSha }] });
    assert.deepEqual(failed(report), ["source is not a shallow clone"]);
    assert.equal(existsSync(path.join(dest, "git")), false);
});

test("an unavailable git-lfs is refused before writing, and a non-empty LFS list fails after", () => {
    const fixture = makeRepo();
    const missing = temp("dest");
    const refused = withLfs("missing", () => runBundle({ repo: fixture.repo, name: "app", dest: missing, approvedBy: "named-owner", required: [{ ref: "refs/heads/backup", sha: fixture.backupSha }] }));
    assert.deepEqual(failed(refused), ["git-lfs is available (an empty LFS list must be a real answer)"]);
    assert.equal(existsSync(path.join(missing, "git")), false);

    const populated = temp("dest");
    const flagged = withLfs("nonempty", () => runBundle({ repo: fixture.repo, name: "app", dest: populated, approvedBy: "named-owner", required: [{ ref: "refs/heads/backup", sha: fixture.backupSha }] }));
    assert.equal(flagged.verdict, "FAIL");
    assert.deepEqual(failed(flagged), ["the LFS list is empty"]);
    assert.equal(flagged.manifestFragment, undefined);
});

test("a second run into the same destination is refused rather than overwriting evidence", () => {
    const fixture = makeRepo();
    const dest = temp("dest");
    assert.equal(run(fixture, dest).verdict, "BUNDLED_AND_READ_BACK");
    const before = readFileSync(path.join(dest, "git", "app.bundle"));
    const again = run(fixture, dest);
    assert.equal(again.verdict, "FAIL");
    assert.ok(failed(again).includes("destination has no existing git/ folder (evidence is never overwritten)"));
    assert.deepEqual(readFileSync(path.join(dest, "git", "app.bundle")), before);
});

test("placeholder and missing inputs are refused", () => {
    const fixture = makeRepo();
    for (const overrides of [{ approvedBy: "TBD" }, { approvedBy: "<owner>" }, { name: "Bad Name" }, { required: [] }, { required: [{ ref: "refs/heads/backup", sha: "abc" }] }]) {
        const report = run(fixture, temp("dest"), overrides);
        assert.equal(report.verdict, "FAIL", JSON.stringify(overrides));
        assert.match(failed(report)[0], /^inputs are named/);
    }
});

test("the command line exits 64 on bad usage and never reaches git", () => {
    const script = path.join(import.meta.dirname, "recovery-git-bundle.mjs");
    for (const args of [[], ["--repo", "x"], ["--require", "refs/heads/a=short"], ["--bogus", "1"]]) {
        const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
        assert.equal(result.status, 64, args.join(" "));
        assert.match(result.stderr, /^Usage:/);
    }
});
