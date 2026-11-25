# D36 markup method — rollback scripts (PR #176)

**These are not migrations.** They live outside `supabase/migrations` so nothing
applies them automatically. Run by hand only, against a target with a verified
preapply backup. They were exercised only on a disposable CI database
(workflow `D101 markup undo-reapply drill`); they have not been run on any
hosted database, and no production backup or acceptance is claimed.

| Forward migration | Rollback script | Effect |
|---|---|---|
| `20261116140000_d36_phase1_project_graph_markup_method.sql` | `down-20261116140000-phase1-graph-rpc.sql` | Restores the A069 `create_phase1_project_graph` (body copied from `20261028183000_new_job_closing_prefill.sql`), SECURITY INVOKER, `search_path=''`, REVOKE PUBLIC/anon, GRANT authenticated. Verifies body md5, security, config and grants before COMMIT. No table or row is touched. |
| `20261115120000_d36_markup_method.sql` | `down-20261115120000-markup-columns.sql` | Drops the two `markup_method` columns and check constraints **only when that loses nothing**. Otherwise refuses. |

Order: RPC script first, then (optionally) the columns script. Roll forward by
re-applying the two original migration files in order (A, then B).

```bash
psql "$URL" -X -v ON_ERROR_STOP=1 -f scripts/rollback/d36-markup-method/down-20261116140000-phase1-graph-rpc.sql
psql "$URL" -X -v ON_ERROR_STOP=1 -f scripts/rollback/d36-markup-method/down-20261115120000-markup-columns.sql
```

## Limits (read before running)

* **on_net incompatibility.** A pre-D36 application only knows the compound
  method and would price any estimate stored as `on_net` as compound, which is a
  different price. The RPC script therefore refuses while any stored `on_net`
  estimate exists. Prefer a forward fix. Only if you accept that the old
  application must not price those estimates, re-run with
  `-v ack_on_net_incompatible=yes`; this restores the RPC only and changes no data.
* **Stored choices are never deleted.** The columns script refuses if any
  estimate has a non-NULL `markup_method` or any profile has a value other than
  the default `on_net`. There is no force or archive-and-drop option. The
  supported rollback after real use is to keep the additive columns (the old
  application ignores them).
* Legacy estimates (NULL) stay NULL and compound through rollback and
  roll-forward; nothing is backfilled. Estimates created while rolled back are
  NULL (compound) and stay so after roll-forward.
* The RPC text is the repository predecessor, not a production backup. If the
  actual preapply definition differs, restore that instead and re-check grants.
* The application snapshot must be rolled back together with the database
  state it expects (migration-before-code ordering is unchanged).

## Maintenance window and locking

Run either script only in a maintenance window with **no old or new
application writers** (stop writers first). Each script locks before it checks
and holds the lock through COMMIT: the columns script takes ACCESS EXCLUSIVE on
`profiles` and `estimates`; the RPC script takes SHARE ROW EXCLUSIVE on
`estimates` (blocks writes, allows reads). `lock_timeout` is 5s: if writers are
active the script fails with a lock timeout and changes nothing; retry after
stopping them. This prevents a stored choice appearing between the guard and the
change; it does not replace the maintenance window.
