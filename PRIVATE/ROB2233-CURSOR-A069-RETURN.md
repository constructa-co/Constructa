# ROB2233 — Cursor Composer 2.5 (fast=false) — A069 closing-editor journey

**Route:** Authorized existing Cursor CLI on worktree only.  
**Window:** Overnight slice headed 22:30 UAE, finish target 03:00 UAE 31 Oct.  
**Status:** Test-only delta delivered; **no product source change**; **uncommitted**; **no push**; **not Complete**.

## Branch / base

| Item | Value |
| --- | --- |
| Worktree | `/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/a069-prefill` |
| Branch | `cq/a069-prefill` |
| Base commit | `4c66969e92372d26d7136c1c5ce34f40512891c1` (`feat: package bounded DeepSeek QA assistant configuration`) |
| Patch | `PRIVATE/ROB2233-CURSOR-A069-RETURN.patch` |
| Patch SHA256 | `2ec14132a9821c36ec07e6b647882ef0961f995fbf752255719cf555c2e80c3e` |

## Paths touched (hashes at return)

| Path | SHA256 |
| --- | --- |
| `src/app/dashboard/projects/proposal/a069-closing-editor-journey.test.tsx` | `d3b6f9a7aefb1124b0461ae023b7d460b58ddf2113cf69edf020fca5758074b8` |
| `PRIVATE/vitest.a069.mts` | `c87ea0e86cd1389a0442948a4a01e805eb15b4d5e29276b54ff5249c449c5e37` |
| `docs/delivery/2026-10-28/changelog.md` | (ROB2233 entry appended; see patch) |

## Inspection summary (current real sources)

### Create action

- `src/app/dashboard/projects/new/actions.ts` — `createBlankProjectAction` calls RPC `create_phase1_project_graph` only; **no closing or md_message in client payload** (also locked in `new-job-closing.test.ts`).

### Accepted closing SQL (SOURCE file only; not applied here)

- `supabase/migrations/20261028183000_new_job_closing_prefill.sql` — additive `CREATE OR REPLACE` on `create_phase1_project_graph`: read `profiles.md_message` after idempotent retry return, blank/length guards, insert `closing_statement`. Static contract tests in `src/lib/new-job-closing.test.ts` (19+ cases including mock create → draft projection).

### ReviewSendClient closing UI / handlers

- `src/app/dashboard/projects/proposal/review-send-client.tsx` — `draftFromProject` maps `closing_statement` verbatim into draft; company-message control is explicit only (`applyCompanyClosingMessage`); Save uses `saveDraft` → `buildProposalPayload` (**trim on save** for wording fields, existing behaviour).
- `src/app/dashboard/projects/proposal/company-closing-entry.test.tsx` — real component tree with mocked server hooks; strong coverage for **null/empty** closing and explicit copy, **not** for RPC-persisted prefill after new-job create.

### Gap closed by this return

Previous `new-job-closing.test.ts` block explicitly labelled **“(not ReviewSendClient UI / not Postgres)”**. This return adds **6 tests** wiring **`createBlankProjectAction` → fake RPC row → `ReviewSendClient`** with the same reducer/store mocks as `company-closing-entry.test.tsx`.

## Product delta

**NO_PRODUCT_DELTA** — no changes under `src/` except the new test file; no migration duplicate; no SQL apply; no grant work (Claude **`cq/a059-close`** owns additive grant migration).

## Test delta

**YES_TEST_DELTA** — `a069-closing-editor-journey.test.tsx`:

1. RPC-persisted closing shown verbatim in `#wording-closing`; starts **saved**; “Use company message” disabled when saved text present.
2. Leading spaces / interior blank lines preserved in **draft field**; Save payload uses **trim-on-save** (existing `buildProposalPayload`).
3. After explicit clear + save, `closing_statement` null on row → reopen does **not** refill from profile.
4. Profile `md_message` change after create does **not** rewrite persisted job closing in UI.
5. Refused save keeps draft + `data-review-save-error`; successful retry reaches **saved** status.
6. Blank-eligible profile message → null `closing_statement`; empty field; no copy control when profile trim empty.

## Focused commands (actual)

**Vitest resource note:** Worktree has no `node_modules`. Run uses ROOT Vitest with a real directory `node_modules/.vite-temp` under the worktree (not a symlink to ROOT) so Vite can compile the config without writing outside the worktree sandbox.

```bash
mkdir -p /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/a069-prefill/node_modules/.vite-temp
cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/a069-prefill
node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/vitest/vitest.mjs run \
  --config PRIVATE/vitest.a069.mts
```

**Exit:** `0`  
**Result:** 3 files, **74** tests passed (6 new + existing `company-closing-entry` + `new-job-closing` in config include list).  
**Vitest:** v5.0.2; duration ~572ms (representative run 22:33 UAE 30 Oct 2026).

**Typecheck (worktree tsconfig, no incremental write):**

```bash
cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/a069-prefill
node /Users/robertsmith/dev/constructa-fresh-20261025/node_modules/typescript/bin/tsc \
  --noEmit --incremental false -p tsconfig.json
```

**Exit:** `0`

**Not run (per task):** full suite, Next build, ESLint sweep, browser QA, SQL/DB, push/commit.

## Findings

- **No wired product bug demonstrated** in the create → editor path under test doubles; behaviour matches existing trim-on-save vs raw RPC/draft copy split.
- **Runtime QA remains blocked** on parent proof: `create_phase1_project_graph` fails **`42501`** on `valid_programme_working_pattern` for the exact060 account (creation + one in-request retry). That is **not** evidence that closing-copy source is missing; **narrow QA function grant pending Rob**; parent owns browser/session.
- **Do not** duplicate Claude’s additive grant migration on `cq/a059-close` or apply SQL from this worktree.

## Remaining owner QA (after grant)

1. Rob / parent: confirm one narrow grant for `valid_programme_working_pattern` (pending).
2. Parent browser session: new job with saved Personal Message → Proposal Review & Send → closing field shows **exact** profile text (including leading spaces) → Save → reload → still job-specific; profile edit does not rewrite job; explicit blank save does not auto-refill.
3. Independent Claude grade of this patch before commit/push (per inbox).

## Authority boundaries observed

- No `~/.codex/sessions`, log-archive, foreign programmes, main/PR/deploy, env/key reads, install/npx download, Cloud POST400 retry, or self-Complete.
