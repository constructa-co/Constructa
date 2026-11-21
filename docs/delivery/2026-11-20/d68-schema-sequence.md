# D68 — approved schema sequence (CI fixture replay only)

Authority: `CTO-20261120-2120-D68-AUTHORITY.md`. **Source-only in this worktree.** No local build, SQL apply, merge, or invented PASS. Disposable `migration-replay.yml` on `localhost` is the verifier.

## Approved order (five PRs, six SQL files)

| Step | PR | Fixture file (under `scripts/fixtures/d68-schema-sequence/`) | SHA-256 |
| --- | --- | --- | --- |
| 1 | #176 | `20261115120000_d36_markup_method.sql` | `c5d20b553216ce436c92fda526caf45fac2f3e55164319611445cf55324ecc6b` |
| 2 | #176 | `20261116140000_d36_phase1_project_graph_markup_method.sql` | `d66f540b5b572ea5d559b104822abf05b21cdd0ac35c138c22aa2b4027e488c1` |
| 3 | #185 | `20261116103000_con018_profile_vat_settings.sql` | `afaaaa2c37ace7ca99199db8cedbbe634562f6fac45cc06841f56ab9ae7a9d63` |
| 4 | #222 | `20261118003000_con044_programme_planner_draft.sql` | `1232660aa53def945db250a9bc09c097e1fa2a6df8c814837b642e39b9e90e8f` |
| 5 | #223 | `20261120032000_con073_pipeline_stage_history.sql` | `282c3d3098b5fa738e92057bc1c5ecc0c2c27be402d9d82d2b493979396bb567` |
| 6 | #224 | `20261120040000_con068_estimate_line_included.sql` | `242d79778b7c8b0baf2561d6372ff804cadb9966dfece7c4c67e061a119b00b2` |

Canonical order and hashes: `manifest.tsv` (container-friendly) and `manifest.json`. These files are **CI fixtures only** — never copy into `supabase/migrations/` on main until each PR merges.

## How CI replays

1. **Baseline:** all committed `supabase/migrations/*.sql` in sorted order **except** the six manifest filenames (so planner on #222 does not run ahead of #176/#185).
2. **Manifest tail:** the six fixtures in table order, each after `sha256sum` check; if a same-named file exists under `supabase/migrations/`, its hash must match the fixture (no stale test claim).
3. **Receipts:** after each fixture, `psql ON_ERROR_STOP` plus stage checks (columns, defaults, constraints, RLS/policies, `create_phase1_project_graph` body contains `markup_method`). stdout line: `d68-apply-receipt pr=… file=… sha256=… psql=ON_ERROR_STOP stage=verified`.
4. **Smoke:** existing `verify-phase1-smoke.sql` unchanged, runs last.

Branches **without** `manifest.tsv` keep the original full-chain replay.

## Per-PR preview test (operator, after sign-in — not run by agents)

### PR #176 (two files)

Preview: apply both exact files in order on the verified disposable target; create an estimate with on_net, then another with compound; old NULL estimates must remain compounded and unchanged. Check the Phase1 graph creation path and proposal calculation note.

Rollback SQL template (not executed): keep additive columns/data. First ensure no new on_net estimates would be mispriced by an old app; then restore the ACTUAL preapply backed-up RPC definition and app snapshot. The predecessor function template from 20261028183000 is attached to the PR; it is not a substitute for a verified production backup.
```sql
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.estimates WHERE markup_method = 'on_net') THEN
    RAISE EXCEPTION 'Preserve stored on_net estimates; stop rollback and forward-fix pricing.';
  END IF;
END $$;
-- Execute the verified preapply CREATE OR REPLACE RPC definition here.
-- Leave profiles/estimates.markup_method and their constraints intact.
COMMIT;
```

### PR #185 — CON-018 VAT

Preview: on the verified disposable target, apply exact VAT migration, verify NULL legacy behavior and save/reload registered/unregistered/rate/reverse-charge choices. Exercise interview missing-storage fallback and cover-upload prepend versus scope append with D51 origin refusals. No production gate/settings activation.

Rollback SQL template (not executed): roll back the gated app feature using the recorded app snapshot; retain entered VAT values. If the recorded preapply/default policy requires these defaults, restore them without altering rows:
```sql
BEGIN;
ALTER TABLE public.profiles ALTER COLUMN vat_registered SET DEFAULT NULL;
ALTER TABLE public.profiles ALTER COLUMN default_vat_rate SET DEFAULT 20;
ALTER TABLE public.profiles ALTER COLUMN default_vat_reverse_charge SET DEFAULT false;
COMMIT;
```

### PR #222 — CON-044 planner draft

Preview: after176/185, edit/autosave a planner draft; reload the same job and verify it persists while programme_phases/proposal remain unchanged until explicit Save to Proposal. Use the second approved dummy user to verify isolation.

Rollback SQL template (not executed): this additive nullable column has no destructive down migration. Preserve any drafts and use the recorded app snapshot/forward repair; transaction failure before commit rolls back automatically. The SQL readback below confirms the retained drafts for recovery; it intentionally does not erase them.
```sql
BEGIN READ ONLY;
SELECT count(*) AS retained_planner_drafts
FROM public.projects WHERE programme_planner_draft IS NOT NULL;
ROLLBACK;
```

### PR #223 — CON-073 pipeline history

Preview: after176/185/222, confirm a stage move inserts one owner event, same-status move adds none, second user cannot read/insert another owner's events, and UPDATE/DELETE are refused. History acknowledgement is not atomic with the separate status move.

Rollback SQL template (not executed): preserve append-only history; if the application is rolled back, temporarily refuse new authenticated inserts while retaining owner reads and stored events. Restore exact prior grants only from the verified preapply privilege snapshot during a forward repair.
```sql
BEGIN;
REVOKE INSERT ON TABLE public.project_pipeline_stage_events FROM authenticated;
COMMIT;
```

### PR #224 — CON-068 included line

Preview: after176/185/222/223, mark a zero-price simple line Included, save/reload, verify explicit true only; legacy zero lines remain false. Verify proposal amounts and actual positive-rate lines are unaffected.

Rollback SQL template (not executed): retain the flag/data; do not turn deliberately Included lines into unpriced lines or drop the column. Only use an old app if this guard establishes no stored Included choice would be misinterpreted; otherwise stop and forward-fix.
```sql
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.estimate_lines WHERE included IS TRUE) THEN
    RAISE EXCEPTION 'Preserve Included choices; use a compatible app or forward repair.';
  END IF;
END $$;
COMMIT;
```

## Fixture reuse (#223, #224, #185)

After #185 preparation is reviewed (still unmerged), R1 reuses the same `scripts/fixtures/d68-schema-sequence/` bytes and `manifest.tsv` hashes; candidates must not change fixture SHA-256 without updating both manifest files.

## Scope boundary

This is **ordered migration proof on disposable localhost**, not production copy/rollback execution, preview PASS, or signup. No new runner; `verify-migration-replay.sh`, `ci-replay-in-container.sh`, and `test-replay-bootstrap.sh` only.

## CI workflow note

Until `.github/workflows/migration-replay.yml` path filters include `scripts/fixtures/d68-schema-sequence/**` or the three scripts, fixture-only edits may not trigger replay — pair fixture commits with a script touch or let R1 extend paths.
R1 grade: stage SELECT results now must equal0 (psql exit0 alone is insufficient); exact six-file order enforced, final TSV newline retained, NULL defaults rejected, fixture contents copied without a nested directory. No DROP TABLE/COLUMN rollback templates; all row data is preserved. These are CI receipts only; actual preapply backup, verified target and runtime tests occur after access exists.
