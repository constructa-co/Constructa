# D81 profile isolation (CON-012)

**Branch:** `codex/d81-profile-isolation-20261121`  
**Verifier:** disposable ephemeral replay CI (`d38-con-browser-replay.yml`), not local run.

## Intent

Replace mock-only profile isolation qualification with a bounded Playwright journey on loopback Supabase: two seeded `example.com` identities, real UI saves, independent DB reads, and a client JWT RLS probe.

## Limitations

- Not run in this session (CI-only lane).
- Does not modify product behaviour, signup policy (except existing D78 archived fixture), or hosted settings.
- Passwords live in repo as labelled disposable replay constants (same pattern as D38 seed); never logged from browser responses in artifacts beyond standard Playwright traces on failure.
Independent Sonnet review PASS (bounded source only); R1 fixed the recorder outcome flag and recorded actual blocked hosts, rather than inferring success from propagating Playwright errors. Original CI and disposable browser results remain pending.
