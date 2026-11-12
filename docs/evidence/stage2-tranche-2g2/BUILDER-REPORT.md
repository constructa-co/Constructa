# Stage 2G.2 builder report: authorised own-company website import

- Issue: https://github.com/constructa-co/Constructa/issues/90 (slice 2G.2)
- Base: `codex/stage2g1-integration` at `d8850248073ab383c22c36a0b569b1d7e25ff6fc` (PR 91, not merged)
- Branch: `claude/stage2-tranche-2g2-import`, in its own worktree `constructa-stage2-tranche-2g2`
- Commits on the base:
  1. `53c4e76ba8e84eae22fe4a9a769775da89613719` implementation
  2. `35e40c4c9aaf99259b34a73ab0801c351f975459` first report (the candidate Kimi and Codex reviewed)
  3. `299c8061729860a5b43815eab7f90a6bb5187fef` review repairs
  4. this report
- Patch, whole series from the base: `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/stage2g2-import-r2.patch`
- Local only: not pushed, no PR, nothing deployed, no hosted database touched, no live website contacted.

This report describes the code as it stands after the repair pass. Section
"Review-repair pass" maps each review finding to its fix and its test.

## What the contractor gets

From Profile, "Bring in details from your website" opens
`/dashboard/settings/profile/import`.

1. They type their website address and tick a box confirming it is their
   own business's website and that Constructa may read it. The box is never
   ticked for them, and is asked for again on every read.
2. They see what was found, grouped as company identity, services and
   contact details. Each item shows the saved value beside the found value,
   the piece of the page it came from, the page address, when the website
   was read, and until when the preview can be used.
3. Nothing is ticked. They tick the changes they want and press save. Only
   those fields change.
4. If a saved value changed after the preview, that item is not saved. It
   shows the newer value and asks again.
5. A preview more than a day old can be read but not approved from. It says
   so and offers "Check my website again".
6. If the website cannot be read or a save fails, a plain message appears,
   what they typed and ticked is kept, the button reads "Try again", and
   "Enter details by hand" goes to the existing Profile form.

## Design

### Who can write what

| Thing | Signed-in contractor (browser role) | Server, after `requireAuth` (service role) |
| --- | --- | --- |
| `company_import_drafts` | Read own rows only | Written only through the functions below |
| `company_import_attempts` (fetch budget) | No access | Written only through the functions below |
| `company_import_reserve_attempt`, `_finish_attempt`, `_save_draft`, `_approve_item` | Cannot execute | Execute, always with the authenticated contractor's id |
| `profiles` | Unchanged: own row, as before | One listed column per approval, inside `_approve_item` |

The server actions call `requireLaunchCapability("company-profile")` and
`requireAuth()` first, and only then create the service-role client. The
contractor id passed to every function comes from the verified session,
never from the request. Each function filters every statement by that id.

This is what separates an **import claim** from a **manual edit**. A
contractor may type anything into their own profile through the existing
Profile form; that is their statement and carries no source. "The website
said X at time T" and "X was approved from the website" exist only as draft
rows, which only the server can write. Nothing a contractor types can
create or alter one.

### Fetch budget

`company_import_reserve_attempt` runs before any lookup or request. It takes
a per-contractor advisory lock, so simultaneous calls are serialised; a
partial unique index also makes a second in-flight row impossible at the
schema level. It refuses when a read is in flight or when six attempts
started in the last hour, whatever became of them. Failed reads are closed
with their failure code and still count. A read that never reports back
stops blocking after two minutes and still counts. If the reservation
cannot be made, nothing is fetched.

### Draft validity

`expires_at` is set by the database to 24 hours after creation and cannot be
changed by any role. `_approve_item` refuses an expired draft. The screen
shows expired previews read-only with a recheck button.

### Approval

`company_import_approve_item` is one transaction per field. It locks the
draft row, checks owner and expiry, takes the proposed value from the saved
draft, and updates the profile column only if it still equals the value the
contractor was shown (`NULL` and empty string are distinct). It then records
the approval on the draft. If recording fails, the profile change rolls back
with it. The column name comes from a fixed list of eight. The service
stops at the first failure, reports failure, and reloads the draft so the
screen shows what the database holds.

### Fetch guard

| Rule | How |
| --- | --- |
| Public web only | `http:`/`https:`, standard port, no credentials, a real domain name. Numeric addresses in any spelling and internal names are refused before any lookup |
| DNS | Every answer must be public IPv4 or IPv6; one private answer refuses the name. The lookup is bounded by the time left |
| Rebinding | The socket is pinned to the checked address, unpooled, and the peer is compared again. The name is re-resolved and re-checked for every request |
| Redirects | Never followed by the HTTP client. Each hop is checked against robots.txt, re-resolved, re-checked and must stay on the approved website; no https-to-http |
| Time | 8 s per lookup and per request, 20 s for the import. Time left is recalculated after each lookup, before connecting |
| Volume | At most 4 pages attempted (not 4 successes), 10 requests in all including robots.txt and every redirect, 512 KB per response, 3 redirects per page |
| robots.txt | Read first through the same guard. Checked before every request, including redirect targets. 429 or 5xx stops the import |
| TLS | Certificate checked against the website's name, name sent as SNI; only the address is pinned |

