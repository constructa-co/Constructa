# D107 batch — 24 November 2026 (12:20 UAE / cloud worker)

**Base:** `b2ea9f7cb09f2c5d9448c726428d69d57d1bcde9` (`origin/main` at worker fetch).

## ACK (13:20 target)

**#264:** Merged to `main` at `b2ea9f7c` (08:32 UTC). Worker does **not** merge or claim Grok.

**`~/dev` du (Rob list):** Cloud runner has **no** `~/dev` tree. Constructa paths on this VM (read-only): `node_modules` ~1.2 G, `.next` ~285 M, `docs` ~42 M.

**Branch map (updated after b343 doc correction)**

| Job | Item(s) | Branch | Outcome |
| --- | --- | --- | --- |
| 1 | A055 | — | **SKIP** (no new nongated source on `main`) |
| 2 | A096 / A097 / A101 / A102 (+ public site) | `codex/d107-marketing-mobile-apply-20261124` | **Repair:** mobile nav `/apply` (public marketing; **not** A102 social completion) |
| 3 | A103 | — | **SKIP** (draft assets adequate; register already **Partial** since D105) |
| 4 | A020 / A037 | — | **SKIP** (shipped on `main`) |
| 4 | A061 | `codex/d107-a061-programme-20261124` | **Pending** bounded programme chrome review (CTO 06:20 + 12:20 in scope) |

---

## Job 1 — A055

**One-line gap on main:** Remaining work is hosted provider/model/cost caps/ledger/runtime gates; pricing/scope source parity is on `main` via **#259**.

**Action:** **SKIP** — no branch.

---

## Job 2 — A096 / A097 / A101 / A102 (register) and public marketing repair

**Register one-line gaps on main (source vs held work):**

- **A096** — **Partial:** audit existing analytics/newsletter vs requirements; further replacement/activation is owner-held review, not a nongated public copy patch in this batch.
- **A097** — **Partial:** measurement code on `main` (#124); hosted activation and live measurement remain open.
- **A101** — **Partial:** optional Kit signup (#125, flag off); provider setup and live verification held.
- **A102** — **Partial:** approved social/Medium copy in repo (#122, D105 drafts); **publication held with Rob** — distinct from this diff.

**Nongated public-site repair delivered on this branch (Job 2 authority, not A102):** `MarketingMobileMenu` omitted `/apply` while header/footer already link to the founding cohort apply route. Files: `src/components/marketing/marketing-mobile-menu.tsx`, `src/components/marketing/phase-one.test.tsx`.

**Holds unchanged:** **#227** publication, **#228** forms, dashboard/signup/payment/collection OFF. No new claims on `#803b`.

**Checks:** `vitest run src/components/marketing/phase-one.test.tsx`; `npx tsc --noEmit`.

---

## Job 3 — A103

**One-line gap on main:** Pilot drafts + `docs/marketing/drafts/pilot-review-plan-2026-11-24.md` asset table already on `main` (**#263** / D105); no extra private index without publication.

**Register:** **A103 is already Partial since D105** (pilot drafts + review plan). Root JSON may lag; **R1** reconciles stale text only — not a worker “Not started → Partial” action.

**Action:** **SKIP** — no duplicate listing branch.

---

## Job 4 — A020 / A037 / A061

**A020 — one-line gap on main:** Portfolio read-failure UX shipped **#262** (`src/app/dashboard/resources/portfolio/page.tsx`, `page-read-outcomes.test.tsx`). **SKIP.**

**A037 — one-line gap on main:** Example tags section/helper/save on `main` (`example-tags-section.tsx`, `case-study-example-tags.ts`, `a037-example-tags.test.tsx`). **SKIP.**

**A061 — disposition:** Explicit in scope (CTO 06:20 + 12:20). **#260** delivered bounded grid header/date readability only. Further professional planning **chrome** is reviewed on `codex/d107-a061-programme-20261124` — not closed as “Later skip”.

---

## Worker boundaries

No force push; explicit path staging only; no register JSON edit; no PR open/merge by worker.