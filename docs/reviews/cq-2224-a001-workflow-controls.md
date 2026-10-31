# cq-2224 — A001 workflow / standalone controls (Composer 2.5)

## Scope delivered (this slice)

Replaced **brand-blue primary actions** and **ordinary control focus** on the eight disjoint workflow paths with `corePrimaryButton`, `coreFocusRing`, and `coreFocusVisibleRing` from `src/lib/core-editing-palette.ts`. Dimensions, handlers, disabled rules, destructive/secondary semantics, copy, and navigation are unchanged.

| Path | Primary / focus fixes |
|------|------------------------|
| `src/components/project-picker.tsx` | Empty-state **New Project** CTA; search input emerald focus |
| `src/components/postcode-lookup.tsx` | **Find Address** (legacyFind); postcode/street field focus |
| `src/components/install-banner.tsx` | **Install** button |
| `src/app/offline/page.tsx` | **Back to Hub** link |
| `src/app/dashboard/data/library-table.tsx` | Inline **Add Item** default button variant + focus-visible ring |
| `src/app/dashboard/live/project-live-client.tsx` | **Log Cost** submit; log-cost form field focus |
| `src/app/dashboard/projects/drawings/drawing-viewer.tsx` | Panel/modal primaries (Add to Estimate, Place, Set Scale, modal confirm); modal text/calib inputs focus |
| `src/app/supervisor/[token]/supervisor-portal-client.tsx` | **Acknowledge** button; supervisor name field focus |

**Intentionally untouched (semantic / selection / chart blues):** proposal status pills, footer `+ New Project` link, picker header icon, install/offline “C” tiles, live status chips, progress bar, drawing tool selection, measurement selection rows, toolbar icon hover blues, supervisor `FileText` icon, etc.

## New test

| File | Role |
|------|------|
| `src/components/a001-workflow-standalone-controls-brand.test.ts` | Source-level assertions on the eight paths (core palette tokens present on primaries; preserved semantic blues) |

### Test argv and exit (local)

```bash
cd /Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-rev-b0a998e-4c66969
mkdir -p .tmp
export TMPDIR="$PWD/.tmp"
node ../../node_modules/vitest/vitest.mjs run src/components/a001-workflow-standalone-controls-brand.test.ts
```

- **Exit:** `0` (8/8 tests passed, Vitest 5.0.2)

### Lint (changed files only)

```bash
node ../../node_modules/eslint/bin/eslint.js \
  src/components/project-picker.tsx \
  src/components/postcode-lookup.tsx \
  src/components/install-banner.tsx \
  src/components/a001-workflow-standalone-controls-brand.test.ts \
  src/app/offline/page.tsx \
  src/app/dashboard/data/library-table.tsx \
  src/app/dashboard/live/project-live-client.tsx \
  src/app/dashboard/projects/drawings/drawing-viewer.tsx \
  "src/app/supervisor/[token]/supervisor-portal-client.tsx"
```

## Not done (explicit)

- **Marketing** `src/app/(marketing)/` — out of scope (separate product).
- **Kimi-owned seams** — `resources/staff`, `resources/plant`, portfolio, `accounting`, `cis`, `contract-admin`, `p-and-l` actions/pages (not edited here).
- **Prior A001 workflow tests** — `src/app/dashboard/projects/a001-workflow-brand-controls.test.tsx` (nav/error/drawings-client/archive) unchanged; not part of this slice’s new test.
- **App-wide recolor**, new tokens, global CSS overrides, feature behaviour, live writes, drawing logic, supervisor send flows, customer actions.
- **No** PR, main merge, deploy, SQL, settings/keys, inbox/register writes, full Next build, or npm install in this pass.

## Branch / handoff

- Worktree: `/Users/robertsmith/dev/constructa-fresh-20261025/.cq-wt/cq-rev-b0a998e-4c66969`
- Branch: `cq/cq-2224-a001-workflow-controls`
- Changes left **uncommitted** for the runner.
