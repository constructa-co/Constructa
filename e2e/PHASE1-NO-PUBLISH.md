# Phase 1 hosted no-publish variant

A **separate** Playwright harness from `phase1-journey.spec.ts`. It exercises the
same disposable Supabase project (`constructa-e2e-pr79` /
`umqtzfsnyoofmgfbnrgv`) and the same production build guards, but it **stops at
the pre-send draft PDF boundary**. It does not sign up, publish, email a client
link, open the public portal, record a client response, or simulate Won.

## Prerequisites (fail closed before browsers)

All variables required by `e2e/support/env.ts`, plus:

| Variable | Purpose |
| --- | --- |
| `E2E_SYNTHETIC_QA_EMAIL` | Labelled synthetic mailbox (`*e2e-qa*@example.com` only) |
| `E2E_SYNTHETIC_PASSWORD` | Password for that account (never printed) |

Optional: same as the full journey (`E2E_BASE_URL`, `E2E_STUB_URL`, `E2E_RUN_ID`,
`E2E_EVIDENCE`, `E2E_SKIP_BUILD`).

The config calls `readNoPublishEnv()` in `e2e/support/no-publish-guard.ts`, which
reuses `readE2EEnv()` and refuses to start when the QA label or disposable target
is wrong.

## What runs

- **One** project: `desktop-no-publish` (1440×900), **one** worker, **retries 0**
- **Test file only:** `e2e/phase1-no-publish.qa.ts` (`.qa.ts` so the normal
  `playwright.config.ts` `**/*.spec.ts` matrix does not load `readNoPublishEnv`
  on `--list`; does not import the publishing journey spec or the four-project
  matrix)
- **End state:** client-side pre-send draft PDF downloaded, check code shown,
  `proposal_publications` empty for the new job, **Send never activated**,
  **Save draft not used** (draft PDF is built from the in-browser preview)
- **Navigation:** cohort `ProjectNavBar` shows `Pipeline` plus the current stage
  label (`Estimate`, `Programme`, `Proposal`); the spec uses workflow links
  (`Next: Programme`, `Next: Proposal`) and same-job URLs, not legacy tab links
- **Onboarding:** work-description textarea + `Save and continue` → readiness →
  welcome path to `/dashboard/projects/new` (no trade chip shortcut, no app AI)
- **Draft PDF:** `ReviewSendClient.downloadDraftPdf` builds from
  `store.getState()` / `buildPreviewSnapshot` and `downloadProposalPdf` in the
  browser — **no Save draft** server action.
- **Guards:** third-party hosts blocked; `/auth/v1/signup` aborted;
  **all** `next-action` POSTs to `/dashboard/projects/proposal*` aborted before
  transport; `publish_proposal*` Supabase RPC posts aborted. The spec never
  clicks Save draft or Send.
- **Global setup (variant-only):** `e2e/support/no-publish-global-setup.ts` —
  compiled build ref + disposable auth health + stub `__control` reset. Does
  **not** use `e2e/support/global-setup.ts` (avoids inheriting any broader
  normal-path hooks such as brief-AI budget gates). Stub runs without
  `E2E_AI_MARKER`; brief AI is not called.
- **Proposal UI:** payment preset radio in **1. Prepare proposal**, then
  **2. Review document** before preview / pre-send PDF (not the Send-blocker
  hash link).
- **Brief UI:** site stage ends with **Save and build the price** only (no
  extra `Next` after site notes).
- **Limitation:** browser abort does not prove absence of all Supabase writes on
  other routes (brief/estimate/programme saves still occur).

## Prepared command (coordinator — NOT_RUN by builder)

```bash
npx playwright test --config=playwright.phase1-no-publish.config.ts
```

With Keychain-backed env (operator pattern, values not in repo):

```bash
E2E_SUPABASE_PROJECT_REF=<disposable ref> \
E2E_SYNTHETIC_QA_EMAIL=<e2e-qa-labelled@example.com> \
E2E_SYNTHETIC_PASSWORD=<from protected store> \
scripts/e2e-with-keychain.sh npx playwright test --config=playwright.phase1-no-publish.config.ts
```

## Honest limits

- Browser abort of publish RPCs is **not** a server-side guarantee; the variant
  simply never clicks Send and records blocked attempts.
- QA account state (onboarding complete or not) must allow reaching
  `/dashboard/projects/new`; the spec completes onboarding only when still on
  `/onboarding` after sign-in.
- Won, publication, and client acceptance remain **NOT_RUN** by design.
