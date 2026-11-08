# Claude batch 2 handoff: A055/A063 context, A023 consent, A038 photo decision (8 Nov 2026)

Branch `claude/offline-evidence-20261108-1020`. Source and offline reading only. Nothing here is human,
hosted, preview, QA-database, real-email or paid-AI acceptance. No SQL run, no migration applied, no env or
config read, no register or dashboard edit, no provider call. Appends to `claude-offline-evidence.md` and
`claude-substantive-handoff.md`; replaces neither.

## 0. Run status and inbox status (read this first)

- **Tests: NOT RUN.** I tried one single-worker run of the new context file with the shared install
  (`/Users/robertsmith/dev/constructa-fresh-20261025/node_modules/.bin/vitest run --root . --pool=forks
  --poolOptions.forks.singleFork src/lib/job-assistant-context-coverage.test.ts`). The session permission
  layer answered "This command requires approval" and the session is non-interactive, so it did not run. I
  stopped there: no symlink, copy, `npx` or alternative path. Both new test files are statically traced
  against source only (sections 2.5 and 3.4). A trace is not a run.
- **ACK line: NOT appended.** The first action in the brief was an append to
  `/Users/robertsmith/cos-inbox/constructa.md`. That path is outside the worktree and the write needed
  approval, which could not be given. I did not route around it with another tool. The line I would have
  written: `ACK Claude Code (Sonnet 5.5) branch claude/offline-evidence-20261108-1020: batch2 offline scope
  A055/A063 assistant context, A023 consent, A038 photo-trim decision note; no SQL/build/paid AI`. The same
  applies to the closing result line (section 6): it is here, not in the inbox. Someone with access needs to
  paste both.
- Disk was 18 GiB free at start (floor 16).

## 1. Summary

| Item | Finding | Status of claim |
|---|---|---|
| A055/A063 | Each feature sends a narrow, separate slice. Planning gets no brief or trades; pricing gets no trades or milestones; nothing carries procurement. Five gaps recorded, none fixed. | Read from source; 16 offline tests written, unrun |
| A023 | Sign-up records user, document, revision, DB time only. One real gap: a second approved revision cannot be recorded next to the first. | Read from source/migration; 5 offline tests written, unrun |
| A038 | One real parity bug (TS accepts, SQL refuses) on non-ASCII edge whitespace; credentials difference is the safe direction. Recommended alignment in section 4. | Read from source and SQL; nothing executed |

## 2. A055 / A063: do the actual job details reach the assistant?

Method: read the three request paths (`brief-request.ts`, `pricing-request.ts`, `planning-request.ts`), the
three context builders (`brief-conversation.ts`, `pricing-review.ts`, `planning-conversation.ts`), the prompts
(`job-assistant-prompts.ts`) and the transport (`openai-job-assistant-transport.ts`). In every path the browser
sends only a message, a transcript and a revision fingerprint; the server rebuilds the context from the saved
rows. The transport sends `Saved job data (JSON):` plus the context as one user message, after the system
rules, then the transcript. So "what reaches the model" is exactly the context object below.

### 2.1 What each feature sends

| Detail | Brief (`a055-brief-v1`) | Pricing (`a055-pricing-v1`) | Planning (`a063-planning-v1`) |
|---|---|---|---|
| Brief work text | yes (site/access/assumption notes stripped) | yes (same stripping) | **no** |
| Chosen trades (`brief_trade_sections`) | yes | **no** | **no** |
| Client type | yes | no | no |
| Client name | no (documented as withheld) | no | **yes** (`job.client`) |
| Job name | no (id only) | no | yes |
| Estimate line descriptions and trade sections | no | yes | no |
| Quantities, rates, totals, margins | no | no (deliberately; `revision` stays internal) | no |
| Programme stages: name, dates, duration | no | no | yes |
| Start/finish/total duration | no | no | yes |
| Payment milestones (`payment_schedule_milestones`) | no | no | **no** |
| Procurement, supplier, lead-time data | no such saved data | no such saved data | no such saved data |
| Address, postcode, value, dates | no | no | start date only |

### 2.2 Gaps (recorded, not fixed; no product source changed)

