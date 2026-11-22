#!/usr/bin/env node
/**
 * Seeds two disposable synthetic users for D81 profile isolation (local loopback only).
 * Requires loopback API URL and service role key from `supabase status -o env`.
 */
import { createClient } from "@supabase/supabase-js";
import { assertSupabaseTarget } from "../../src/lib/deployment/supabase-target.mjs";

const USERS = [
    {
        email: "d81-profile-alpha@example.com",
        password: "D81-Alpha-Ephemeral-Replay-Only",
    },
    {
        email: "d81-profile-beta@example.com",
        password: "D81-Beta-Ephemeral-Replay-Only",
    },
];
const EPHEMERAL_REPLAY_PROJECT_REF = "ephemeralreplay00001";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

function fail(message) {
    console.error(`D81 SEED FAILURE: ${message}`);
    process.exit(1);
}

const api = new URL(url);
if (api.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(api.hostname) || api.port !== "54321" || api.username || api.password || api.pathname !== "/" || api.search || api.hash) {
    fail("refusing to seed: API must be the exact local ephemeral origin.");
}
if (process.env.E2E_D38_BACKEND !== "ephemeral" || process.env.CONSTRUCTA_DEPLOY_CONTEXT !== "e2e-replay" || process.env.E2E_SUPABASE_PROJECT_REF !== EPHEMERAL_REPLAY_PROJECT_REF || process.env.CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF !== EPHEMERAL_REPLAY_PROJECT_REF) {
    fail("refusing to seed: the declared context/reference is not disposable replay.");
}
assertSupabaseTarget(process.env);
if (process.env.E2E_D81_PROFILE_ISOLATION !== "1") {
    fail("refusing to seed: E2E_D81_PROFILE_ISOLATION is not set.");
}

const client = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const list = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
if (list.error) fail(list.error.message);

for (const user of USERS) {
    const existing = (list.data.users ?? []).find((row) => row.email?.toLowerCase() === user.email);
    if (existing) continue;
    const created = await client.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
    });
    if (created.error) fail(created.error.message);
}

console.log(`D81 seed: two profile-isolation identities ready on loopback (project ${EPHEMERAL_REPLAY_PROJECT_REF}).`);
