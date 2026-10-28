# Cursor change log

## 2026-10-28 — A008 whole-journey phone step frame (Rob28Oct07:50)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/components/first-session.module.css` | ~123–140 | Shared `.journeyStepForm` phone rhythm; scroll-bound `.setupForm .workSuggestions`; compact setup story panel on phone | Stop account→setup jump from short to excessively long pages without shrinking 44px choice chips or adding an 844px whole-step gate |
| `src/app/onboarding/onboarding-client.tsx` | ~148 | Form uses `journeyStepForm` + `setupForm` (drops redundant `mt-8`) | Align setup step with account signup frame composition |
| `src/app/login/page.tsx` | ~177 | Signup `<form>` gets `ui.journeyStepForm` when `isSignUp` | Same scoped phone step frame as onboarding setup |
| `src/app/onboarding/onboarding-journey-step-frame.test.tsx` | new | Bounded CSS/source range scans for A008 journey composition | Evidence for independent review; not token-only CSS assertions |
| `src/app/onboarding/onboarding-work-choices-compact.test.tsx` | ~25–36 | Expectations updated for `journeyStepForm` + scroll region | Keep A007/A008 split: chips unchanged, frame composition fixed |

## 2026-10-27 — A059 weekend pattern → proposal refresh (Composer a059)

| File | Lines (approx.) | Change | Intent |
|------|-----------------|--------|--------|
| `src/app/dashboard/projects/schedule/simple-programme-client.tsx` | ~392–395 | Call `router.refresh()` after `router.push` on **Next: Proposal** | Re-fetch the proposal page server props so `programme_working_pattern` saved in Programme is not stale in Review & Send |
| `src/app/dashboard/projects/schedule/simple-programme-workspace.test.tsx` | hoisted router mock, new test | Assert push + refresh on **Next: Proposal** | Lock the navigation seam after saved weekend working days |
| `src/app/dashboard/projects/proposal/review-send-client.test.ts` | new test | All-week pattern shows Sunday 15 Nov finish in programme section | Prove production Review & Send uses saved pattern, not default Mon–Fri |
