#!/usr/bin/env bash
# Checks the migration-replay bootstrap without Docker, a database or a network.
#
# Part 1 reads the workflow and the scripts and fails if a guard has gone:
# pinned image, no package downloads, psql flags, first-migration check,
# localhost-only target, whole smoke file.
#
# Part 2 runs scripts/ci-replay-in-container.sh against a stand-in `docker`
# that maps the container's workspace to a temporary directory and a stand-in
# `psql` that records how it was called. That proves what is copied, in what
# order things run, and that every bad condition stops the job.
#
# Where this machine's bash is 4 or later (every CI runner), the real
# verify-migration-replay.sh is executed inside the stand-in container. On an
# older bash (macOS ships 3.2) that one script cannot run, so its invocation
# is recorded instead and the run says so.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/constructa-replay-bootstrap.XXXXXX")"
WORK="$(cd "$WORK" && pwd -P)" # the real path, so recorded working directories compare equal
trap 'rm -rf "$WORK"' EXIT

failures=0
pass() { echo "  ok    $1"; }
fail() { echo "  FAIL  $1" >&2; failures=$((failures + 1)); }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }

WORKFLOW="$ROOT_DIR/.github/workflows/migration-replay.yml"
BOOTSTRAP="$ROOT_DIR/scripts/ci-replay-in-container.sh"
REPLAY="$ROOT_DIR/scripts/verify-migration-replay.sh"
URL="postgresql://supabase_admin:postgres@localhost:5432/constructa_replay"
PINNED="supabase/postgres@sha256:edb20149b36e92c915f13b24ae04fed35e6e0a19a6bd6e06d54ed4afbce5c931"

echo "Workflow and scripts"
check "the Postgres image is still pinned to the same digest" "grep -qF 'image: $PINNED' '$WORKFLOW'"
check "no package is downloaded on the runner" "! grep -qE 'apt-get|apt\.postgresql\.org|apt install|curl |wget ' '$WORKFLOW'"
check "the service container's own id is used" "[[ \$(grep -cF 'REPLAY_POSTGRES_CONTAINER: \${{ job.services.postgres.id }}' '$WORKFLOW') -eq 3 ]]"
check "client and server must be PostgreSQL 17" "grep -qF 'REPLAY_EXPECTED_PG_MAJOR: \"17\"' '$WORKFLOW'"
check "prepare, replay and smoke each run, in that order" "[[ \"\$(grep -oE 'ci-replay-in-container\.sh (prepare|replay|smoke)' '$WORKFLOW' | awk '{print \$2}' | tr '\n' ' ')\" == 'prepare replay smoke ' ]]"
check "the database is the same localhost test database in every step" "[[ \$(grep -cF 'MIGRATION_DATABASE_URL: $URL' '$WORKFLOW') -eq 3 ]]"
check "no step is allowed to fail quietly" "! grep -qE 'continue-on-error|\|\| true|if: .*always' '$WORKFLOW'"
check "the job timeout is unchanged" "grep -qF 'timeout-minutes: 15' '$WORKFLOW'"
check "a change to the bootstrap triggers the replay" "grep -qF '\"scripts/ci-replay-in-container.sh\"' '$WORKFLOW' && grep -qF '\"scripts/test-replay-bootstrap.sh\"' '$WORKFLOW'"
check "the replay script still stops on the first SQL error" "[[ \$(grep -cF -- '-X -v ON_ERROR_STOP=1' '$REPLAY') -eq 2 ]]"
check "the replay script still checks the first migration" "grep -qF 'to remain the first migration' '$REPLAY'"
check "the replay script still replays the sorted full chain" "grep -qF \"find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print | LC_ALL=C sort\" '$REPLAY'"
check "the replay script still refuses anything but localhost" "grep -qF 'must be an isolated localhost database' '$REPLAY'"
check "the smoke step runs the whole smoke file with the same flags" "grep -qF 'psql \"\$url\" -X -v ON_ERROR_STOP=1 -f scripts/verify-phase1-smoke.sql' '$BOOTSTRAP'"
check "the bootstrap copies exactly four things" "[[ \$(grep -c '^  docker cp ' '$BOOTSTRAP') -eq 4 ]]"

# ── Stand-ins ─────────────────────────────────────────────────────────────────
BIN="$WORK/bin"
mkdir -p "$BIN"

