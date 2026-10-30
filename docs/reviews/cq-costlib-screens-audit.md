# `cost_library_items` screens audit under row-level security

Date: 2026-10-30
Branch: `cq/cq-costlib-screens-audit`, at `4c66969`
Method: source reading only. No database, network or SQL was used, and no product code changed. Nothing here was run, so "should keep working" is a prediction from the code.

## Verdict

Every screen and action that uses this table should keep working under the stated policies.

- The app has **three reads** of `cost_library_items`, and all three filter to `is_system_default = true`.
- The app has **no writes** to the table: no `insert`, `update`, `upsert` or `delete` anywhere in `src/`.
- All three reads use the signed-in user's session client. No service-role client touches this table.

There are two things to act on, neither of which breaks a screen:

1. **The stated policies are not the policies this repo defines.** See "Policy mismatch" below. Check this first.
2. **Failures would be hard to see.** Both drawing reads ignore query errors, and row-level security returns empty results rather than errors, so a bad policy would show up as £0 rates or an empty library rather than as a failure.

## Policy mismatch

The brief says two policies are live:

| Policy | Brief | Repo source |
| --- | --- | --- |
| `Public Read System Items` | SELECT, `USING true` | No migration creates it. It appears only as a `DROP POLICY IF EXISTS` in the lock migration, and in a test fixture with `USING (is_system_default)`, not `USING true` (`scripts/test-cost-library-rls-sql.sh:41`) |
| `Users Manage Own Resources` | ALL, owner/tenant via `auth.uid()` | Created in `supabase/migrations/20260117000004_resource_manager.sql:13`, then dropped by the lock migration |

`supabase/migrations/20260930190000_lock_cost_library_items.sql` is the latest migration that sets policies on this table. It drops both named policies (lines 18-21) and creates one replacement, `select_system_cost_library_items`. That policy is `TO authenticated` and allows only rows where `is_system_default IS TRUE AND user_id IS NULL AND tenant_id IS NULL`.

So one of these is true, and the source cannot say which:

- the lock migration has not been applied to the database being described;
- it was applied and the old policies were later put back outside the migrations;
- the brief describes a different environment.

Grants matter as much as policies. `20260930190000_lock_cost_library_items.sql:35-37` and `20261001000000_phase1_data_api_grants.sql:22-37,62` leave `authenticated` with SELECT only and `anon` with nothing. An earlier migration, `20260117000005_fix_resources.sql:11`, granted ALL to `authenticated`. If the lock migration did not run, that grant may still be in place.

## Screens and actions that use the table

Each row was assessed against the stated policies and against the policy in the lock migration.

| # | Screen / route | Server action | Operation | Under stated policies | Under lock migration |
| --- | --- | --- | --- | --- | --- |
| 1 | `/dashboard/projects/costs`, Advanced estimating disclosure (cost library search, section library picker, build-up materials) | `loadAdvancedEstimatingDataAction`, `src/app/dashboard/projects/costs/simple-actions.ts:384`, read at `:407` | SELECT `*`, `is_system_default.eq.true` | Keeps working | Keeps working |
| 2 | `/dashboard/projects/drawings` (full profile only) | `analyzeDrawingPagesAction`, `src/app/dashboard/projects/drawings/actions.ts:38`, read at `:170` | SELECT four columns, `is_system_default = true`, limit 150 | Keeps working | Keeps working |
| 3 | Scan Drawing dialog inside Advanced estimating on `/dashboard/projects/costs` (full profile only) | `analyzeDrawingAction`, `src/app/dashboard/foundations/vision-actions.ts:28`, read at `:82` | SELECT four columns, `is_system_default.eq.true` | Keeps working | Keeps working |

Why they keep working:

- **Row filter:** every read asks only for system rows, and both policy sets allow those. The migrations seed system rows with NULL `user_id` and `tenant_id`, so they also meet the stricter lock predicate. If any live system row has an owner set, the lock policy would hide it. That can only be checked against the data.
- **Role:** all three use `requireAuth()`, so they run as `authenticated`, which keeps SELECT under the source grants.

How each is reached:

- **Row 1** loads when the user opens Advanced estimating (`estimate-client.tsx:415,429`). This is the only one of the three in the default `cohort` profile. The action has no launch-capability check of its own, because estimating is a cohort capability.
- **Row 2** is gated by `requireLaunchCapability("drawing-takeoff")` (`actions.ts:46`), and `/dashboard/projects/drawings` is not an allowed cohort route. It is called from `drawings-client.tsx:475`.
- **Row 3** is gated by the same capability (`vision-actions.ts:32`). The dialog renders only when `showDrawingTakeoff` is true and the estimate has no lines (`advanced-estimate.tsx:125,1688-1694`).

## Writes that depend on the table

No code writes to `cost_library_items`, but two actions can store a reference to it in `estimate_lines.cost_library_item_id`. A value in that column must match a row in this table through a foreign key.

