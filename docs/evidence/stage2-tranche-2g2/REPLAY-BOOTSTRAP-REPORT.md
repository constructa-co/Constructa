# Migration replay bootstrap repair

- Base: `f2ae90207ede4fe0478d154bf3403b1b6df534b2` (accepted G.2 candidate, PR 92)
- Branch: `claude/stage2g2-replay-bootstrap`, own worktree `constructa-stage2g2-replay-bootstrap`
- One commit: this report and the change it describes
- Patch: `/Users/robertsmith/.codex/worktrees/stage2g-onboarding/stage2g2-replay-bootstrap.patch`
- Local only. Not pushed. No application code, migration, secret or hosted setting touched.

## Problem

`Supabase migration replay` run 37665157326 was cancelled at the 15-minute
limit twice. Both times `sudo apt-get update` stalled on the Ubuntu package
mirror while installing `postgresql-client-17`. No migration and no smoke
step ran, so the job said nothing about the migrations.

## Change

The job already starts the pinned `supabase/postgres` image, which contains
a `psql` of the server's own version. The replay now uses that client, in
that container. Nothing is downloaded on the runner.

| File | Change |
| --- | --- |
| `.github/workflows/migration-replay.yml` | The apt step is removed. Three steps call the new script with `job.services.postgres.id`: prepare, replay, smoke. A fourth runs the bootstrap test first. The two new scripts are added to the path filter |
| `scripts/ci-replay-in-container.sh` (new) | Checks the container, copies four things into `/tmp/constructa-replay`, runs the existing scripts there |
| `scripts/test-replay-bootstrap.sh` (new) | Static and stand-in checks, no Docker, database or network |

Not changed: `scripts/verify-migration-replay.sh`,
`scripts/verify-phase1-smoke.sql`, `scripts/fixtures/supabase-storage.sql`,
every migration, the image digest, the database URL, the 15-minute timeout.

## What is preserved, and how it is checked

| Guard | Status |
| --- | --- |
| Pinned image digest | Unchanged; the test fails if the digest line changes |
| `-X -v ON_ERROR_STOP=1` on every SQL file | The replay script is copied byte-for-byte and run unmodified; the smoke command is the same command, run in the container |
| Ordered full migration chain | Same script. The bootstrap also refuses to continue unless the container holds exactly as many migrations as the checkout |
| First-migration check | Same script |
| Localhost-only target, no URL options | Same script, and repeated in the bootstrap because the smoke step calls `psql` directly |
| Whole smoke file | One `psql -f` of the whole file, as before |
| Job fails on any failure | Each step is one command under `set -euo pipefail`; no `continue-on-error`, no `|| true` |

## Version reasoning

The removed step installed client 17 to match the server. The bootstrap
makes that explicit instead of assumed: it reads `psql --version` in the
container and requires major version 17 (`REPLAY_EXPECTED_PG_MAJOR`), then
asks the server for `server_version_num` and requires the same major. A
different or unreadable version stops the job with a message naming both.
If the image is ever re-pinned to another major, this fails loudly and the
number is changed deliberately in the workflow.

## What is copied into the container

Exactly four paths, into a directory created fresh for the run:
`scripts/verify-migration-replay.sh`, `scripts/verify-phase1-smoke.sql`,
`scripts/fixtures/supabase-storage.sql`, and `supabase/migrations`. The
migrations folder is copied whole, so the bootstrap first refuses if it
contains anything that is not a `.sql` file. `.git`, environment files,
credentials and `node_modules` are never referenced. The only secret-shaped
value involved is the throwaway test database password already written in
the workflow.

## Verification

`bash scripts/test-replay-bootstrap.sh`, run locally: **all checks passed**
(15 static, 8 prepare, 5 replay and smoke, 21 refusals).

- Static: digest pinned, no `apt-get`/`curl`/`wget` in the workflow, service
  container id used in all three steps, order prepare → replay → smoke,
  same URL, no quiet-failure constructs, timeout unchanged, the replay
  script's own guards still present, exactly four `docker cp` lines.
- Stand-in run: a fake `docker` maps the container workspace to a temporary
  directory and a fake `psql` records its calls. This proves the workspace
  holds only the two scripts, the fixture and all 105 migrations; that the
  copies are byte-identical; and that each bad condition stops before any
  SQL runs: missing or malformed container id, non-localhost URL at every
  step, URL options, missing `psql` or `bash`, bash too old, client 15 or
  18, unreadable client version, server of another major, server reporting
  no version, a lost migration, a stray file or folder among the
  migrations, a missing smoke file or fixture.

Two limits on that verification, stated plainly:

1. **The real replay has not run under this change.** It needs Docker and
   the pinned image, which are not on this machine and were not installed.
   The first real proof is the cloud run.
2. **macOS bash is 3.2**, and `verify-migration-replay.sh` uses `mapfile`
   (bash 4+). On this machine the committed test therefore records that the
   script was started in the workspace with the right URL rather than
   executing it. On CI (bash 5) it executes the real script against the
   fake `psql` and additionally checks fixture-first, sorted full chain,
   flags on every file, the success count, and that a failing migration
   fails the step. That branch was exercised here once with a temporary
   `mapfile` shim, not committed, and all of its checks passed.

## Risks for the cloud run

- **Tools in the image.** The bootstrap needs `bash` 4+, `psql`, `find`,
  `sed`, `sort` and `mktemp` in the `supabase/postgres` image. The health
  check already runs `pg_isready` there, so the Postgres binaries are on the
  path; the rest are standard in the image's Ubuntu base. Each is checked
  and named if missing.
- **Connecting from inside the container.** The URL is unchanged
  (`localhost:5432`, `supabase_admin`, password). From inside the container
  that is a loopback TCP connection to the same server. If the image's
  `pg_hba.conf` treated loopback differently from the published port the
  prepare step would fail at "could not reach the replay database", before
  any migration.
- **Container user.** The workspace is created as root and made readable to
  all; the scripts run as the image's default user. They only read the
  workspace and write a temporary file under `/tmp`.

If the cloud run fails in prepare, the message says which of these it was.
None of them can produce a false pass: every path that skips SQL exits
non-zero.
