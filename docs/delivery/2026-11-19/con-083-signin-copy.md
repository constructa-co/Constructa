## CON-083 — Sign-in copy and disabled signup presentation — 19 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/components/first-session-frame.tsx` | 36, 106 | Header “your business”; overview `1`–`4` | Tighten trust copy; fix decorative `01`/`02` split |
| `src/app/login/page.tsx` | policy, toggle, footnote, `isSignUp` | Conditional hide Get started when signup disabled | No disabled signup dead ends |
| `src/app/login/signup-disabled-presentation.test.tsx` | new | Gate-off chrome | Regression |
| Login harness tests | policy mock `false` | Signup UI tests unchanged | Production gate remains `true` in source |

Checks: `vitest run src/app/login/ src/components/account-progress.test.tsx src/components/first-session-frame.test.tsx` — 72 tests pass.