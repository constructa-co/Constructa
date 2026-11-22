#!/usr/bin/env node
/**
 * Seeds a disposable synthetic user on the local Supabase stack only.
 * Requires loopback API URL and service role key from `supabase status -o env`.
 */
import { createClient } from "@supabase/supabase-js";

const EPHEMERAL_SEED_EMAIL = "d38-ephemeral@example.com";
const EPHEMERAL_SEED_PASSWORD = "Ephemeral-D38-Replay-Only-Not-Production";
const EPHEMERAL_REPLAY_PROJECT_REF = "ephemeralreplay00001";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

function fail(message) {
    console.error(`EPHEMERAL SEED FAILURE: ${message}`);
    process.exit(1);
}

if (!url.startsWith("http://127.0.0.1:54321") && !url.startsWith("http://localhost:54321")) {
    fail("refusing to seed: API URL is not the local ephemeral stack.");
}
if (url.includes(".supabase.co")) {
    fail("refusing to seed: hosted Supabase URL.");
}
if (!serviceKey) {
    fail("SUPABASE_SERVICE_ROLE_KEY is not set.");
}

const client = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const list = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
if (list.error) fail(list.error.message);

const existing = (list.data.users ?? []).find((u) => u.email?.toLowerCase() === EPHEMERAL_SEED_EMAIL);
if (existing) {
    console.log(`Ephemeral seed: disposable auth already present (project ${EPHEMERAL_REPLAY_PROJECT_REF}).`);
    process.exit(0);
}

const created = await client.auth.admin.createUser({
    email: EPHEMERAL_SEED_EMAIL,
    password: EPHEMERAL_SEED_PASSWORD,
    email_confirm: true,
});
if (created.error) fail(created.error.message);

console.log(`Ephemeral seed: disposable auth ready on loopback (project ${EPHEMERAL_REPLAY_PROJECT_REF}).`);