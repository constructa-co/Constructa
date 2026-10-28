# ROB2225 — A114 journey verification on approved A115 pin (2026-10-28)

Independent review (Constructa only). Author **bc026** / Perplexity return **ROB2210** is the A115
source receipt; this document is the A114 verification return. **Do not merge
`ROB2210-A115-APPROVED-WON-RETURN.md` into ROOT product integration** — it stays author metadata on
the A115 branch only.

## Named refs (verified fetch)

| Ref | SHA / branch |
|-----|----------------|
| **Approved A115 pin (reviewed)** | `c2459deb56437d11b388d733bdd3fc37f53f54ec` |
| A115 branch | `codex/a115-approved-won-20261028-2210` |
| A115 parent (named, fetched) | `6a192967570df57df5efd2636d003d5723676687` |
| **This verification branch** | `codex/a114-on-approved-won-20261028` (from exact `c2459deb…`) |
| Backup integration context cited in programme | `ebf6a81e33644aa1a80682f908d2a21ce4250231` (A115 earlier partial on backup; **not** this pin) |
| A114 proposal CI parent (prior acceptance, not rerun here) | `1c02580` + extraction `3714852` per `docs/delivery/2026-10-28/handoff.md` |

Ancestry check: `6a192967570df57df5efd2636d003d5723676687` is ancestor of `c2459deb56437d11b388d733bdd3fc37f53f54ec`.

## Approved A115 policy (as implemented on pin — source review)

- **Active via stage picker or Completed→Active Reopen** → `updateStatusAction` only (operational `status`, no acceptance rewrite).
- **Mark as Won** (Trophy on **Proposal Sent** card only) → `move(..., "recordWin")` → `markAsWonAction` (`status: Active`, `proposal_status: accepted`, `proposal_accepted_at` set).
- **Client public response** (A114 ingress) remains **non-binding** acknowledgement / intent; RPC + UI tests reject treating receipt as contractual acceptance or `accepted` status from the portal.

## Actual A115 delta inspected (independent hunk review)

| File | Change (summary) |
|------|------------------|
| `src/app/dashboard/project-board.tsx` | `move(projectId, newStatus, intent?)`; `useWonMutation = intent === "recordWin"`; Trophy button passes `"recordWin"`. Stage `Select` and Reopen still `intent` default. |
| `src/app/dashboard/project-board-feedback.test.tsx` | Replaced legacy “picker Active calls won” test; added Proposal Sent→Active picker operational test. |
| `ROB2210-A115-APPROVED-WON-RETURN.md` | Author return metadata (**exclude from ROOT integration**). |

`board-actions.ts` unchanged on pin: returned-row acknowledgement guards for Won payload retained.

**Stale comment (P3 doc):** `NEXT_STAGE` comment at line 57 still says Active moves use `markAsWonAction` except Completed reopen — contradicts A115 routing (author cleanup).

## Concrete review question — Mark as Won after ordinary Active selection

**Question:** After the contractor uses the **Change stage** picker to land on **Active** (without Trophy), is there still a deliberate **Mark as Won** path without regressing to **Proposal Sent**?

**Finding (P2 UX / lifecycle gap — genuine, not invented policy):**

| Card `status` | Primary action | `markAsWonAction` reachable? |
|---------------|----------------|------------------------------|
| **Proposal Sent** | **Mark as Won** (Trophy) | **Yes** — only deliberate win control in UI |
| **Active** (including after picker from Proposal Sent or Estimating) | **Mark Complete** | **No** — no Trophy, no `recordWin` entry point |
| Recovery | **Pull Back** → Proposal Sent | User must regress stage to reach Trophy again |

Implications (observation only — **no new readiness/publication rule claimed**):

- Operational **Active** without Trophy leaves `proposal_status` / `proposal_accepted_at` unchanged (consistent with A115).
- A contractor who **picker-moves** Proposal Sent → Active **before** Trophy cannot record win in-column; **Pull Back** is the only board UI path back to Mark as Won.
- This is **separate** from A114: client acknowledgement/intent never substitutes for Trophy (covered by response ingress + wording tests).