| Screen | Server action | Writes to | Should keep working? |
| --- | --- | --- | --- |
| Costs, picking a catalogue item on a line (`advanced-estimate.tsx:750,801-803`) | `updateLineItemAction`, `src/app/dashboard/projects/costs/actions.ts:214` | `estimate_lines`, with the ID from row 1 | Yes |
| Costs, adding a line (`advanced-estimate.tsx:433,534,574`) | `addLineItemAction`, `src/app/dashboard/projects/costs/actions.ts:122,170` | `estimate_lines`, with the ID always NULL today | Yes |

Postgres foreign-key checks do not go through the caller's row-level security, so these depend on the `estimate_lines` policies, not on this table's. The catalogue-pick IDs come from row 1's read, so they point at system rows. `updateLineItemAction` passes the field through at runtime (`:236`) even though its declared parameter type omits it. `addLineItemAction` accepts the field, but none of its three callers passes it, and the drawing "add to estimate" paths do not set it either.

## Non-app access

| Location | Use | Under the policies |
| --- | --- | --- |
| `src/lib/deployment/review-policy.ts:9` | Preview review mode allow-lists GET and HEAD on this table for the review user | Unaffected: it only permits the reads above and still needs the database to allow them |
| `src/lib/deployment/review-editable.ts:14` | Review mode allows `cost_library_item_id` as an `estimate_lines` field | Unaffected |
| `supabase/migrations/*` | Seed and maintenance writes | Run outside the browser roles, so these policies do not apply to them |
| `scripts/test-cost-library-rls-sql.sh` | CI test of the lock migration (`npm run test:cost-library-sql`) | Tests the lock policy, not the stated policies |
| `assembly_items` SELECT policy, `20260117000000_foundations_estimator.sql` | Policy subquery joins this table | No `src/` code reads `assembly_items` or `assembly_options`, so no screen is affected |

No SQL function, view or trigger in the migrations reads this table, and the app makes no embedded PostgREST select on it.

## Routes that look related but do not use this table

| Route | Actually reads or writes |
| --- | --- |
| `/dashboard/library` and all of `src/app/dashboard/library/actions.ts`, including `getCostLibraryAction` and `deleteCostLibraryItemAction` | `mom_items`, `mom_categories`, `mom_item_overrides` |
| `/dashboard/data/materials`, `/plant`, `/labor` | `cost_library`, a separate table |
| `/dashboard/materials` | `material_prices` |
| `supabase/seed.sql` (not a route) | Seeds `cost_library`, not this table |
| `/dashboard/foundations` | Redirects only. The `vision-actions.ts` file is in this folder, but the dialog is used from Costs |

The names are misleading: `deleteCostLibraryItemAction` deletes from `mom_items`, so it is not a write to `cost_library_items`.

## Risks found

### 1. Stated policies are looser than the lock migration

This is a data exposure risk, not a screen failure. The risks below apply only if the stated policies are really live.

- **Cross-tenant reads.** With `USING true`, every signed-in user can read every row through the Data API, including the legacy tenant rows the lock migration quarantined (`20260930190000_lock_cost_library_items.sql:3-4`). The app's own filters would not stop a direct request.
- **Anonymous reads.** A policy with no `TO` clause applies to all roles, so the only barrier for `anon` is the grant. If the source grants are not in place, the public key could read the whole table.
- **Catalogue poisoning.** `Users Manage Own Resources` does not require `is_system_default = FALSE` in its `WITH CHECK`. If `authenticated` still has INSERT from the old grant, a user could add a row with `is_system_default = true` and their own `user_id`. That row would then appear in every contractor's cost library, because all three reads filter on that flag alone. The source grants block this.

### 2. Query errors are swallowed in both drawing reads

`drawings/actions.ts:170` and `vision-actions.ts:82` take `data` and ignore `error`. On any failure they fall through to `suggested_rate: 0` and no library match, and the user sees a normal-looking result.

### 3. Row-level security filters silently

A wrong policy returns zero rows, not an error. Row 1 checks `error` (`simple-actions.ts:411`), but it would return `ok: true` with an empty library. A smoke test should therefore check that the row count is above zero, not just that the page loads.

### 4. `organization_id` filter in `vision-actions.ts:85`

The read adds `organization_id.eq.<orgId>` when `orgId` is passed, but no migration adds that column to `cost_library_items`. That request would fail, and because of risk 2 it would silently give £0 rates. It is dormant today: the only caller, `vision-takeoff.tsx:52`, passes no `orgId`. This is separate from row-level security and would remain true under either policy set.

### 5. No app-level test covers these queries

The app's tests mock this data, and the CI SQL test covers only the lock policy.

## Recommended next steps

1. Compare the live policies and grants on `public.cost_library_items` with the lock migration, and record which environment the brief describes.
2. If the stated policies are live, apply the lock migration's outcome through the normal migration process rather than leaving them in place.
3. Separately, make the two drawing reads surface `error`, and remove or fix the `organization_id` branch.
