# Stage 2G.1 independent review reconciliation

7 October 2026. PR #91 integrates onto main `9405c2f`.

Claude Desktop built the activation flow. A separate Codex reviewer reviewed
the integration diff; Kimi Desktop subsequently reviewed head `15b411c`.
Neither reviewer reported a P0 or P1 finding.

## Resolved

- Readiness now counts the company name and primary phone that publication
  actually uses, rather than unpublished sales contacts or address.
- Case-study eligibility matches the proposal selector: a saved project name
  is required. Narrative-only placeholders no longer count.
- Readiness profile/project query failures surface through the error boundary.
- Kimi confirmed these repairs and identified the same failed-read problem on
  onboarding. Onboarding now rejects failed reads before rendering setup or
  choosing a completion route, with a retry boundary.
- Expired sessions now redirect setup saves to login rather than returning a
  misleading connection error. Unexpected exceptions remain retryable.
- Route tests inject profile and project query errors on onboarding and
  readiness, and verify successful reads still render saved data. Action tests
  distinguish an expired session from an unexpected authentication exception.

## Residuals for the next onboarding slice

- A named case study can still be selected with no narrative or images. The
  status currently describes saved selectable content, not its editorial
  quality. Guided case-study enrichment should distinguish a draft from a
  complete client-facing story.
- The client's five-second navigation fallback is not independently exercised
  by a focused test. Existing browser tests cover retry and successful routing.
- Legacy accounts missing a profile row require separate validation. Missing
  rows now fail visibly rather than becoming an invented empty profile.
- Builder screenshots demonstrate dark mode; light-theme visual inspection
  remains part of the visual polish pass.

## Verification of the follow-up

Targeted route/action tests: 19 passed. TypeScript: pass. CI, browser E2E,
and Vercel Preview must pass on the follow-up commit before merge readiness.
Prior green results apply only to `15b411c`.