cat > "$BIN/psql" <<'STUB'
#!/usr/bin/env bash
# Records the call. Answers the two questions the bootstrap asks.
printf '%s|%s\n' "$PWD" "$*" >> "$FAKE_PSQL_LOG"
if [[ "${1:-}" == "--version" ]]; then echo "${FAKE_PSQL_VERSION:-psql (PostgreSQL) 17.4}"; exit 0; fi
file=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -c) [[ "$2" == "SHOW server_version_num" ]] && echo "${FAKE_SERVER_NUM-170004}"; shift 2 ;;
    -f) file="$2"; shift 2 ;;
    *) shift ;;
  esac
done
if [[ -n "$file" ]]; then
  [[ -f "$file" ]] || { echo "psql: $file: No such file" >&2; exit 1; }
  if [[ -n "${FAKE_PSQL_FAIL_ON:-}" && "$file" == *"$FAKE_PSQL_FAIL_ON"* ]]; then echo "ERROR: forced failure in $file" >&2; exit 3; fi
fi
exit 0
STUB

cat > "$BIN/docker" <<'STUB'
#!/usr/bin/env bash
# A container whose /tmp/constructa-replay is a directory under $FAKE_ROOT.
set -euo pipefail
printf '%s\n' "$*" >> "$FAKE_DOCKER_LOG"
map() { printf '%s' "${1//\/tmp\/constructa-replay/$FAKE_ROOT/tmp/constructa-replay}"; }
command="$1"; shift
if [[ "$command" == "cp" ]]; then
  destination="$(map "${2#*:}")"
  cp -R "$1" "$destination"
  if [[ -n "${FAKE_DROP_MIGRATION:-}" && -d "$destination" ]]; then rm -f "$(find "$destination" -name '*.sql' | sort | tail -n 1)"; fi
  exit 0
fi
[[ "$command" == "exec" ]] || { echo "unexpected docker $command" >&2; exit 64; }
workdir="$FAKE_ROOT"
while [[ $# -gt 0 ]]; do
  case "$1" in
    -i) shift ;;
    --user) shift 2 ;;
    -w) workdir="$(map "$2")"; shift 2 ;;
    -e) export "${2?}"; shift 2 ;;
    *) break ;;
  esac
done
shift # the container
cd "$workdir"
export PATH="$FAKE_BIN:$PATH"
if [[ "$1" == "sh" && "$2" == "-c" ]]; then
  if [[ -n "${FAKE_MISSING_TOOL:-}" && "$3" == "command -v $FAKE_MISSING_TOOL >/dev/null" ]]; then exit 1; fi
  exec sh -c "$(map "$3")"
fi
if [[ "$1" == "bash" && "$2" == "-c" ]]; then echo "${FAKE_BASH_MAJOR:-5}"; exit 0; fi
if [[ "$1" == "bash" && "$2" == "scripts/verify-migration-replay.sh" && "${BASH_VERSINFO[0]}" -lt 4 ]]; then
  [[ -f "$2" ]] || exit 1
  echo "RECORDED|$PWD|$2|$MIGRATION_DATABASE_URL" >> "$FAKE_PSQL_LOG"
  exit 0
fi
if [[ "$1" == "chmod" ]]; then shift; args=(); for a in "$@"; do args+=("$(map "$a")"); done; exec chmod "${args[@]}"; fi
exec "$@"
STUB
chmod +x "$BIN/psql" "$BIN/docker"

# A checkout holding only what the replay uses, plus things that must never be copied.
new_checkout() {
  CHECKOUT="$WORK/checkout.$RANDOM"
  mkdir -p "$CHECKOUT/scripts/fixtures" "$CHECKOUT/supabase" "$CHECKOUT/.git" "$CHECKOUT/node_modules/x"
  cp "$ROOT_DIR/scripts/ci-replay-in-container.sh" "$ROOT_DIR/scripts/verify-migration-replay.sh" "$ROOT_DIR/scripts/verify-phase1-smoke.sql" "$CHECKOUT/scripts/"
  cp "$ROOT_DIR/scripts/fixtures/supabase-storage.sql" "$CHECKOUT/scripts/fixtures/"
  cp -R "$ROOT_DIR/supabase/migrations" "$CHECKOUT/supabase/migrations"
  echo "SECRET=1" > "$CHECKOUT/.env.local"
  echo "secret" > "$CHECKOUT/.git/config"
  echo "module" > "$CHECKOUT/node_modules/x/index.js"
  export FAKE_ROOT="$WORK/container.$RANDOM" FAKE_BIN="$BIN"
  export FAKE_DOCKER_LOG="$FAKE_ROOT/docker.log" FAKE_PSQL_LOG="$FAKE_ROOT/psql.log"
  mkdir -p "$FAKE_ROOT/tmp"
  : > "$FAKE_DOCKER_LOG"; : > "$FAKE_PSQL_LOG"
}