1. **G1. Planning cannot see the actual work.** The programme conversation gets stage names and dates only. Its
   prompt asks what "must be ordered ahead", but the assistant has no scope text or trades to ground that in, so
   a procurement suggestion rests on stage names and whatever the contractor types. The guard that turns an
   un-timed procurement suggestion into a question (`reviewPlanningReply`) keeps this honest, but it makes
   procurement output thin. Fix would be to add the saved brief work/trades to the planning context, which
   changes the revision fingerprint, the page-side builder, the transport size check and the privacy statement.
   That is a product decision for Rob/Cursor, not an edit for this batch.
2. **G2. "Procurement" has no saved data behind it anywhere.** The projects row and programme phases carry no
   supplier, order-by or lead-time field. In migrations the only matches for `procure|milestone` are a header
   on `20260409400000_sprint50_materials.sql` ("Material Rates & Procurement", not inspected further) and the
   `payment_schedule_milestones` table in `20260410100000_sprint54_accounting_reconciliation.sql`. So
   "milestones" in the planning prompt means programme stages, and "procurement" is conversation-only. Honest
   outcome today: lead times can only come from the contractor's own words, and the review drops any the
   contractor did not say.
3. **G3. Payment milestones are not in any context.** Billing milestones exist as a table but reach none of the
   three assistants. Mention only; may be intended.
4. **G4. Pricing does not receive the Brief's trades.** Only trade sections on already-created estimate lines
   reach it. A job with a brief and no estimate lines gives pricing the work text and nothing else.
5. **G5. Client name is sent for planning but withheld for Brief.** `brief-conversation.ts` states the client's
   name is not sent; `planning-conversation.ts` sends `job.client`, and the existing planning test asserts it
   ("Ms Patel"). Both are deliberate in their own tests, but the privacy line differs by feature. Whoever writes
   the user-facing "what is sent" wording should state it per feature.

Two things that work as intended and are now pinned by tests: site/access notes never reach Brief or pricing;
no feature sends rates, totals, margins, address, postcode or rough value.

### 2.3 What was not done (as instructed)

No paid test was requested or performed. No provider, key, ledger or Supabase call. Production, QA and every
`APPROVED_GENERATION` setting are untouched; all three features stay OFF.

### 2.4 Added test file (offline, no provider)

`src/lib/job-assistant-context-coverage.test.ts`: 16 cases across three `describe` blocks. It imports only
non-`server-only` modules (`brief-conversation`, `planning-conversation`, `pricing-review`, `guided-brief`).

- Brief (5): exact key set; work/client type/trades present; site notes stripped; client name, address,
  postcode, value, date absent even if the row holds them; no milestone/procurement words; reviewer accepts a
  quoted range, drops money and an unsourced date.
- Pricing (4): exact key set; no quantities/rates/totals/margins/revision/site notes; trades absent (G4);
  no milestone/procurement.
- Planning (7): exact key set and stage shape; client name present while Brief omits it (G5); no work text or
  trades (G1); no procurement/lead data (G2); un-timed procurement becomes a question; an invented "6 weeks"
  is dropped but accepted once the contractor said it; no saved programme gives empty stages.

### 2.5 Static trace (not a run)

Traced each assertion against `briefContextFromProject`, `pricingModelData`, `buildPlanningContext`,
`reviewBriefReply`, `reviewPlanningReply`, `splitScope` and the regexes in `planning-conversation.ts`. One
mistake was caught and fixed before commit: a "no `work`" substring check would have matched "Groundworks".
Residual risk before first run: the exact `duration` string produced for the fixture is not asserted, and the
"6 weeks" case assumes the fixture's own duration labels do not contain that phrase (they are days/weeks of
10 and 5 working days plus a 14-day offset, so I expect not). A failing first run should be read as a fixture
or assumption problem before it is read as a product problem.

## 3. A023: platform terms consent

### 3.1 What a sign-up records today (source)

Flow: login page signup mode shows a required, unchecked checkbox labelled "I accept Constructa's platform
terms of service." with a separate new-tab link to `/terms-of-service`. Submit calls `platformSignupAction`
with `acceptance` and `PLATFORM_TERMS_CURRENT_REVISION`. Order in the action: source gate, input shape,
`acceptance === true`, recognised revision, then `signUp`. With a session the recorder inserts; without one
(email confirmation) it returns `confirmation-required` and records nothing, and the confirmation email
redirects through `/auth/callback` to `/auth/platform-terms`, where the completion action calls the same
recorder.

