## A091 website-to-proposal boundary verification — 7 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/a091-marketing-to-proposal-boundary.test.ts` | new | Vitest chain: signup `emailRedirectTo` carrier → callback `next` → platform-terms completion; first-company → proposal readiness; cohort proposal route allowed | Prove A091 marketing → sign-up → proposal integration boundaries in source without hosted Auth |
| `src/app/auth/confirm/page.test.tsx` | ~110–125 | Assert hash `access_token` / `refresh_token` carriers pass unchanged into `setSession` and land on launch path | Lock f64cd1c auth-confirm exact-carrier behaviour |
| `src/app/dashboard/dashboard-period-metrics.test.tsx` | ~87–100 | Align search assertions with default list view; switch to board before `boardIds` check | Fix false failure (board unmounted when default view is list) so full Vitest suite is green |