Extraction is unchanged: deterministic pattern matching, no model, page
content treated as plain text.

## Review-repair pass

| Finding | Fix | Proof |
| --- | --- | --- |
| Kimi 1: budget counted successful drafts, was not atomic, and clients could delete the rows | New attempts table with no client access; atomic reservation before fetch; all attempts count; six an hour, one in flight | SQL test: six failed reads then the seventh refused; in-flight refused; eight simultaneous sessions give exactly one reservation; browser roles cannot read, write or clear the budget. `service.test.ts`: five simultaneous previews make one crawl; six failed reads exhaust the hour |
| Kimi 2: stale drafts approvable forever | 24-hour `expires_at`, enforced in `_approve_item`, immutable; recheck UI | SQL test: expired draft refused, nothing written, expiry cannot be extended. `service.test.ts` and browser spec: expired preview is read-only and rechecks |
| Kimi 3: real DNS-to-pinned adapter untested over TLS | `createNodeNetwork` with injectable resolver and trust store; test server with a certificate generated at test time | `safe-fetch.test.ts`, "createNodeNetwork over TLS": verified request with SNI equal to the name; wrong-name certificate refused; untrusted authority refused under the production trust store; wrong pinned address not reached; a name resolving to this machine refused before any handshake |
| Kimi 4: whole-profile validation inherited | Not refactored, by instruction. Recorded under "Deliberate deferrals". Manual edits and import claims separated as described above | n/a |
| Codex: clients could insert, update and delete drafts, so approval trusted forgeable rows | Browser roles hold `SELECT` only. All writes through service-role functions | SQL test: owner cannot insert a draft, rewrite `proposed` or `sourceUrl`, set `status` to applied, delete, or execute any of the four functions; another contractor and a signed-out visitor likewise; `has_table_privilege` checks |
| Codex: profile write and approval record were separate; draft update errors returned `ok: true` | One transaction per field; any failure is `ok: false` | SQL test: with the record write forced to fail, the profile is unchanged and the retry succeeds; six simultaneous approvals give one applied. `service.test.ts`: record failure, mid-run failure, refresh failure, concurrent tabs |
| Codex: remaining time computed before an unbounded DNS lookup | Lookup raced against the time left; time left recalculated before the request | `safe-fetch.test.ts`: a lookup that answers after the budget is gone leads to no request; a lookup that never answers is abandoned with no request; request timeouts shrink to the time left |
| Codex: successful pages counted, not attempts | Attempts counted; one overall request cap | `safe-fetch.test.ts`: sixty failing links cost four attempts; a site where every page redirects three times stops at ten requests |
| Codex: redirects fetched before robots was checked | robots checked before every hop | `safe-fetch.test.ts`: a redirect into a disallowed path is never requested, for the first page or a later one |
| Codex: deleted harness was not repeatable evidence | Committed spec, harness, config, npm script and CI job | `npm run e2e:import-fixture`; `e2e/import-fixture/guard.test.ts` |

## Repeatable browser evidence

`npm run e2e:import-fixture` builds the app with a test-only route, runs two
scenarios on desktop 1280x800, phone 390x844 (touch) and desktop
keyboard-only, then removes the route and the build that contained it.

- Harness sources live in `e2e/import-fixture/app/`, outside the
  application. `prepare.mjs` copies them to
  `src/app/admin-e2e-import-fixture/`, which is ignored by Git.
- `prepare.mjs` refuses unless `CONSTRUCTA_IMPORT_FIXTURE=1`, and refuses if
  a Vercel, Supabase, OpenAI or Resend variable is set.
- Every harness entry point also returns "not found" unless that flag is 1.
- A unit test fails if anything under `src/app` references test fixtures or
  the harness, or if the harness path is tracked by Git.
- The spec is `*.fixture.ts`, so the hosted Phase 1 E2E run (which matches
  `*.spec.ts`) does not pick it up: its listing is still 8 tests in 2 files.