# run <subcommand>, with any FAKE_* or override variables already exported.
run() {
  (cd "$CHECKOUT" && PATH="$BIN:$PATH" \
    REPLAY_POSTGRES_CONTAINER="${CONTAINER-pg_service_1}" MIGRATION_DATABASE_URL="${DB_URL-$URL}" \
    bash scripts/ci-replay-in-container.sh "$1") > "$WORK/out" 2>&1
}
refused() { # name, subcommand, expected message
  if run "$2"; then fail "$1 (it was allowed)"; return; fi
  if ! grep -qF "REPLAY BOOTSTRAP FAILURE" "$WORK/out" || ! grep -qF "$3" "$WORK/out"; then fail "$1 (wrong message: $(tr '\n' ' ' < "$WORK/out"))"; return; fi
  if grep -q -- ' -f ' "$FAKE_PSQL_LOG" || grep -q '^RECORDED' "$FAKE_PSQL_LOG"; then fail "$1 (SQL was run anyway)"; return; fi
  pass "$1"
}
reset() { unset FAKE_PSQL_VERSION FAKE_SERVER_NUM FAKE_MISSING_TOOL FAKE_BASH_MAJOR FAKE_DROP_MIGRATION FAKE_PSQL_FAIL_ON CONTAINER DB_URL; new_checkout; }

MIGRATION_COUNT="$(find "$ROOT_DIR/supabase/migrations" -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d '[:space:]')"
SPACE_REL="tmp/constructa-replay"

echo "Prepare"
reset
check "prepare succeeds with a PostgreSQL 17 client and server" "run prepare"
check "it reports the client, the server and the number of migrations" "grep -qF 'psql (PostgreSQL) 17.4, server 17, $MIGRATION_COUNT migrations' '$WORK/out'"
check "the workspace holds the two scripts, the fixture and every migration, and nothing else" \
  "[[ \$(find '$FAKE_ROOT/$SPACE_REL' -type f | wc -l | tr -d '[:space:]') -eq $((MIGRATION_COUNT + 3)) ]]"
check "nothing from .git, node_modules or an env file is copied" \
  "! find '$FAKE_ROOT' \( -name '.git' -o -name 'node_modules' -o -name '.env*' -o -name 'config' -o -name 'index.js' \) | grep -q ."
check "the only things copied are the four named paths" \
  "[[ \"\$(grep '^cp ' '$FAKE_DOCKER_LOG' | awk '{print \$2}' | tr '\n' ' ')\" == 'scripts/verify-migration-replay.sh scripts/verify-phase1-smoke.sql scripts/fixtures/supabase-storage.sql supabase/migrations ' ]]"
check "the copied replay script is byte-for-byte the committed one" "cmp -s '$REPLAY' '$FAKE_ROOT/$SPACE_REL/scripts/verify-migration-replay.sh'"
check "the copied smoke file is byte-for-byte the committed one" "cmp -s '$ROOT_DIR/scripts/verify-phase1-smoke.sql' '$FAKE_ROOT/$SPACE_REL/scripts/verify-phase1-smoke.sql'"
check "the client version was asked of the container" "grep -qF 'pg_service_1 psql --version' '$FAKE_DOCKER_LOG'"

echo "Replay and smoke"
check "replay succeeds" "run replay"
if grep -q '^RECORDED' "$FAKE_PSQL_LOG"; then
  echo "  note  this bash is ${BASH_VERSINFO[0]}.x, so verify-migration-replay.sh was recorded, not executed"
  check "the replay script is started in the workspace with the unchanged URL" \
    "grep -qF 'RECORDED|$FAKE_ROOT/$SPACE_REL|scripts/verify-migration-replay.sh|$URL' '$FAKE_PSQL_LOG'"
