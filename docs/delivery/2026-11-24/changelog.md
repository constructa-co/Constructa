## D105 Job 4 — A020 resource portfolio read failures — 24 November 2026

| File | Lines (approx.) | Change | Intent |
| --- | --- | --- | --- |
| `src/app/dashboard/resources/portfolio/page.tsx` | queries + unavailable UI | Capture errors on all five reads; fail closed with plain reload message instead of `?? []` silent empty dashboard | Honest disconnected state when Supabase reads fail; no query/SQL/schema changes |
| `src/app/dashboard/resources/portfolio/page-read-outcomes.test.tsx` | (new) | Mocked read failure vs empty success vs data success | Route-level outcome tests; no mirror class guards |

**Before:** Any failed `projects` / `staff` / `allocations` / `absences` / `estimates` read was ignored; `PortfolioClient` received empty arrays and showed zero-looking metrics.

**After:** Auth redirect unchanged. Successful reads with empty rows still render `PortfolioClient`. Any read error → `role="alert"` unavailable copy + reload link; no raw DB messages.

**A037 (same batch context):** Existing tag source and persistence guard on `main`; register remains Not started — no new source gap and no newly verified hosted save in this pass.

**A055:** SKIP — no gap after #259 (unchanged).

Checks: `vitest run src/app/dashboard/resources/portfolio/page-read-outcomes.test.tsx`; `npx tsc --noEmit`.