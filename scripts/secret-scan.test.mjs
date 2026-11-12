import assert from "node:assert/strict";
import { test } from "node:test";
import { hasTrackedMcp, scanRange, verifyHistory } from "./secret-scan.mjs";

const base = "a".repeat(40), head = "b".repeat(40), zero = "0".repeat(40);

test("push scans all new commits, not only the final diff", () => {
    assert.equal(scanRange("push", { before: base, after: head }), `${base}..${head}`);
});
test("PR uses exact base/head identifiers without executing payload text", () => {
    assert.equal(scanRange("pull_request", { pull_request: { base: { sha: base }, head: { sha: head } } }), `${base}..${head}`);
});
test("new branch uses its merge base with the repository default branch", () => {
    assert.equal(scanRange("push", { before: zero, after: head, repository: { default_branch: "main" } }, (a, b) => {
        assert.equal(a, head); assert.equal(b, "refs/remotes/origin/main"); return base;
    }), `${base}..${head}`);
});
for (const value of ["main", "--all", "a".repeat(39), "a".repeat(41), zero, "$(echo nope)", undefined]) {
    test(`invalid SHA fails closed: ${String(value)}`, () => {
        assert.throws(() => scanRange("push", { before: value, after: head }));
    });
}
test("unknown, deleted, missing-parent and missing-merge-base cases fail closed", () => {
    assert.throws(() => scanRange("workflow_dispatch", {}));
    assert.throws(() => scanRange("push", { before: base, after: head, deleted: true }));
    assert.throws(() => scanRange("pull_request", {}));
    assert.throws(() => scanRange("push", { before: zero, after: head, repository: { default_branch: "main" } }, () => ""));
});
test("unsafe default-branch text is never passed to Git", () => {
    for (const branch of ["a..b", "main;echo nope", "", undefined]) {
        assert.throws(() => scanRange("push", { before: zero, after: head, repository: { default_branch: branch } }, () => assert.fail("Must not call Git")));
    }
});
test("root and nested MCP configs are refused without banning safe examples", () => {
    assert.equal(hasTrackedMcp([".mcp.json"]), true);
    assert.equal(hasTrackedMcp(["tools/.mcp.json"]), true);
    assert.equal(hasTrackedMcp([".mcp.example.json", ".gitleaks.toml"]), false);
});
test("Git history errors and unavailable executables cannot become a scanner pass", () => {
    assert.throws(() => verifyHistory(`${base}..${head}`, () => ({ status: 128 })));
    assert.throws(() => verifyHistory(`${base}..${head}`, () => ({ status: null, error: Error("timeout") })));
});
test("independent history read discards patch output and disables external helpers", () => {
    verifyHistory(`${base}..${head}`, (command, args, options) => {
        assert.equal(command, "git");
        assert(args.includes("--no-ext-diff") && args.includes("--no-textconv"));
        assert.equal(args.at(-1), `${base}..${head}`);
        assert.deepEqual(options.stdio, ["ignore", "ignore", "pipe"]);
        return { status: 0 };
    });
});