Row written (`platform_terms_acceptances`, migration `20261024122500`, source file, not verified as applied by
me): `id` (DB default), `user_id` (server session only), `terms_document` (`constructa-platform-terms-of-service`),
`accepted_revision` (`platform-tos-2026-03`), `accepted_at` (DB `now()`). Client grants: SELECT own rows; INSERT
on three columns only; no UPDATE/DELETE; no service-role grant.

**Not recorded:** the wording or a hash of what was shown, IP address, user agent, locale, whether acceptance
came from sign-up or the completion page, or any marketing/AI-processing consent. The checkbox does not show
the revision identifier to the user.

### 3.2 What the visible terms say

`src/app/terms-of-service/page.tsx` is four short paragraphs, "Last updated: March 2026." It says nothing about
personal data, AI processing of job text, anonymised benchmark aggregation, retention, liability or governing
law. `CLAUDE.md` already records that a data-aggregation consent clause is required before aggregation
launches. There is **no approved legal wording** in the product; the revision id is a technical label, as
`platform-terms.ts` itself says.

### 3.3 What approved wording and a new migration would need

Needs Rob (and legal, if used) before any engineering:
1. The approved text, and a decision on whether AI processing / benchmark aggregation are in the one terms
   document or a separate privacy notice with its own checkbox.
2. Whether existing users must re-accept (the completion module currently says no retroactive acceptance).

Engineering, once approved:
1. New revision constant, added to `PLATFORM_TERMS_RECOGNIZED_REVISIONS` and made current in `platform-terms.ts`.
2. **Widen uniqueness.** The migration has `UNIQUE (user_id, terms_document)`. A user who already accepted
   `platform-tos-2026-03` hits `23505` on a new revision, and the recorder reports `already-recorded` and
   returns the revision the caller *submitted*, not the stored one. Change the constraint to include
   `accepted_revision` (or add a supersede step) and make "already recorded" mean the same revision only.
3. Extend the revision CHECK list; the new migration must also keep the old value or existing rows fail.
4. Update the page text and date; consider showing the revision in the checkbox label.
5. Decide whether to capture a wording hash and source (`signup` vs `completion`) in the same migration, since
   adding columns later needs another grant change (INSERT is column-narrow by design).
6. Since the March 2026 migration is source only and, per the 8 Nov handoff, not applied to QA, the cheaper
   path is to amend it before first apply; if it has been applied anywhere, write a new migration instead.
   I have not checked any database, so I cannot say which applies.

### 3.4 Added test file and trace

`src/lib/platform-terms-revision-shape.test.ts` (5 cases, static text of the migration, comments stripped; not
Postgres): revision CHECK list equals `PLATFORM_TERMS_RECOGNIZED_REVISIONS` (guards the "coordinated change"
rule); document CHECK equals the document id; column list is exactly the five above with a DB-default time;
INSERT grant is the three columns and there is no UPDATE/DELETE/service-role grant; and a clearly labelled
**RECORDED GAP** case that fails when the uniqueness is widened (that failure is the signal to update it).
Traced against the SQL line by line: the lazy `CREATE TABLE ... \n);` capture ends at the table's closing
line, and constraint lines start with uppercase so the lowercase column filter excludes them. Not run.

## 4. A038: decision note on the two photo-validation differences

Files: `src/lib/case-library/photos.ts` and `supabase/migrations/20261028120000_case_library_photos.sql`
(source only, not applied). Nothing changed in either.

### 4.1 The two differences

| | TypeScript (`photoSlotsProblem` / `storedPhotoSlotsProblem`) | SQL (`case_library_photo_slot_ok`) |
|---|---|---|
| Edge whitespace | `String.prototype.trim()`: strips NBSP, U+2003, U+FEFF and others | `btrim(url, ' ')`: ASCII space only |
| Credentials in URL | refuses `https://user:pass@host/` and `http://user@localhost/` (`safeCaseStudyPhotoUrl`) | accepts any string starting `https://` or local `http://` |
| Whole-URL validity | `new URL()` must parse; `https://` alone or a host with a space is refused | prefix test only; accepts those |

