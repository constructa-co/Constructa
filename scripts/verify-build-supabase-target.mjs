#!/usr/bin/env node
// Runs after `next build`. Reads the compiled output and proves which
// Supabase project it is bound to. In a preview or E2E context a build that
// names production, names nothing, or names any project other than the
// declared disposable one fails here, before it can be deployed or started.
//
//   node scripts/verify-build-supabase-target.mjs [--dir .next]
//
// It prints project references only. No key is read from the build or shown.
import { existsSync } from "node:fs";
import path from "node:path";
import {
    SupabaseTargetError,
    checkCompiledTarget,
    checkSupabaseTarget,
    resolveDeployContext,
    supabaseRefsInBuild,
} from "../src/lib/deployment/supabase-target.mjs";

const dirFlag = process.argv.indexOf("--dir");
const buildDir = path.resolve(dirFlag >= 0 && process.argv[dirFlag + 1] ? process.argv[dirFlag + 1] : ".next");

function fail(stage, problems) {
    console.error(new SupabaseTargetError(stage, problems).message);
    process.exit(1);
}

const configuration = checkSupabaseTarget(process.env);
console.log(configuration.summary);
if (!configuration.ok) fail("configuration", configuration.problems);

const { guarded } = resolveDeployContext(process.env);

if (!existsSync(buildDir)) {
    if (guarded) fail("compiled build", [`There is no build at ${buildDir} to check.`]);
    console.log(`Compiled Supabase target: no build at ${buildDir}. Nothing to check.`);
    process.exit(0);
}

let refs;
try {
    refs = supabaseRefsInBuild(buildDir);
} catch (error) {
    // A preview whose build cannot be read cannot be proved, so it fails.
    // Production and ordinary builds are only reported on, never stopped.
    const reason = error instanceof Error && "code" in error ? String(error.code) : "unreadable";
    if (guarded) fail("compiled build", [`The build at ${buildDir} could not be read (${reason}), so its backend cannot be proved.`]);
    console.log(`Compiled Supabase target: the build could not be read (${reason}). Not a preview or E2E context, so nothing is enforced.`);
    process.exit(0);
}

const compiled = checkCompiledTarget(process.env, refs);
console.log(compiled.summary);
if (!compiled.ok) fail("compiled build", compiled.problems);
