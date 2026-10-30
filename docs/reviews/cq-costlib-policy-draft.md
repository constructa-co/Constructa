# Cost library read policy: draft for Rob's approval

**Status: draft, not applied.** Nothing has been run against any database. No SQL or Supabase CLI command was used to prepare this, and the proposal has not been executed anywhere, including locally.

**Inert proposal (apply path):** `docs/reviews/drafts/20261030120000_cost_library_public_read_system_only.sql.txt`

The executable body lives only under `docs/reviews/drafts/` with a `.sql.txt` suffix and an explicit DRAFT / DO NOT EXECUTE / UNAPPROVED wrapper. It is **not** under `supabase/migrations/`, so `supabase db push` and CI migration replay will not pick it up. A prior queue pass failed because the same SQL had been placed on the migrations apply path (`cq-costlib-policy-draft.FAIL`: touches SQL / deploys via live migrations folder).

**Archival bytes (pre-rework, commit `e90f243`):** `docs/reviews/drafts/20261030120000_cost_library_public_read_system_only.sql.pre-rework-archival` (SHA256 `5ecf3a34ad9c06ab5c686cc7dd3d4b69df2462bcc1becd128cf97d2cb521393d`). Git history at `e90f243` also retains the original migrations-path file.

## The problem

`public.cost_library_items` holds Constructa's shared price catalogue and may also hold contractors' own older rates. The live policy "Public Read System Items" is `SELECT` to `public` with `USING (true)`, meaning "every row". The name says system items only, but the rule doesn't check that.

## What changes

| Who | Before (as reported on live) | After |
| --- | --- | --- |
| Not logged in (`anon`) | Policy allows every row | System rows only, and only if `anon` holds a table grant (see below) |
| Logged-in contractor | Policy allows every row, including other contractors' | System rows plus their own rows |
| Service role (admin) | Everything | Everything, unchanged |

A row counts as a genuine system row only if all three are true:

- `is_system_default` is true. This is the column the app already uses to mark system items.
- `user_id` is empty.
- `tenant_id` is empty.

The flag isn't enough by itself. Under the older "Users Manage Own Resources" policy, an owner can edit their own row, so they could tick the flag and publish that row to everyone. The same three-part test is already used in `20260930190000_lock_cost_library_items.sql`.

The proposal SQL (in the inert draft file) does four things in one transaction:

1. Turns row security on, if it isn't already. (CTO reported RLS already enabled on live at 17:30; this step is not re-verified here.)
2. Replaces "Public Read System Items" with the narrowed version, under the same name.
3. Adds `select_own_cost_library_items`, so owners can read their own rows.
4. Replaces only those two SELECT policies. It does **not** drop `"Users Manage Own Resources"` or change table GRANTs. Where that ALL policy and underlying write privileges still exist on live, owner writes can continue; narrowing public SELECT does not by itself make owners read-only or guarantee compatibility. Any apply still needs Rob's explicit approval after the read-only checks below.

## Check first: live doesn't match the repo

The repo's migrations don't explain the live policy:

- No migration here ever creates "Public Read System Items". `20260930190000` only drops it, and replaces it with a logged-in-only policy that hides owners' rows.
- `20261001000000` removes `anon`'s access to this table entirely.

So either those migrations never reached live, or someone changed the policy by hand afterwards. Which one it is affects what this draft does and how it should be applied. Run these read-only checks before approving:

```sql
-- 1. Is row security on? Which policies exist?
SELECT relrowsecurity FROM pg_class WHERE oid = 'public.cost_library_items'::regclass;
SELECT policyname, cmd, roles, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'cost_library_items';

-- 2. Which roles hold which table privileges?
SELECT grantee, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND table_name = 'cost_library_items';

-- 3. Have the earlier lock-down migrations been recorded?
SELECT version FROM supabase_migrations.schema_migrations
 WHERE version IN ('20260930190000', '20261001000000');

-- 4. How will rows be classified? (counts only, no row contents)
SELECT is_system_default,
       user_id IS NULL AS no_user,
       tenant_id IS NULL AS no_tenant,
       count(*)
  FROM public.cost_library_items
 GROUP BY 1, 2, 3
 ORDER BY 1, 2, 3;
```

What to look for:

- **Check 3, either version missing:** `db push` may refuse to run, or may try to apply the older migrations too. Those would remove `anon` access and the owner policies. Decide that deliberately rather than letting it happen as a side effect.
- **Check 2, `anon` has `SELECT`:** logged-out visitors can still read the system catalogue after this change, which is every rate in it. See decision 1.
- **Check 4, `is_system_default` true but an owner set:** these rows drop out of the catalogue for everyone except their owner. Look at them before applying.

## What could break

- **Rows missing from the catalogue.** Every seed migration I checked inserts system rows with both owner columns empty, so seeded rows are safe. Anything added by hand on live with an owner set would disappear from other users' view (check 4).
- **Logged-out reads.** If anything outside this repo reads the table, such as a script or the separate marketing site, it keeps working only if `anon` has a grant, and it now sees system rows only. In this repo, the only three readers are logged-in server actions, so they aren't affected by the `anon` rules: Estimating's advanced tools (`costs/simple-actions.ts`), drawing takeoff (`drawings/actions.ts`) and Vision Takeoff (`foundations/vision-actions.ts`).
- **Owner writes, if row security is currently off on live.** Turning it on means a write needs a policy that allows it. If "Users Manage Own Resources" is also gone, owner writes through the Data API will stop. No code in `src/` writes to this table, so the app shouldn't notice, but an outside tool might.
- **Owners' rows reappear for owners.** If `20260930190000` did reach live, it deliberately hid those rows ("quarantined") until the schema is reconciled. This draft reverses that for reads, because the request was to keep owners' access (see decision 2). App screens won't change, since the queries ask for system rows only. Anyone querying directly would see their own rows.
- **What this doesn't fix.** The rates already exposed were readable until now. This stops further exposure but can't undo any past copying.

## Decisions for Rob

1. **Should logged-out visitors see the system catalogue at all?** The draft does what was asked and limits public reads to system rows. Nothing in this repo needs logged-out access, and `20261001000000` treats `anon` as having none. To close it fully, change the policy to `TO authenticated`. I recommend that, unless something outside the repo depends on it.
2. **Is the "quarantine" still wanted?** The September migration hid owners' rows on purpose, and this request keeps owners' read access. The draft follows the request. If the quarantine should stay, delete `select_own_cost_library_items` from the inert proposal file.

## Existing issue, not changed here

`foundations/vision-actions.ts` filters on `organization_id`, but no migration adds that column to this table. When an organisation ID is present, that query is likely to fail, which would leave Vision Takeoff with no library matches. This draft neither causes nor fixes it. Confirm against the live columns.

## Testing still needed

Nothing has been tested, because running SQL was out of scope for this task. Before applying:

- After approval, promote the inert draft to a dated file under `supabase/migrations/` (or run equivalent SQL manually), then confirm the access table above as `anon`, as two different contractors and as the service role.
- Confirm the existing `scripts/test-cost-library-rls-sql.sh` still passes. It only applies the September migration, so it does not cover this proposal.
- Add a matching test as part of any future apply.

## Rollback

Dropping `select_own_cost_library_items` and restoring the previous definition of "Public Read System Items" would undo this, but that means re-exposing every row, so don't do that as a fix. If reads break, add a narrower policy for whoever lost access. Use the check 1 output, saved before applying, as the record of the original state.
