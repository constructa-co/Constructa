# cq-0815-estimate-storage — optional sessionStorage hardening

## Scope

Repair only the remembered estimate-version preference in pricing (`constructa_tab_${project.id}`). Server persistence and all selection guards unchanged.

## Source change

**File:** `src/app/dashboard/projects/costs/estimate-client.tsx` (mount effect ~327–331, `selectEstimate` write ~337–344)

- Mount restore: `getItem` wrapped in try/catch; property/getter failures leave default/in-memory active version.
- Version select: `setItem` wrapped in try/catch after reducer dispatch; QuotaExceeded/SecurityError do not undo in-memory selection.

## Tests

**File:** `src/app/dashboard/projects/costs/estimate-version-storage.test.tsx`

Runs real `useEffect` (not mocked away like `estimate-versions.test.tsx`). Covers mount restore, `defaultTabId` skip, getItem/getter throw, setItem throw with in-memory select, invalid no-op, dirty guard.

**Unchanged:** `src/app/dashboard/projects/costs/estimate-versions.test.tsx`

## Verification commands

```bash
cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-0432-a091-error-recovery
mkdir -p .tmp/vitest
TMPDIR="$(pwd)/.tmp/vitest" npx vitest run \
  src/app/dashboard/projects/costs/estimate-version-storage.test.tsx \
  src/app/dashboard/projects/costs/estimate-versions.test.tsx
npx tsc --noEmit
```

Pre-fix RED (3 cases): getItem throw, sessionStorage getter throw, setItem throw — all escaped uncaught from `estimate-client.tsx`.

## Branch / base

- Branch: `cq/cq-0815-estimate-storage`
- Base: `adbe860ba3163054474be22ebfb8aa65b40f42b1`
