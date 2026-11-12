// A079 Git-only recovery step (runbook section 6, one repository). Bundles an existing clone into an
// operator-approved private destination, then reads the result back from disk. It never fetches,
// pushes, repairs, connects to a provider or writes to the clone; it writes only <dest>/git/.
// A BUNDLED_AND_READ_BACK verdict closes the git-bundle, git-refs and git-lfs-assets categories for
// this one repository. It is not a database, Auth or Storage recovery and does not make A079 Complete.
import { spawnSync } from "node:child_process";
import { chmodSync, lstatSync, mkdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { sha256File, text as isNamed } from "./recovery-manifest-check.mjs";

const GIT_SHA = /^[a-f0-9]{40}$/;
const NAME = /^[a-z0-9][a-z0-9-]{0,40}$/;
// A name heuristic only: it cannot prove a folder is unsynced, so the operator still attests it.
const SYNCED = /(^|\/)(Mobile Documents|CloudStorage|iCloud Drive|Dropbox|OneDrive[^/]*|Google Drive|Box)(\/|$)/i;

function git(cwd, args) {
    const env = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" };
    // An inherited GIT_DIR would silently point every check at a different repository. An inherited
    // GIT_CEILING_DIRECTORIES would stop the "destination is not inside any Git repository" search early
    // and report a destination inside a repository as outside every repository.
    for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR", "GIT_CEILING_DIRECTORIES"]) delete env[key];
    const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", maxBuffer: 1 << 28, env });
    return { ok: result.status === 0, out: result.stdout ?? "", err: (result.stderr || result.error?.message || "").trim() };
}

function parseRefs(textValue, order) {
    const map = new Map();
    for (const line of textValue.split("\n")) {
        if (line === "") continue;
        const [first, second, ...rest] = line.split(" ");
        const [ref, sha] = order === "ref-sha" ? [first, second] : [second, first];
        if (rest.length > 0 || !ref || !GIT_SHA.test(sha ?? "")) return null;
        map.set(ref, sha);
    }
    return map;
}

function describe(file) {
    return { bytes: statSync(file).size, sha256: sha256File(file) };
}

export function runBundle({ repo, name, dest, approvedBy, required, checkOnly = false }) {
    const report = { verdict: "FAIL", mode: checkOnly ? "check-only" : "bundle", checks: [] };
    const add = (check, pass, detail = "") => { report.checks.push(pass ? { check, pass } : { check, pass, detail }); return pass; };
    const finish = () => {
        const passed = report.checks.every(entry => entry.pass);
        report.verdict = passed ? (checkOnly ? "PREFLIGHT_OK" : "BUNDLED_AND_READ_BACK") : "FAIL";
        return report;
    };

    // Inputs are named by the operator and never defaulted.
    if (!add("inputs are named (repo, name, dest, approved-by, at least one required ref)",
        Boolean(repo) && NAME.test(name ?? "") && Boolean(dest) && isNamed(approvedBy)
        && Array.isArray(required) && required.length > 0 && required.every(item => /^refs\//.test(item?.ref ?? "") && GIT_SHA.test(item?.sha ?? "")))) return finish();
    if (!add("git is runnable", git(".", ["--version"]).ok)) return finish();

    // Source clone: must be the top level of a working tree and complete (a shallow clone bundles a partial history).
    let repoReal;
    try { repoReal = realpathSync(repo); } catch { add("source clone exists", false); return finish(); }
    const top = git(repoReal, ["rev-parse", "--show-toplevel"]);
    if (!add("source is the top level of an existing working tree", top.ok && realpathSync(top.out.trim()) === repoReal, top.ok ? "" : top.err)) return finish();
    if (!add("source is not a shallow clone", git(repoReal, ["rev-parse", "--is-shallow-repository"]).out.trim() === "false")) return finish();

    // Destination: exact checks, all before anything is written.
    let destReal;
    let stat;
    try { stat = lstatSync(dest); destReal = realpathSync(dest); } catch { add("destination exists", false); return finish(); }
    if (!add("destination is an absolute path", path.isAbsolute(dest))) return finish();
    if (!add("destination is a real directory (not a symlink) given by its real path", stat.isDirectory() && !stat.isSymbolicLink() && destReal === path.resolve(dest))) return finish();
    add("destination is owned by the running user", typeof process.getuid !== "function" || stat.uid === process.getuid());
    add("destination is private (no group or other access)", (stat.mode & 0o077) === 0, `mode ${(stat.mode & 0o777).toString(8)}`);
    add("destination path is not in a known cloud-synced folder", !SYNCED.test(destReal));
    add("destination is outside the source clone, and the clone is outside it",
        destReal !== repoReal && !destReal.startsWith(repoReal + path.sep) && !repoReal.startsWith(destReal + path.sep));
    const inside = git(destReal, ["rev-parse", "--git-dir"]);
    add("destination is not inside any Git repository", !inside.ok && /not a git repository/i.test(inside.err), inside.ok ? "inside a repository" : "");
    let gitDirExists = true;
    try { lstatSync(path.join(destReal, "git")); } catch { gitDirExists = false; }
    add("destination has no existing git/ folder (evidence is never overwritten)", !gitDirExists);
    if (!report.checks.every(entry => entry.pass)) return finish();

    // Refs: every required ref must exist in the clone at exactly its expected SHA.
    const listRefs = () => git(repoReal, ["for-each-ref", "--format=%(refname) %(objectname)"]);
    const before = listRefs();
    const refsBefore = before.ok ? parseRefs(before.out, "ref-sha") : null;
    if (!add("clone refs are readable", refsBefore !== null && refsBefore.size > 0, before.err)) return finish();
    report.refCount = refsBefore.size;
    report.requiredRefs = required.map(({ ref, sha }) => ({ ref, expected: sha, clone: refsBefore.get(ref) ?? null, bundle: null, pass: false }));
    if (!add("every required ref is in the clone at its expected SHA", report.requiredRefs.every(item => item.clone === item.expected),
        report.requiredRefs.filter(item => item.clone !== item.expected).map(item => item.ref).join(", "))) return finish();
    if (!add("git-lfs is available (an empty LFS list must be a real answer)", git(repoReal, ["lfs", "version"]).ok)) return finish();

    // Operator-time facts for the private-work reconciliation. Counts for this checkout only, no paths.
    const worktrees = git(repoReal, ["worktree", "list", "--porcelain"]).out.split("\n").filter(line => line.startsWith("worktree ")).length;
    const changed = git(repoReal, ["status", "--porcelain=v1", "--untracked-files=all"]).out.split("\n").filter(Boolean).length;
    report.privateWork = { worktrees, changedOrUntrackedPathsInThisCheckout: changed, note: "Reconcile each worktree per runbook section 6; this is not that reconciliation." };
    if (checkOnly) return finish();

    // Write. Files are created exclusively into a fresh 0700 folder; a failure leaves them as evidence.
    const gitDir = path.join(destReal, "git");
    const file = suffix => path.join(gitDir, `${name}${suffix}`);
    let heads;
    try {
        mkdirSync(gitDir, { mode: 0o700 });
        writeFileSync(file("-refs.txt"), before.out, { flag: "wx", mode: 0o600 });
        const created = git(repoReal, ["bundle", "create", file(".bundle"), "--all"]);
        if (!add("git bundle create --all", created.ok, created.err)) return finish();
        chmodSync(file(".bundle"), 0o600);
        if (!add("git bundle verify exits 0", git(repoReal, ["bundle", "verify", file(".bundle")]).ok)) return finish();
        heads = git(repoReal, ["bundle", "list-heads", file(".bundle")]);
        if (!add("git bundle list-heads", heads.ok, heads.err)) return finish();
        writeFileSync(file("-bundle-heads.txt"), heads.out, { flag: "wx", mode: 0o600 });
        const lfs = git(repoReal, ["lfs", "ls-files", "--all", "--long"]);
        if (!add("git lfs ls-files --all --long", lfs.ok, lfs.err)) return finish();
        writeFileSync(file("-lfs.txt"), lfs.out, { flag: "wx", mode: 0o600 });
    } catch (error) {
        add("write into <dest>/git", false, String(error?.message ?? error).replaceAll(destReal, "<dest>"));
        return finish();
    }

    // Read back from disk and from the clone again; nothing below trusts what was just in memory.
    const after = listRefs();
    const refsAfter = after.ok ? parseRefs(after.out, "ref-sha") : null;
    add("clone refs did not move while bundling", refsAfter !== null && after.out === before.out, "re-run into a new destination; do not overwrite this one");
    const bundleHeads = parseRefs(heads.out, "sha-ref");
    if (!add("bundle head list is parseable", bundleHeads !== null)) return finish();
    const wrong = [...refsBefore].filter(([ref, sha]) => bundleHeads.get(ref) !== sha).map(([ref]) => ref);
    add("every clone ref is in the bundle at the same SHA", wrong.length === 0, wrong.slice(0, 10).join(", "));
    for (const item of report.requiredRefs) {
        item.bundle = bundleHeads.get(item.ref) ?? null;
        item.pass = item.bundle === item.expected && item.clone === item.expected;
    }
    add("every required ref is in the bundle at its expected SHA", report.requiredRefs.every(item => item.pass));
    add("the LFS list is empty", describe(file("-lfs.txt")).bytes === 0, "LFS objects exist; they are not exported by this step");

    const paths = [["-refs.txt", "git-refs"], [".bundle", "git-bundle"], ["-bundle-heads.txt", "git-refs"], ["-lfs.txt", "git-lfs-assets"]];
    const entries = paths.map(([suffix, category]) => ({ path: `git/${name}${suffix}`, category, ...describe(file(suffix)) }));
    report.files = entries.map(({ path: entryPath, bytes, sha256 }) => ({ path: entryPath, bytes, sha256 }));
    finish();
    if (report.verdict === "BUNDLED_AND_READ_BACK") {
        const pinned = report.requiredRefs.map(({ ref, expected }) => ({ repository: name, ref, sha: expected }));
        report.manifestFragment = {
            destination: { location: destReal, approvedBy },
            entries,
            git: { refs: pinned, requiredRefs: pinned },
        };
    }
    return report;
}

function parseArgs(argv) {
    const options = { required: [], checkOnly: false };
    const flags = { "--repo": "repo", "--name": "name", "--dest": "dest", "--approved-by": "approvedBy" };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === "--check-only") { options.checkOnly = true; continue; }
        const value = argv[index + 1];
        if (value === undefined || value.startsWith("--")) return null;
        index += 1;
        if (arg === "--require") {
            const match = /^(refs\/[A-Za-z0-9._/-]+)=([a-f0-9]{40})$/.exec(value);
            if (!match || match[1].includes("..")) return null;
            options.required.push({ ref: match[1], sha: match[2] });
        } else if (flags[arg] && options[flags[arg]] === undefined) options[flags[arg]] = value;
        else return null;
    }
    return options.repo && options.name && options.dest && options.approvedBy && options.required.length > 0 ? options : null;
}

function main(argv) {
    const options = parseArgs(argv.slice(2));
    if (!options) {
        console.error("Usage: node scripts/recovery-git-bundle.mjs --repo <clone> --name <short-name> --dest <EXPORT_DEST> --approved-by <owner> --require <ref>=<40-hex-sha> [--require ...] [--check-only]");
        return 64;
    }
    const report = runBundle(options);
    console.log(JSON.stringify(report, null, 2));
    return report.verdict === "FAIL" ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = main(process.argv);
