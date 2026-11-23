# D104 R1 final receipt — 24 Nov 2026 (cloud)

**Main:** `5ae38208` at batch start. **Authority:** no force/amend/rebase pushed; normal push only.

## PR integration (R1)

| PR | Branch | Tip |
| --- | --- | --- |
| #258 Marketing | `codex/d104-marketing-guide-20261124` | `86ddb464` |
| #259 A055 (+ merge 258) | `codex/d104-a055-job-context-20261124` | see merge commit on 259 after normal merge of `86ddb464` into A055 |

Merge order for release: **258 first**, then **259** (259 tree includes marketing + A055).

## Job 1 — A055 (accept repair)

| Field | Value |
| --- | --- |
| Branch | `codex/d104-a055-job-context-20261124` |
| Pre-merge tip | `de8fb3e1` |
| Deliverable | `scope_text` in pricing client/server + stale revision tests + scope save refresh + cleared-scope fix |
| Draft PR | #259 |
| CI | `ci.yml` on PR; `e2e.yml` skipped while draft |

## Job 2 — Marketing (accept repair)

| Field | Value |
| --- | --- |
| Branch | `codex/d104-marketing-guide-20261124` |
| Head | `86ddb464` |
| Deliverable | `how-saved-job-data-connects` + FAQ; R1 copy/tests |
| Draft PR | #258 |
| CI | `ci.yml` + possible read-only `marketing-a11y-speed-audit.yml` on marketing paths |

## Job 3 — A001 mobile hub — **SKIP**

| Field | Value |
| --- | --- |
| Branch | `codex/d104-a001-mobile-hub-palette-20261124` |
| Head | `8a83c0d0` (preserved, **no PR, no merge, no rework**) |
| Reason | Log Cost blue vs P&L emerald are intentional distinct action-category colours; change collapsed categories without brand gap evidence |

**Not retried:** `92f52d67`, duplicate #257.

### Bounded commands (this session)

- `npm run typecheck`
- `npx vitest run` on: `pricing-request.test.ts`, `pricing-review.test.ts`, `pricing-assistant-request.test.tsx`, `guides-routes.test.tsx`, `FAQ.test.tsx`