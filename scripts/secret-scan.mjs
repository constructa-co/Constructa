import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SHA = /^[a-f0-9]{40}$/;
const ZERO = "0".repeat(40);
const checkedSha = (value) => {
    if (!SHA.test(value ?? "") || value === ZERO) throw Error("Secret scan needs a valid non-zero commit SHA.");
    return value;
};

export function scanRange(eventName, event, mergeBase) {
    if (eventName === "pull_request") {
        return `${checkedSha(event.pull_request?.base?.sha)}..${checkedSha(event.pull_request?.head?.sha)}`;
    }
    if (eventName !== "push" || event.deleted) throw Error("Unsupported secret-scan event.");
    const head = checkedSha(event.after);
    if (event.before !== ZERO) return `${checkedSha(event.before)}..${head}`;
    const branch = event.repository?.default_branch;
    if (typeof branch !== "string" || !/^[A-Za-z0-9_./-]+$/.test(branch) || branch.includes("..")) {
        throw Error("Cannot determine the default-branch baseline.");
    }
    return `${checkedSha(mergeBase(head, `refs/remotes/origin/${branch}`))}..${head}`;
}

export function hasTrackedMcp(paths) {
    return paths.some(name => name === ".mcp.json" || name.endsWith("/.mcp.json"));
}

export function verifyHistory(range, run = spawnSync) {
    // Gitleaks can return success when its underlying Git walk fails. Check that walk independently.
    const result = run("git", ["--no-pager", "log", "--no-show-signature", "--no-notes", "--no-ext-diff", "--no-textconv", "--format=", "-p", range],
        { stdio: ["ignore", "ignore", "pipe"], timeout: 120000 });
    if (result.error || result.status !== 0) throw Error("Required commit history could not be read.");
}

function main() {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    const range = scanRange(process.env.GITHUB_EVENT_NAME, event,
        (head, base) => execFileSync("git", ["merge-base", head, base], { encoding: "utf8" }).trim());
    verifyHistory(range);
    const paths = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
    if (hasTrackedMcp(paths)) throw Error("Local .mcp.json connection configuration must not be tracked.");
    const common = ["--config", ".gitleaks.toml", "--redact=100", "--no-banner", "--no-color", "--ignore-gitleaks-allow", "--timeout=120"];
    // Scan the clean CI checkout and every new commit, including secrets removed before the final tree.
    for (const args of [["dir", ...common, "."], ["git", ...common, `--log-opts=${range}`, "."]]) {
        const result = spawnSync("gitleaks", args, { stdio: "inherit", timeout: 130000 });
        if (result.error || result.status !== 0) process.exit(result.status || 1);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try { main(); } catch {
        console.error("Secret scan could not establish a safe baseline or complete its checks. No credentials were printed.");
        process.exitCode = 1;
    }
}