### 4.2 Why they are not equally serious

The safety invariant that matters for a write is: **anything TS accepts, SQL must also accept.** Otherwise the
app thinks a row is fine and the database refuses it (or a stored-row mirror reports OK for a row the database
would refuse on its next UPDATE, which matters because the CHECKs run on every UPDATE of the row).

- **NBSP/Unicode edge whitespace breaks the invariant.** TS accepts `" https://images.example.test/a.jpg"`
  and a url that is only `" "`; SQL refuses both (the prefix test sees the NBSP, and `' ' <> ''`).
  The normal write path is protected because `normalisePhotoSlots` trims first, so only input that skips
  normalisation, or a stored-row check run on such a row, is exposed. Real but narrow.
- **Credentials and whole-URL validity go the safe way** (TS stricter than SQL). The app refuses first, so no
  app write can store one. The only exposure is a row written by another route (service role/direct SQL), which
  the SQL backstop would not stop, and which `safeCaseStudyPhotoUrl` would still refuse to render in a proposal.

### 4.3 Recommended alignment

1. **Fix the TS validators, not the SQL, for whitespace.** In `photoSlotsProblem` only, test emptiness and the
   scheme on an ASCII-space-trimmed value (`value.replace(/^ +| +$/g, "")`) instead of `.trim()`. Leave
   `normalisePhotoSlots` (Unicode trim is a kind input tidy) and `safeCaseStudyPhotoUrl` (render-side safety)
   alone. Effect: the validators become exact mirrors of SQL at the edges, the write path still tidies first,
   and NBSP-edged input is refused with `photos` rather than reaching the database. Two lines.
2. **Keep TS stricter on credentials and URL validity; do not relax it.** State the contract in a comment as
   "TS-accepted is a subset of SQL-accepted; SQL is a backstop for scheme, control characters, length and
   shape, not a URL parser". Do not add a URL parser to SQL.
3. **Optionally add one SQL line for credentials** to the still-unapplied migration so the backstop also
   refuses `scheme://userinfo@`: `AND NOT (btrim(p_slot ->> 'url', ' ') ~ '^[^/]*//[^/?#]*@')`. Only worth it if
   a non-app writer is plausible; if the migration has been applied anywhere, this becomes a new migration.
   My view: skip unless Rob wants defence in depth, because it is the safe direction.
4. **Add shared vectors** for both sides when the migration is applied (the migration header already promises
   them): ASCII-space-padded https (both OK), NBSP-padded https (both refuse after item 1), NBSP-only (both
   refuse), `https://u:p@h/` (TS refuses; SQL accepts unless item 3), bare `https://` (TS refuses; SQL accepts).
5. Separately, the UTF-16 slice in `normalisePhotoSlots` versus code-point counting in `photoSlotsProblem` is
   already guarded by `photoInputWouldBeCut`; no action.

Decision needed from Rob/integration owner: approve item 1 (recommended), and say yes or no to item 3.
No test was added for these two differences; asserting current TS behaviour would enshrine the gap, and
the right tests are the vectors in item 4 once the direction is decided.

## 5. Files and status

Added (all new, no product source, migration, register or dashboard touched):
- `src/lib/job-assistant-context-coverage.test.ts` (A055/A063, 16 cases, unrun)
- `src/lib/platform-terms-revision-shape.test.ts` (A023, 5 cases, unrun)
- `docs/delivery/2026-11-08/claude-batch2-handoff.md` (this note)

Not done: no test executed; inbox ACK/result lines not appended (section 0); no register entry; no migration;
no paid AI test; no hosted, human or real-email evidence.

## 6. Result line for the inbox (to be pasted by someone with access)

`RESULT Claude Code (Sonnet 5.5) claude/offline-evidence-20261108-1020: batch2 done offline. A055/A063 5 gaps
recorded + 16 tests written; A023 5 static tests + revision-uniqueness gap; A038 decision note (recommend
ASCII-trim TS validators). Tests NOT RUN (vitest permission-blocked). ACK/result inbox appends blocked.
See docs/delivery/2026-11-08/claude-batch2-handoff.md. No SQL/build/paid AI.`
