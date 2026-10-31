# CQ-0712 A091 — connected journey seam (Cursor composer-2.5)

**Authority:** Rob via Constructa CTO 31 Oct 06:12 (`rob0612-actual-directions-20261031.json`, SHA256 `9b8c357ab4293fd9b7d41cf7ef873e3907e55732e3a34ccc13cf41ffff1689ba`).  
**Base source:** `7900d5ef8e010d4935f510bddd5f47937641e8ff` (branch `cq/cq-0712-a091-connected-flow`, clean tree at review).  
**Session:** 31 Oct 2026 ~07:04 UAE.  
**Outcome:** **NO_PRODUCT_DELTA** — no minimal source repair justified; remaining gap is held hosted/human boundaries, not an uncovered wired transition at current base.

## First-line result

**PASS** — Deliverable satisfied by precise blocker report (no invented patch, no duplicated fixture).

## Scope (inspection only)

Read and cross-checked:

| Artifact | Role |
| --- | --- |
| `e2e/local-phase1/journey.spec.ts` | Joined company → draft PDF (seeded estimate); A059 weekend + refused programme save → proposal |
| `e2e/local-phase1/journey-entry.tsx` | Joined fixture wiring (mock transport boundaries explicit) |
| `e2e/local-phase1/unseeded-journey.spec.ts` | Same chain with first price line + refused-then-ack MOCK save |
| `e2e/local-phase1/pricing-payments-journey.spec.ts` | Payment stages refused/ack → programme → proposal/PDF |
| `e2e/local-phase1/route-closure.test.ts` | Static route closure for post-setup readiness + new job |
| `e2e/support/legacy-hosted-phase1-guard.ts` | Fail-closed hold (must remain exact) |

Not run: `e2e/phase1-journey.spec.ts` (legacy hosted writes). Not modified: guard, runner config, other worktrees.

## Connected transitions already covered at 7900 (no duplicate work)

| Transition | Evidence (local, source-connected) |
| --- | --- |
| Company setup → readiness → new job | `journey.spec.ts` happy path; setup refusal in `company-setup.spec.ts` (leg, not re-added to joined spec) |
| New job create → brief → pricing | `journey.spec.ts`, `first-job.spec.ts` (create refusal + retry) |
| Brief save → pricing | `brief-price.spec.ts` (brief save refusal + retry); joined specs assert `briefSaves` on success path |
| Pricing → programme → proposal → draft PDF | `journey.spec.ts`, `unseeded-journey.spec.ts`, `pricing-payments-journey.spec.ts` |
| Programme save refusal / retry → proposal document | `journey.spec.ts` (A059 weekend pattern), `programme-pdf.spec.ts` |
| Price line save refusal / retry (unseeded) | `unseeded-journey.spec.ts` |
| Payment stages refusal / ack → proposal | `pricing-payments-journey.spec.ts` |
| Programme inclusion omit → document/PDF | `programme-pdf.spec.ts` (not re-cloned into `journey.spec.ts`) |

`journey-entry.tsx` already exposes `setupNextSave` and `programmeNextSave`; specs exercise programme refusal on the joined fixture. Adding parallel tests for setup/brief refusal on the same bundle would duplicate `company-setup` / `brief-price` / `first-job` without a distinct wired defect.

## Product delta

**None.** No change to `src/` or local-phase1 fixtures this session.

## Named blockers (what still prevents “full marketing-to-proposal” A091 acceptance)

1. **Legacy hosted write journey — NOT_RUN (source hold):** `e2e/support/legacy-hosted-phase1-guard.ts` → `isLegacyHostedPhase1WriteHeld(): true`. Signup, real DB/customer writes, publication, Send, and automated legal acceptance remain intentionally excluded; bounded proof stays on `playwright.local-*` configs only.
2. **Preview / signup policy:** Preview HOLD and real signup OFF (per AGENTS.md / inbox); no authenticated hosted journey or customer-data proof in this slice.
3. **Human / operator gates (register + Rob 06:12):** Full acceptance still needs authorised human steps where required (e.g. legal acceptance, signup/email flows called out in A091 register delivery text); not replaceable by local MOCK fixtures.

Worker/SW remains source-only; not deployed. No browser login, new tabs, SQL, settings, keys, or production actions attempted.

## Commands attempted (this session)

| Command | Result |
| --- | --- |
| `git rev-parse HEAD` | `7900d5ef8e010d4935f510bddd5f47937641e8ff` |
| `node …/npx vitest run e2e/local-phase1/route-closure.test.ts` | **Failed** — EPERM writing `constructa-fresh-20261025/node_modules/.vite-temp/…` (sandbox); worktree has **no** local `node_modules` |
| `node e2e/local-phase1/build-brief-price.mjs … journey` | **Not completed** — sandbox blocked temp dir under queue TMPDIR; `required_permissions: all` retry **rejected** |
| Playwright `journey.spec.ts` | **NOT_RUN** — bundle build not executed (same environment limits) |

**Limitation (exact):** Independent re-run of local Playwright journey + vitest route-closure requires writable parent `node_modules` (or `node_modules` in this worktree) and non-sandboxed temp output; not available in this Cursor sandbox when elevated permission was denied. Prior green semantics on these specs at base are taken from existing committed tests and structure review, not a fresh runner receipt this session.

## Source hashes

| Item | SHA |
| --- | --- |
| Review base commit | `7900d5ef8e010d4935f510bddd5f47937641e8ff` |
| Working tree after review | Clean (no amendments) |

## Changelog (Cursor)

| File | Lines | Change | Intent |
| --- | --- | --- | --- |
| `docs/reviews/cq-0712-a091-connected-flow.md` | (new) | A091 seam review record | Document NO_PRODUCT_DELTA, coverage map, blockers, and execution limits for runner handoff; leave product source uncommitted |
