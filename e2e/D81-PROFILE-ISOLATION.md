# D81 — CON-012 profile isolation (ephemeral replay)

Browser proof that two synthetic contractors on the **local disposable Supabase stack** do not share profile prefill or saves.

## Scope

- Seeded identities: `d81-profile-alpha@example.com`, `d81-profile-beta@example.com` (loopback seed only).
- Harness: `playwright.d38-ephemeral-replay.config.ts`, `readEphemeralReplayEnv`, D38 network blocking, service workers blocked.
- Exercises onboarding company setup and `/dashboard/settings/profile` (phone), then reads both profiles via service role and probes RLS with each user's JWT.

## Not in scope

- Hosted disposable QA, production Supabase, admin (CON-011), or Cloud CON-001/002 journeys.
- Signup policy changes, cleanup endpoints, email send, or publication.

## CI

Workflow `d38-con-browser-replay.yml` sets `E2E_D81_PROFILE_ISOLATION=1` so `seed-d81-profile-isolation.mjs` runs after `db reset` on loopback only.

## Status

**Draft — unverified until R1's ephemeral replay CI run completes.** This delivery is code + wiring only; it does not close P0 or claim hosted QA.