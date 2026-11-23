# D104 R1 final receipt — 24 Nov 2026 (cloud)

**Main:** `5ae38208` at batch start. **Authority:** no force/amend/rebase pushed; normal push only.

## Job 1 — A055 (accept repair)

| Field | Value |
| --- | --- |
| Branch | `codex/d104-a055-job-context-20261124` |
| Head | `71654aff` |
| Deliverable | `scope_text` in pricing client/server + stale revision tests + scope save refresh |
| Draft PR | R1 to create from branch compare link |
| CI | `ci.yml` on PR; `e2e.yml` skipped while draft |

## Job 2 — Marketing (accept repair)

| Field | Value |
| --- | --- |
| Branch | `codex/d104-marketing-guide-20261124` |
| Head | (see push output below) |
| Deliverable | `how-saved-job-data-connects` + FAQ; R1 copy/tests |
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