else
  check "the storage fixture is applied first" "sed -n '3p' '$FAKE_PSQL_LOG' | grep -qF -- '-f scripts/fixtures/supabase-storage.sql'"
  check "every migration is replayed, in sorted order, starting with the repaired first one" \
    "diff <(grep -oE 'supabase/migrations/[^ ]+\.sql' '$FAKE_PSQL_LOG') <(cd '$ROOT_DIR' && find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print | LC_ALL=C sort) >/dev/null"
  check "every SQL file is run with -X and ON_ERROR_STOP" "! grep -- ' -f ' '$FAKE_PSQL_LOG' | grep -vqF -- '$URL -X -v ON_ERROR_STOP=1 -f '"
  check "the replay script reports the full count" "grep -qF 'all $MIGRATION_COUNT migrations replayed successfully' '$WORK/out'"
  export FAKE_PSQL_FAIL_ON="$(cd "$ROOT_DIR" && find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print | LC_ALL=C sort | sed -n '5p' | sed 's#.*/##')"
  check "a failing migration fails the step" "! run replay && grep -qF 'Migration replay failed after 4 successful migrations' '$WORK/out'"
  unset FAKE_PSQL_FAIL_ON
fi
: > "$FAKE_PSQL_LOG"
check "smoke succeeds" "run smoke"
check "the whole smoke file is run in the workspace with the same flags and URL" \
  "[[ \"\$(cat '$FAKE_PSQL_LOG')\" == '$FAKE_ROOT/$SPACE_REL|$URL -X -v ON_ERROR_STOP=1 -f scripts/verify-phase1-smoke.sql' ]]"
export FAKE_PSQL_FAIL_ON="verify-phase1-smoke.sql"
check "a failing smoke file fails the step" "! run smoke"

echo "Refusals"
reset; export CONTAINER=""
refused "no container id" prepare "REPLAY_POSTGRES_CONTAINER is not set"
reset; export CONTAINER='pg; rm -rf /'
refused "something that is not a container id" prepare "is not a container id or name"
reset; export DB_URL="postgresql://supabase_admin:postgres@db.example.supabase.co:5432/postgres"
refused "a database that is not localhost" prepare "isolated localhost database"
refused "a database that is not localhost, at the smoke step" smoke "isolated localhost database"
refused "a database that is not localhost, at the replay step" replay "isolated localhost database"
reset; export DB_URL="$URL?options=-csearch_path=x"
refused "a URL carrying connection options" prepare "connection-option overrides"
reset; export DB_URL=""
refused "no database URL" prepare "MIGRATION_DATABASE_URL is required"
reset
refused "an unknown subcommand" everything "usage:"
reset; export FAKE_MISSING_TOOL="psql"
refused "a container with no psql" prepare "has no 'psql'"
reset; export FAKE_MISSING_TOOL="bash"
refused "a container with no bash" prepare "has no 'bash'"
reset; export FAKE_BASH_MAJOR="3"
refused "a container whose bash is too old for the replay script" prepare "4 or later is required"
reset; export FAKE_PSQL_VERSION="psql (PostgreSQL) 15.8 (Ubuntu 15.8-1)"
refused "a PostgreSQL 15 client" prepare "psql is PostgreSQL 15; PostgreSQL 17 is required"
reset; export FAKE_PSQL_VERSION="psql (PostgreSQL) 18.0"
refused "a PostgreSQL 18 client" prepare "psql is PostgreSQL 18; PostgreSQL 17 is required"
reset; export FAKE_PSQL_VERSION="something else entirely"
refused "a client whose version cannot be read" prepare "could not read a version"
reset; export FAKE_SERVER_NUM="150008"
refused "a server of a different major version from the client" prepare "the server is PostgreSQL 15 but the client is PostgreSQL 17"
reset; export FAKE_SERVER_NUM=""
refused "a server that reports no version" prepare "did not report a version number"
reset; export FAKE_DROP_MIGRATION=1
refused "a copy that lost a migration" prepare "the checkout has $MIGRATION_COUNT migrations but the container workspace has $((MIGRATION_COUNT - 1))"
reset; echo "notes" > "$CHECKOUT/supabase/migrations/README.md"
refused "something in the migrations folder that is not a migration" prepare "not a .sql file"
reset; mkdir "$CHECKOUT/supabase/migrations/archive"
refused "a subfolder in the migrations folder" prepare "not a .sql file"
reset; rm "$CHECKOUT/scripts/verify-phase1-smoke.sql"
refused "a checkout with no smoke file" prepare "verify-phase1-smoke.sql is missing"
reset; rm "$CHECKOUT/scripts/fixtures/supabase-storage.sql"
refused "a checkout with no storage fixture" prepare "supabase-storage.sql is missing"

if [[ "$failures" -gt 0 ]]; then
  echo "replay bootstrap: $failures check(s) failed" >&2
  exit 1
fi
echo "replay bootstrap: all checks passed"