The harness runs the real screen, real server actions and the real
`previewImport`, `applyImport` and `latestImportDraft` over an in-memory
database (`__fixtures__/fake-db.ts`, which mirrors the database functions
and refuses writes through the contractor's client) and a made-up website.
It does **not** exercise sign-in, the dashboard shell, the real page loader
or real row level security; those are covered by unit tests and the SQL
test, and need a hosted E2E once the migration is applied.

## Files

| File | Purpose |
| --- | --- |
| `src/lib/company-import/net-policy.ts`, `safe-fetch.ts`, `robots.ts` | Fetch guard |
| `src/lib/company-import/extract.ts` | Deterministic extraction |
| `src/lib/company-import/draft.ts`, `service.ts` | Draft model, preview, resume, approval |
| `src/app/dashboard/settings/profile/import/` | Screen and server actions |
| `src/app/dashboard/settings/profile/page.tsx` | Entry link |
| `supabase/migrations/20261007120000_company_import_drafts.sql` | Tables, RLS, grants, guard trigger, four server-only functions |
| `scripts/test-company-import-sql.sh` | Migration replay, forging, budget, concurrency, atomicity, expiry, isolation |
| `e2e/import-fixture/`, `playwright.import-fixture.config.ts` | Fixture browser run and its guard test |
| `package.json`, `.github/workflows/ci.yml`, `.gitignore` | Scripts, CI steps, ignored harness path |

The migration was edited in place rather than followed by a second one,
because it has not been applied to any database.

## Test results

All on commit `299c806`, 7 October 2026.

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass |
| `npx vitest run` | 57 files; 945 passed, 4 skipped, 0 failed |
| Import tests alone | 8 files, 108 passed |
| `npx eslint .` | 0 errors |
| `npx next build` (no harness present) | Pass |
| `npm run test:company-import-sql` | Pass, throwaway local PostgreSQL 14 |
| `npm run e2e:import-fixture` | 6 passed: 2 scenarios on 3 projects |
| Hosted Phase 1 E2E listing | Unchanged: 8 tests in 2 files. Not re-run; no code it covers changed |

Browser run: layout and axe WCAG 2.2 A/AA checks at seven checkpoints in the
main scenario, zero findings on all three projects; the keyboard run reached
12 controls, all with visible focus. Results are in `results-*.json`.

Screenshots (each at `-1280x800` and `-390x844`): `01-import-start`,
`02-import-website-unavailable`, `03-import-preview`,
`04-import-preview-item`, `05-import-stale-value-not-overwritten`,
`06-import-save-failed`, `07-import-selected-saved`, and
`01-import-expired-preview` from the second scenario. All data is synthetic.

## Irreducible design choices, for the reviewers

1. **Service role for writes.** A function the `authenticated` role can
   execute can be called from a browser with any arguments, so it cannot
   vouch for provenance. The only principal the browser cannot be is the
   service role. Consequence: the import needs `SUPABASE_SERVICE_ROLE_KEY`
   on the server (already required for public proposals) and fails closed
   without it. The profile update inside `_approve_item` therefore bypasses
   row level security and relies on the function's own `id = p_user_id`
   filter and fixed column list.
2. **Approval is atomic per field, not per batch.** Ticking three items and
   losing the connection after the first leaves one saved and two not. The
   screen reports the failure, shows the saved one as saved, and keeps the
   other ticks for retry. A single all-or-nothing batch was not chosen
   because a stale value on one item should not block the others.
3. **robots.txt is read once for the approved website** and applied to both
   `www` and bare names and to http and https, rather than per origin.

## Deliberate deferrals

- **Profile validation.** `updateProfileAction` remains one unvalidated
  whole-form upsert. It can still write any value to any profile column the
  form names, including the eight the import suggests, and it has no stale
  check of its own. That is manual owner editing and is unchanged by this
  slice. Tightening it is a separate change.
- **Hosted migration and hosted E2E.** Not applied and not run, by
  instruction. Until the migration is applied, a preview ends in the generic
  message because the reservation fails closed.
- **Full-chain migration replay.** Run only by the CI job with the pinned
  Supabase image; locally the new migration was replayed on its own.
- **A live request.** None was made. `https` to a real host with the system
  trust store is exercised only against the local fixture server.

## Risks

- **CI job unverified.** `import-fixture-browser` was added to `ci.yml` but
  has only been run locally. It assumes Google Chrome and `openssl` on the
  runner, as the existing E2E job and standard images provide.
- **`safe-fetch.test.ts` needs `openssl`** on the path to make its test
  certificate. It fails, rather than skips, without it.
- **Hosting egress through a proxy** would make the peer-address check
  refuse every request.
- **First DNS answer only.** No fallback to another address family.
- **Sites needing JavaScript or compression** yield few suggestions.
- **Pattern matching, not parsing.** Every suggestion shows its excerpt and
  needs approval.
- **No clean-up of old drafts or attempts.** Expired drafts stay readable.
- **The fake database mirrors the SQL functions by hand.** If the SQL
  changes, the fake must change with it; the SQL test is the authority.

## Out of scope, unchanged

Logos and photos, case-study drafts, AI interview and narrative, competitor
research, terms, public microsites, marketing routes.
