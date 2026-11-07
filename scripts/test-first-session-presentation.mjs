import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { welcomeSteps, orderWelcomeSteps } from "../src/lib/first-session-welcome.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = "c87aacaa240d2be793fed0a24358cdf6498cdf6a";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const git = (...args) => execFileSync("git", args, { cwd: root, timeout: 5000, encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
const original = (path) => git("show", `${base}:${path}`);

test("candidate retains its exact parent baseline", () => {
    assert.equal(git("rev-parse", "HEAD").trim(), base);
    assert.equal(git("rev-parse", "HEAD^{tree}").trim(), "c32e42ebdfb3c28dc2d159659cec4afe6cb2d6f5");
});

test("tracked edits are confined to the four presentation files", () => {
    assert.deepEqual(git("diff", "--name-only", base).trim().split("\n").sort(), [
        "src/app/dashboard/settings/profile/readiness/readiness-client.tsx",
        "src/app/login/page.tsx",
        "src/app/onboarding/onboarding-client.tsx",
        "src/app/onboarding/onboarding-frame.tsx",
    ]);
});

test("sign-in, sign-up, validation, callback and landing logic are unchanged", () => {
    const path = "src/app/login/page.tsx";
    const controller = (source) => source.slice(source.indexOf("export default function LoginPage"), source.indexOf('    const isSignUp = mode === "signup";'));
    assert.equal(controller(read(path)), controller(original(path)));
});

test("setup controller, duplicate-submit guard, saves and navigation are unchanged", () => {
    const path = "src/app/onboarding/onboarding-client.tsx";
    const controller = (source) => source.slice(source.indexOf("export default function OnboardingClient"), source.indexOf("    return ("));
    assert.equal(controller(read(path)), controller(original(path)));
});

test("the save actions, loaders, fields, permissions and dependencies are unchanged", () => {
    for (const path of [
        "src/app/onboarding/actions.ts",
        "src/app/onboarding/page.tsx",
        "src/app/onboarding/layout.tsx",
        "src/app/dashboard/settings/profile/readiness/page.tsx",
        "src/lib/first-session.ts",
        "src/lib/company-readiness.ts",
        "src/lib/launch-profile.ts",
        "src/lib/theme-context.tsx",
        "src/app/auth/callback/route.ts",
        "src/app/auth/signout/route.ts",
        "package.json",
        "package-lock.json",
        "tsconfig.json",
    ]) assert.equal(read(path), original(path), path);
});

test("each welcome tile leads to an existing permitted route", () => {
    const steps = welcomeSteps(false);
    assert.deepEqual(steps.map((step) => step.id), ["company", "experience", "pricing", "proposal"]);
    assert.deepEqual(new Set(steps.map((step) => step.href)), new Set([
        "/dashboard/settings/profile", "/dashboard/settings/case-studies", "/dashboard/projects/new",
    ]));
    assert.ok(steps.every((step) => step.action && step.detail && step.title));
});

test("returning contractors choose a project rather than a guessed project id", () => {
    for (const step of welcomeSteps(true).filter((step) => step.id === "pricing" || step.id === "proposal")) {
        assert.equal(step.href, "/dashboard/projects");
        assert.equal(step.action, "Choose a project");
        assert.doesNotMatch(step.href, /projectId|costs|proposal/);
    }
});

for (const focus of [null, "company", "experience", "pricing", "proposal"]) {
    test(`focus ${focus ?? "unset"} only changes presentation, keeping all four routes`, () => {
        const steps = welcomeSteps(false);
        const before = JSON.stringify(steps);
        const ordered = orderWelcomeSteps(steps, focus);
        assert.equal(ordered.length, 4);
        assert.deepEqual(new Set(ordered.map((step) => step.id)), new Set(steps.map((step) => step.id)));
        if (focus) assert.equal(ordered[0].id, focus);
        assert.equal(JSON.stringify(steps), before);
    });
}

test("welcome choices perform no reads, writes, persistence or provider activation", () => {
    const source = read("src/components/welcome-next-steps.tsx");
    assert.doesNotMatch(source, /fetch\(|localStorage|sessionStorage|createClient|save[A-Z]|signInWithOAuth|\.auth\.|\.from\(/);
    assert.match(source, /type="button" aria-pressed=/);
    assert.match(source, /Optional; nothing is saved by choosing/);
    assert.match(source, /each proposal still has its own checks/i);
});

test("saved readiness rows remain intact and job creation stays available", () => {
    const path = "src/app/dashboard/settings/profile/readiness/readiness-client.tsx";
    const rows = (source) => source.slice(source.indexOf('            <section aria-labelledby="readiness-list-heading"'));
    assert.equal(rows(read(path)), rows(original(path)));
    assert.match(read(path), /href=\{NEW_PROJECT_PATH\}/);
    assert.doesNotMatch(read(path), /disabled|aria-disabled/);
    assert.match(read(path), /checks before sending/);
});

test("presentation retains sign out, accessible forms and responsive/reduced-motion rules", () => {
    const frame = read("src/components/first-session-frame.tsx");
    assert.match(frame, /action="\/auth\/signout" method="post"/);
    assert.match(frame, /signOut \? <span className=\{ui.brand\}>/);
    const login = read("src/app/login/page.tsx");
    assert.match(login, /role="alert"/);
    assert.match(login, /<AccountConfirmation message=\{successMessage\}/);
    assert.match(read("src/components/account-confirmation.tsx"), /role="status"/);
    assert.match(login, /autoComplete="email"/);
    assert.match(login, /autoComplete=\{isSignUp \? "new-password" : "current-password"\}/);
    const css = read("src/components/first-session.module.css");
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /max-width: 650px/);
    assert.match(css, /:focus-visible/);
    assert.match(css, /\.input \{[^}]*font-size: 16px/);
});

test("all scoped CSS references exist and the sticky action has no clipping parent", () => {
    const css = read("src/components/first-session.module.css");
    for (const path of [
        "src/components/first-session-frame.tsx", "src/components/welcome-next-steps.tsx",
        "src/components/account-confirmation.tsx",
        "src/app/login/page.tsx", "src/app/onboarding/onboarding-client.tsx",
        "src/app/dashboard/settings/profile/readiness/readiness-client.tsx",
    ]) {
        for (const match of read(path).matchAll(/\bui\.(\w+)/g)) {
            assert.ok(css.includes(`.${match[1]}`), `${path}: ${match[1]}`);
        }
    }
    assert.doesNotMatch(css.match(/\.panel \{[^}]*\}/)[0], /overflow/);
});

test("confirmation focus is a presentation-only effect on the next action", () => {
    const source = read("src/components/account-confirmation.tsx");
    assert.match(source, /useRef<HTMLButtonElement>\(null\)/);
    assert.match(source, /nextAction\.current\?\.focus\(\)/);
    assert.match(source, /ref=\{nextAction\} type="button" onClick=\{returnToSignIn\}/);
    assert.match(source, /requestAnimationFrame\(\(\) => document\.getElementById\("email"\)\?\.focus\(\)\)/);
    assert.doesNotMatch(source, /fetch\(|localStorage|createClient|\.auth\.|\.from\(/);
});
