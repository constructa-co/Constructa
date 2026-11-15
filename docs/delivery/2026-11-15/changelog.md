## D38 CON-006 — Payment stages must total 100% — 15 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/lib/proposal-payment-percentages.ts` | 1–42 | New shared tolerance, sum, and persist-validation helpers for percentage payment stages | Single source of truth for save-boundary 100% rules |
| `src/lib/proposal-payment-percentages.test.ts` | 1–35 | Regression tests for totals, tolerance, and persist validation | Lock CON-006 percentage semantics |
| `src/lib/proposal-readiness.ts` | 169–214 | Mandatory `payment` readiness now requires full price coverage (≥99.99%), not only a valid row | Issue/publish boundary blocks partial schedules |
| `src/lib/proposal-review.ts` | 309–330 | `buildProposalPayload` rejects under-100% stage sets at save validation | Align pricing/proposal client save with server |
| `src/app/dashboard/projects/proposal/actions.ts` | 119–189 | `saveProposalDraftAction` / `savePricingPaymentStagesAction` use shared persist validator | Enforce 100% on non-empty saves; still allow `[]` |
| `src/app/dashboard/projects/costs/payment-stages.tsx` | 31–42, 71 | Draft UI sums percentages without requiring 100% while editing; copy notes saved total must be 100% | Preserve draft editing UX |
| `src/app/dashboard/projects/proposal/actions.test.ts` | 114–126, 179–182, 232–241, 393–401, 78–95 | Fixtures/schedules at 100%; issue guard test; isolated `setup()` clones; payment drift case fix | Regression at save and publish boundaries |
| `src/lib/proposal-readiness.test.ts` | 22, 53–56, 92–96, 165–168, 275 | Updated expectations for full-coverage mandatory payment | Match new issue rules |
| `src/lib/proposal-review.test.ts` | 168–176, 328 | Under-100 save error; readiness keys when unpriced | Client + readiness regression |
| `src/app/dashboard/projects/proposal/pricing-payments.test.ts` | 11–12, 75–87 | 100% fixtures; partial save refused | Pricing save boundary |
| `src/app/dashboard/projects/costs/payment-stages.test.tsx` | 42–50, 59–74 | `draftTotalling100` helper; partial draft blocked on submit | UI draft vs save boundary |
| `src/lib/proposal-payment-save.test.ts` | 5 | Fixture schedule at 100% | Keep editor baseline test valid |
| `src/lib/proposal-review.ts` | 339–377, 792 | `paymentBoundary: "draft"` omits non-100%/invalid payment rows from whole-draft saves; `saveDraft` uses draft boundary | PR #172: incomplete payment rows must not block scope/wording saves |
| `src/lib/proposal-review.test.ts` | 168–188, 399–412 | Draft-boundary payload + `saveDraft` with partial payments | Regression: unrelated field + incomplete payments |
| `src/app/dashboard/projects/proposal/actions.test.ts` | 193–204 | Server accepts `paymentSchedule: null` with scope edit while schedule unchanged | Save-boundary regression |