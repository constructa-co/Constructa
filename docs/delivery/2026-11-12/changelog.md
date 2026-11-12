## A023/A091 Edge-journey offline parity — 12 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/app/terms-of-service/page.test.tsx` | 1–40 | Add `PublicChrome` + cohort pathname mock; assert standard terms prose inside `#public-marketing-content` (same selector as loopback Edge check 8) | Close offline gap where Vitest did not mirror the 8/8 Edge terms assertion scope |
| `src/lib/a091-marketing-to-proposal-boundary.test.ts` | 1–8, 19–24, 55–65 | Cohort landing static render with `/login` entry + pin `PLATFORM_TERMS_COMPLETION_SIGN_IN` for unsigned completion handoff | Tie A091 source chain to marketing→account entry steps proven separately in Edge checks 1, 3 and 6 |
| `src/app/login/platform-terms.test.tsx` | 6, 191–203 | Assert consent-not-stored shows link to `PLATFORM_TERMS_COMPLETION_PATH` (matches `completion-routing.test.tsx`) | Close login-suite offline gap on unrecorded-consent handoff after signup |
