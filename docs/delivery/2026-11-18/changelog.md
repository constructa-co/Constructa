## CON-069 — High discount confirmation — 18 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/discount-confirm.ts` | new | 25% threshold (`>25`); reason + contractor confirm; 100% allowed without large-discount warning | Single gate for simple + advanced |
| `src/lib/simple-estimate.ts` | submitAdjustments | Optional `highDiscountConfirmed`; no maths changes | Block save until confirm |
| `src/app/dashboard/projects/costs/estimate-client.tsx` | TotalCard + dialog | Required reason copy above 25%; cancel restores saved discount | Simple estimating |
| `src/app/dashboard/projects/costs/advanced-estimate.tsx` | discount blur | Confirm dialog above 25%; baseline rollback on cancel/failure | Advanced estimating |
| `src/app/dashboard/projects/costs/actions.ts` | margins/discount | 0–100 validation on write (D51 parity) | Keep server boundary |
| Tests | 4 files | discount-confirm, simple-estimate, estimate-cancel, advanced smoke | ≤25 no confirm, >25 reason+confirm, cancel/no write, 100% no warning |

Checks: `npm run typecheck` pass; `vitest run` on 4 CON-069 files — 61 tests pass.

## D51 CON023 / CON076 / CON083 — Job name limit + sign-in field help — 18 November 2026

Integrated from authorised sibling return `claude-d51-profile-save` (bounded; no profile save timing, no isolation/auth changes).

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/blank-project.ts` | 53–71, 71 | `PROJECT_NAME_MAX_LENGTH`, `projectNameLimitNotice`, accurate schema message | CON023: visible feedback when job name nears 200-character cap |
| `src/app/dashboard/projects/new/new-project-form.tsx` | 9–15, 169–198 | Live limit status + `aria-describedby` on job name | CON023: screen-reader + visual countdown at limit |
| `src/lib/blank-project.test.ts` | imports, 165–188 | `job name limit` describe block | Regression |
| `src/app/dashboard/projects/new/new-project-form-name-limit.test.tsx` | new | Form wiring tests | CON023 regression |
| `src/app/login/page.tsx` | 8, 56–57, 155–157, 188–260 | Show/hide password, email keyboard hints, `aria-invalid` on refused sign-in | CON076/083 sign-in accessibility |
| `src/app/login/signin-field-help.test.tsx` | new | LoginPage static harness tests | CON076/083 regression |

Not brought over: `profile-isolation.test.tsx`, `actions.ts` `profile.save.timing` logging, blank-project unrelated drift (UkDateInput / postcode fallback).

Checks: `npm run typecheck` — pass; `vitest run src/lib/blank-project.test.ts src/app/login/signin-field-help.test.tsx src/app/dashboard/projects/new/new-project-form-name-limit.test.tsx` — 3 files, 31 tests passed.