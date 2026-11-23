# D104 R1 interim receipt — 24 Nov 2026 (cloud)

**Authority:** Rob via ConstructaCTO 24Nov 03:20 UAE. **Main tip:** `5ae38208` (includes merged #257 install banner). **Hold:** #227 `803b`, #228, #238, prod DB, signup/payments, provider activation.

## Job 1 — A055 (in progress)

| Field | Value |
| --- | --- |
| Outcome | Pricing assistant + server verify use same scope as proposal when `scope_text` saved on Estimating |
| Blocker addressed | `buildPricingReviewContext` ignored `scope_text`; client transport sent `brief_scope` only |
| Branch | `codex/d104-a055-job-context-20261124` |
| PR | Draft pending permission after push |
| CI triggers | `ci.yml` all PRs; `e2e.yml` **skipped** while draft; D38/marketing replay **not** path-triggered |
| Hosted writes | None |

## Job 2 / Job 3

| Job | Status |
| --- | --- |
| Marketing guide/FAQ | Queued after Job 1 push |
| Partial Phase 1 (#3) | Queued; A001 install tile closed in #257 |

**Not retried:** `92f52d67` (D103 A063 questionnaire), duplicate #257.