**Not a P1 defect in A115 pin scope:** behaviour matches the **approved** split (operational Active vs explicit Won). Escalate to product parent if picker→Active should retain an in-column Won affordance.

## A114 server / client response path (synthetic mocks — not live Auth/DB)

Verified on pin using **imported handlers/components** and existing RPC-shaped fixtures (no hosted preview, no SQL apply, no real tokens):

| Path | Test file(s) | Executed this run |
|------|----------------|-------------------|
| Public `respondToProposalAction` ingress (uncertain / contract / receipts) | `src/app/proposal/[token]/response-ack.test.ts` | **PASS** (file) |
| `ResponseClient` confirmed vs unconfirmed UI | `src/app/proposal/[token]/response-ack-client.test.tsx` | **PASS** (file) |
| Transport fence / retry / recorded state | `src/app/proposal/[token]/response-transport.test.tsx` | **PASS** (file) |
| **A114-labelled files subtotal** | 3 files | **29 / 29 PASS** |

Author ROB2210 cited **26/26** on `board-actions.test.ts` (Won acknowledgement matrix); this run:

| Path | Test file | Executed this run |
|------|-----------|-------------------|
| Pipeline mutations (ordinary vs Won guards) | `src/app/dashboard/board-actions.test.ts` | **26 / 26 PASS** |
| Board `move()` routing (A115 + reopen) | `src/app/dashboard/project-board-feedback.test.tsx` | **16 / 16 PASS** (14 retained + **2 new A114-on-A115 UI seam**) |
| A115-filtered | `-t A115` | **2 / 2 PASS** |

**Not run:** full Vitest suite; ROOT `next build` / Node 24 guarded build (**NOT_RUN** — cloud agent used Node **v24.19.0** for Vitest/ESLint only); hosted E2E `phase1-journey.spec.ts`; physical device / OS keyboard; live Supabase row readback; Auth signup; public publication Send; legally binding acceptance.

## Own test-only delta (this verification branch)

| File | Lines (approx) | Intent |
|------|----------------|--------|
| `src/app/dashboard/project-board-feedback.test.tsx` | new `describe("A114 on A115: …")` (2 cases) | Lock **observed** UI: Won control only on Proposal Sent; picker→Active strands Trophy until Pull Back — documents P2 gap without changing product. |

Directed lint: ESLint on board paths — **0 errors, 5 pre-existing warnings** (`@typescript-eslint/no-explicit-any` on `project-board.tsx`).

## Executed commands (this agent, UTC ~2026-10-28T18:27Z)

```bash
export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
npx vitest run src/app/proposal/[token]/response-ack.test.ts \
  src/app/proposal/[token]/response-ack-client.test.tsx \
  src/app/proposal/[token]/response-transport.test.tsx
npx vitest run src/app/dashboard/board-actions.test.ts \
  src/app/dashboard/project-board-feedback.test.tsx
npx vitest run -t A115 src/app/dashboard/project-board-feedback.test.tsx
npx eslint src/app/dashboard/project-board.tsx \
  src/app/dashboard/project-board-feedback.test.tsx src/app/dashboard/board-actions.ts
```

## Limits / honesty

- **Source review ≠ runtime PASS on author machine**; counts above are **this cloud run on pin `c2459deb…`**, not reproduction of bc026’s hash log.
- Mocks are **explicitly synthetic**; no durable Auth/DB/publication proof.
- **No product A115 fix** applied by this verification (author owns pin).
- **No PR / main / deploy / secrets / SQL.**

## Parent actions (Rob-only)

1. **Decide P2:** Accept picker→Active “stranded from Trophy until Pull Back” or add a governed Active-column Won affordance (product change — out of A114 verification scope).
2. **Optional:** Refresh `NEXT_STAGE` comment in `project-board.tsx` on next A115 hygiene pass.
3. **A114:** Prior **1c025 / 3714852** proposal test extractions remain accepted; no rerun required for this A115 pin review unless parent directs full matrix.
