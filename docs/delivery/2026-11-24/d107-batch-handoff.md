# D107 batch — 24 November 2026 (12:20 UAE / cloud worker)

**Base:** `b2ea9f7cb09f2c5d9448c726428d69d57d1bcde9` (`origin/main` at worker fetch).

## ACK (13:20 target)

**#264:** Rob 12:20 — R1 self-review + normal merge on exact green head before Grok (Mac disk &lt;16 GiB). Worker does **not** merge. On cloud VM, `origin/main` remains `b2ea9f7c` (no worker merge claim).

**`~/dev` du (Rob list):** Cloud runner has **no** `~/dev` tree. Largest Constructa-adjacent paths on this VM (read-only):

| Path | Size |
| --- | --- |
| `/agent/repos/Constructa/node_modules` | ~1.2 G |
| `/agent/repos/Constructa/.next` | ~285 M |
| `/agent/repos/Constructa/docs` | ~42 M |

Mac `~/dev` five-folder list must come from Rob’s machine; do not touch `~/qf-queue`, `~/log-archive`, `~/dev/burn-wt`, or QuantFund.

**Branch map**

| Job | Item(s) | Branch | Head (after push) | Outcome |
| --- | --- | --- | --- | --- |
| 1 | A055 | — | — | **SKIP** (no new source) |
| 2 | A096/A097/A101/A102 | `codex/d107-marketing-mobile-apply-20261124` | (see `git rev-parse`) | **Repair** mobile nav Apply link |
| 3 | A103 | — | — | **SKIP** (index adequate) |
| 4 | A020/A037/A061 | — | — | **SKIP** (gaps closed on main) |

---

## Job 1 — A055

**One-line gap on main:** Non-gated pricing/scope source parity already on `main` via **#259**; remaining A055 work is provider/model/cost caps/ledger/runtime gates (hosted), not app source.

**Action:** No branch. `vitest` on `pricing-request.test.ts`, `full-scope-parent.test.ts`, `pricing-review.test.ts` — **87 passed** on `b2ea9f7c`.

---

## Job 2 — A096 / A097 / A101 / A102

**One-line gaps on main:**

- **A096** — Plausible activation / env (`#228` forms/analytics holds).
- **A097** — Kit/email activation; forms OFF.
- **A101** — Hosted cohort copy publication / `#803b` / signup holds.
- **A102** — First **non-gated** gap: mobile nav omitted `/apply` while desktop header/footer expose cohort apply (responsive access on small viewports).

**Repair:** `marketing-mobile-menu.tsx` — add `/apply` with label **Apply to the founding cohort** (matches footer CTA pattern). `phase-one.test.tsx` — mobile menu link table + Link count (6) expectations.

**Not in scope:** No new metrics, testimonials, pricing claims, forms, or draft publication.

**Checks:** `vitest run src/components/marketing/phase-one.test.tsx`; `npx tsc --noEmit`.

**Workflow effect (for R1):** Touches `(marketing)` public components + unit tests only; no env, no DB, no dashboard routes. Expect default CI vitest/tsc; no hosted write E2E.

---

## Job 3 — A103

**One-line gap on main:** Pilot article **drafts** and asset table already merged **#263** / D105 (`docs/marketing/drafts/*`, `pilot-review-plan-2026-11-24.md`); no additional non-gated listing needed while **unpublished** (no public article routes).

**Action:** **SKIP** — duplicate index would be filler. **R1:** set register A103 to **Partial** with evidence: 6 drafts + `pilot-review-plan-2026-11-24.md` asset table (not `Not started`).

---

## Job 4 — A020 / A037 / A061

**One-line gaps on main:**

- **A020** — Portfolio read-failure UX on **#262** (`page.tsx` + `page-read-outcomes.test.tsx`).
- **A037** — Example tags UI/helper/save on main (`example-tags-section.tsx`, `case-study-example-tags.ts`, tests).
- **A061** — #260 bounded programme headers/dates; full planning UX remains Later (not Phase-2 filler).

**Action:** **SKIP** — no demonstrated non-gated user-facing defect beyond gates.

---

## Worker boundaries

No force push; staged owned paths only; no register JSON edit (R1); no PR open/merge by worker.