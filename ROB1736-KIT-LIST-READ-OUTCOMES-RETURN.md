# ROB1736-KIT-LIST-READ-OUTCOMES-RETURN

## Parent / branch / commits

| Field | Value |
|--------|--------|
| **Accepted parent pin (start)** | `c42453d8f7c2e918a9da247a075cd1f7959011cc` |
| **Branch** | `codex/phase1c-kit-list-read-outcomes-20261029` |
| **End commit** | `4d8c281` (pushed) |
| **PR** | None (per instruction) |

## Scope (OWN piece only)

- `src/app/dashboard/library/templates/page.tsx` — kit list read handling
- `src/app/dashboard/library/templates/template-list-read-outcomes.test.tsx` — **NEW** focused listing read tests
- **Not touched:** `src/app/dashboard/library/page.tsx`, catalog tests, detail `[id]/*`, Remove/Add/load branches, backend actions/schema

## Changed paths

1. `src/app/dashboard/library/templates/page.tsx`
2. `src/app/dashboard/library/templates/template-list-read-outcomes.test.tsx` (new)

`phase1c-kit-create-outcomes.test.tsx` — **no fixture adaptation** (6/6 retained unchanged).

## Commands / exits

```bash
# BASE behavior RED (page at c42453d, new test file only)
npx vitest run src/app/dashboard/library/templates/template-list-read-outcomes.test.tsx
# exit 1 — 3 failed | 2 passed (5 total)

# GREEN after page fix + retained Create suite
npx vitest run src/app/dashboard/library/templates/template-list-read-outcomes.test.tsx \
  src/app/dashboard/library/templates/phase1c-kit-create-outcomes.test.tsx
# exit 0 — 11 passed (5 list + 6 create)

npx eslint src/app/dashboard/library/templates/page.tsx \
  src/app/dashboard/library/templates/template-list-read-outcomes.test.tsx
# exit 0

npx tsc --noEmit
# exit 0
```

## RED qualification (actual behavior on BASE, not harness)

On parent `c42453d`, `TemplatesPage` used `const { data: templates } = await …` and ignored `error`; `templates?.map` rendered nothing on `{ data: null, error }` (silent empty list) and still mapped partial rows when both `data` and `error` were returned; an thrown `order()` rejected uncaught (route-level failure).

**RED cases (3):**

1. Error + null data — no `role="alert"`, no “could not load your saved kits” (looked like zero kits + Create only).
2. Error + partial data — “Should Not Show” card and `./templates/hidden-1` link rendered.
3. Query throw — test run failed with unhandled `query transport failed` (no inline unavailable UI).

**Passed on BASE (2):** confirmed empty `[]` and populated success (already correct when no error).

## GREEN (after fix)

- Inline **listing-region** unavailable card with `role="alert"`, copy: could not load saved kits / refresh to check whether kits were saved (includes error detail when present).
- On `error`, **no** kit cards (including partial data).
- `try/catch` around list read for thrown failures.
- Create New Kit card + `CreateKitForm` always present; successful `[]` and populated cards/links unchanged.
- **11/11** tests pass (5 new list + 6 retained create).

## Lint / type

- ESLint (affected paths): clean
- `tsc --noEmit`: clean

## Limits

- Mocked Supabase only; no real DB/browser/network/finance.
- No auto-retry, no Create form clear on list failure, no new dialogs or list-read gate before create.
- Select/order/auth/RLS unchanged in source (same query chain).
