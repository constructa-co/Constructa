#!/usr/bin/env bash
# Runs the migration replay and the Phase 1 smoke SQL inside the job's own
# Postgres service container, using the client that ships in that image.
#
# Why: the runner used to install postgresql-client-17 with apt before every
# replay. When the package mirror stalls, the job is cancelled before a single
# migration runs. The pinned supabase/postgres image already contains a psql
# of exactly the server's version, so nothing needs downloading.
#
# What is unchanged: the same scripts/verify-migration-replay.sh and
# scripts/verify-phase1-smoke.sql run, unmodified, with the same psql flags,
# against the same localhost database URL. Only where psql comes from changes.
#
# Only four things are copied into the container, into a fresh directory:
# the replay script, the smoke SQL, the storage fixture and the migrations.
#
#   REPLAY_POSTGRES_CONTAINER   the service container id (job.services.postgres.id)
#   MIGRATION_DATABASE_URL      the isolated localhost database
#   REPLAY_EXPECTED_PG_MAJOR    client and server major version required (default 17)
#
#   ci-replay-in-container.sh prepare   check the client, copy the files in
#   ci-replay-in-container.sh replay    run verify-migration-replay.sh
#   ci-replay-in-container.sh smoke     run verify-phase1-smoke.sql
set -euo pipefail

WORKSPACE="/tmp/constructa-replay"
EXPECTED_MAJOR="${REPLAY_EXPECTED_PG_MAJOR:-17}"
container="${REPLAY_POSTGRES_CONTAINER:-}"
url="${MIGRATION_DATABASE_URL:-}"

die() {
  echo "REPLAY BOOTSTRAP FAILURE: $*" >&2
  exit 1
}

case "${1:-}" in
  prepare|replay|smoke) ;;
  *) die "usage: ci-replay-in-container.sh prepare|replay|smoke" ;;
esac

[[ -n "$container" ]] || die "REPLAY_POSTGRES_CONTAINER is not set. Pass the Postgres service container id."
[[ "$container" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || die "REPLAY_POSTGRES_CONTAINER is not a container id or name."
[[ -n "$url" ]] || die "MIGRATION_DATABASE_URL is required."

# The same target rules as verify-migration-replay.sh, applied here as well
# because the smoke step calls psql directly.
if [[ "$url" == *'?'* || "$url" == *'#'* ]]; then
  die "the database URL must not contain connection-option overrides."
fi
case "$url" in
  postgresql://*@localhost:*/*|postgres://*@localhost:*/*) ;;
  *) die "the database must be an isolated localhost database." ;;
esac

command -v docker >/dev/null || die "docker is not available on this runner."

# Everything below runs in the container, in the workspace, with the URL.
in_workspace() {
  docker exec -i -w "$WORKSPACE" -e "MIGRATION_DATABASE_URL=$url" "$container" "$@"
}

prepare() {
  [[ "$EXPECTED_MAJOR" =~ ^[0-9]+$ ]] || die "REPLAY_EXPECTED_PG_MAJOR must be a number."

  local tool
  for tool in bash psql find sed sort mktemp; do
    docker exec "$container" sh -c "command -v $tool >/dev/null" \
      || die "the Postgres container has no '$tool'. The replay cannot run in this image."
  done

  # The replay script uses mapfile, which needs bash 4 or later.
  local bash_major
  bash_major="$(docker exec "$container" bash -c 'echo "${BASH_VERSINFO[0]}"')"
  [[ "$bash_major" =~ ^[0-9]+$ && "$bash_major" -ge 4 ]] \
    || die "the container's bash is version '${bash_major:-unknown}'; 4 or later is required."

  # The client must be the version the migrations are written for.
  local client_version client_major
  client_version="$(docker exec "$container" psql --version)" \
    || die "the container's psql did not report a version."
  client_major="$(printf '%s\n' "$client_version" | sed -n 's/^psql (PostgreSQL) \([0-9][0-9]*\).*/\1/p')"
  [[ -n "$client_major" ]] || die "could not read a version from: $client_version"
  [[ "$client_major" == "$EXPECTED_MAJOR" ]] \
    || die "the container's psql is PostgreSQL $client_major; PostgreSQL $EXPECTED_MAJOR is required. ($client_version)"

  # A fresh workspace holding only what the replay needs.
  docker exec --user 0 "$container" sh -c "rm -rf '$WORKSPACE' && mkdir -p '$WORKSPACE/scripts/fixtures' '$WORKSPACE/supabase'"

  local required
  for required in scripts/verify-migration-replay.sh scripts/verify-phase1-smoke.sql scripts/fixtures/supabase-storage.sql; do
    [[ -f "$required" ]] || die "$required is missing from the checkout."
  done
  [[ -d supabase/migrations ]] || die "supabase/migrations is missing from the checkout."

  # The migrations directory is copied whole, so it must hold migrations only.
  local stray
  stray="$(find supabase/migrations -mindepth 1 ! \( -type f -name '*.sql' \) -print | head -n 5)"
  [[ -z "$stray" ]] || die "supabase/migrations holds something that is not a .sql file: $stray"

  docker cp scripts/verify-migration-replay.sh "$container:$WORKSPACE/scripts/verify-migration-replay.sh"
  docker cp scripts/verify-phase1-smoke.sql "$container:$WORKSPACE/scripts/verify-phase1-smoke.sql"
  docker cp scripts/fixtures/supabase-storage.sql "$container:$WORKSPACE/scripts/fixtures/supabase-storage.sql"
  docker cp supabase/migrations "$container:$WORKSPACE/supabase/migrations"
  docker exec --user 0 "$container" chmod -R a+rX "$WORKSPACE"

  # Every migration in the checkout must have arrived: a short copy would
  # replay a shorter chain and still report success.
  local host_count container_count
  host_count="$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d '[:space:]')"
  container_count="$(in_workspace sh -c "find supabase/migrations -maxdepth 1 -type f -name '*.sql' | wc -l" | tr -d '[:space:]')"
  [[ "$host_count" =~ ^[0-9]+$ && "$host_count" -gt 0 ]] || die "no migrations were found in the checkout."
  [[ "$host_count" == "$container_count" ]] \
    || die "the checkout has $host_count migrations but the container workspace has ${container_count:-none}."

  # Client and server must be the same major version.
  local server_num server_major
  server_num="$(in_workspace psql "$url" -X -v ON_ERROR_STOP=1 -At -c 'SHOW server_version_num')" \
    || die "the container's psql could not reach the replay database."
  server_num="$(printf '%s' "$server_num" | tr -d '[:space:]')"
  [[ "$server_num" =~ ^[0-9]+$ ]] || die "the server did not report a version number."
  server_major=$((server_num / 10000))
  [[ "$server_major" == "$client_major" ]] \
    || die "the server is PostgreSQL $server_major but the client is PostgreSQL $client_major."

  echo "constructa-replay-bootstrap: $client_version, server $server_major, $container_count migrations in $WORKSPACE"
}

case "$1" in
  prepare) prepare ;;
  replay) in_workspace bash scripts/verify-migration-replay.sh ;;
  smoke) in_workspace psql "$url" -X -v ON_ERROR_STOP=1 -f scripts/verify-phase1-smoke.sql ;;
esac
