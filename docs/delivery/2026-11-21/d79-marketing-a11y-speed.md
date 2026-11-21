# D79 — Public marketing accessibility and speed (read-only CI)

**Scope:** axe + Lighthouse against verified production `https://constructa-nu.vercel.app` (11 `MARKETING_SITEMAP_PATHS`). **Not** `www.constructa.co` (owner-held). No credentials, no form posts, no signup activation.

## Workflow

- `.github/workflows/marketing-a11y-speed-audit.yml` on `pull_request` (non-draft only).
- Reuses `e2e/readonly-marketing-audit/load-audit-target.mjs` and shared `audit-harness.mjs` GET/HEAD guards.
- Draft PRs record `NOT_RUN` and do not start hosted production audits.

## Source fixes (candidate — proof is post-deploy CI)

| Area | Change |
| --- | --- |
| Skip link | Full launch profile public routes now expose the same `#public-marketing-content` bypass as cohort (`public-chrome.tsx`). |
| Header contrast | Full-profile nav and “Log in” links use `text-gray-400` on dark chrome (`Header.tsx`). |
| Logo label | Full-profile home links use `aria-label="Constructa home"`. |

Production at audit time (pre-merge) is scored independently; a passing PR CI run after deploy is the acceptance proof.

## Limits

- No local build/test gate in this lane; validation is GitHub Actions only.
- Lighthouse performance is reported; only accessibility score ≥ 0.9 gates pass/fail.
- Held items (227/228/schema/Phase 2) untouched; signup/testimonials policy unchanged.
## R1 review before dispatch

Removed the invented draft-only audit hold and Lighthouse0.9 acceptance score. The requested read-only production baseline runs in draft CI; actual axe findings are retained as an advisory baseline, never a candidate PASS. Lighthouse measurement/navigation errors remain failures. Performance/a11y scores, LCP/FCP/TBT/CLS/speed-index and opportunity diagnostics are recorded without inventing a performance budget. GET/HEAD interception and same-origin sitemap navigation are installed on the fresh Lighthouse Chrome context before navigation; registration of service workers is blocked. Production baseline is current deployed0df, not the candidate source. Postmerge read-only audit must confirm deployed source improvements.
