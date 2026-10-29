# ROB1800-KIT-LIST-EMPTY-ERROR-FIX-RETURN

## Parent / branch / commits

| Field | Value |
|--------|--------|
| **Same-build parent (pre-fix tip)** | `3520db2ce1114b68cf9066cca48af3b5956332ea` |
| **Feature parent (ROB1736)** | `4d8c281` → accepted `c42453d8f7c2e918a9da247a075cd1f7959011cc` |
| **Branch** | `codex/phase1c-kit-list-read-outcomes-20261029` (same branch, child commit) |
| **End commit** | _(after push)_ |
| **PR** | None |

## Grok finding (static, required before ROOT)

`listLoadError` was driven by `error.message` only. Returned `{ data: [partial], error: { message: "" } }` set `listLoadError = ""` (falsy) → success branch, Create-only, **no alert** (partial rows not mapped because `templates` unset, but failure invisible). Thrown `new Error("")` same gap.

## Changed hunks (source only)

**`src/app/dashboard/library/templates/page.tsx`**

- Track `listLoadFailed` boolean on any returned `error` or caught query failure.
- `listLoadDetail = error.message || "Unknown error"` (returned error and catch paths).
- Render unavailable card when `listLoadFailed`, not when `listLoadError` string is truthy.

**`src/app/dashboard/library/templates/template-list-read-outcomes.test.tsx`**

- **NEW** ROB1800 cases:
  1. Returned error `{ message: "" }` + partial data → alert, no partial cards, Create present.
  2. Thrown `new Error("")` → alert, no Edit Recipe, Create present.
- All **5** prior ROB1736 list assertions retained unchanged.

**Not changed:** `phase1c-kit-create-outcomes.test.tsx`, actions, Create form, query chain.

## RED (new cases only, on tip `3520db2` before page fix)

```bash
npx vitest run src/app/dashboard/library/templates/template-list-read-outcomes.test.tsx
# exit 1 — 2 failed | 5 passed (7 total)
# Failed: empty-message returned error + partial; empty-message throw
```

## GREEN

```bash
npx vitest run src/app/dashboard/library/templates/template-list-read-outcomes.test.tsx \
  src/app/dashboard/library/templates/phase1c-kit-create-outcomes.test.tsx
# exit 0 — 13 passed (7 list + 6 create)

npx eslint src/app/dashboard/library/templates/page.tsx \
  src/app/dashboard/library/templates/template-list-read-outcomes.test.tsx
# exit 0

npx tsc --noEmit
# exit 0
```

## Lint / type

ESLint (2 paths): clean. `tsc --noEmit`: clean.

## Limits

Source/mock only; no trim/name/affected-row policy; no ROOT merge; no author build; no full suite reruns.
