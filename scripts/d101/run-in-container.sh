#!/usr/bin/env bash
# Copies the D101 drill files into the replay workspace that
# scripts/ci-replay-in-container.sh prepare already created inside the job's
# disposable Postgres service container, then runs the drill there.
#   REPLAY_POSTGRES_CONTAINER   service container id
#   MIGRATION_DATABASE_URL      isolated localhost database
set -euo pipefail
WORKSPACE="/tmp/constructa-replay"
container="${REPLAY_POSTGRES_CONTAINER:-}"
url="${MIGRATION_DATABASE_URL:-}"
die() { echo "D101 BOOTSTRAP FAILURE: $*" >&2; exit 1; }
[[ "$container" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || die "REPLAY_POSTGRES_CONTAINER is not a container id or name."
[[ -n "$url" && "$url" != *'?'* && "$url" != *'#'* ]] || die "MIGRATION_DATABASE_URL is required without overrides."
case "$url" in
  postgresql://*@localhost:*/*|postgres://*@localhost:*/*) ;;
  *) die "the database must be an isolated localhost database." ;;
esac
docker exec --user 0 "$container" sh -c "mkdir -p '$WORKSPACE/scripts/d101' '$WORKSPACE/scripts/rollback/d36-markup-method'"
docker cp scripts/d101/markup-undo-drill.sh "$container:$WORKSPACE/scripts/d101/markup-undo-drill.sh"
docker cp scripts/d101/schema-snapshot.sql "$container:$WORKSPACE/scripts/d101/schema-snapshot.sql"
for f in down-20261115120000-markup-columns.sql down-20261116140000-phase1-graph-rpc.sql; do
  docker cp "scripts/rollback/d36-markup-method/$f" "$container:$WORKSPACE/scripts/rollback/d36-markup-method/$f"
done
docker exec --user 0 "$container" chmod -R a+rX "$WORKSPACE"
docker exec -i -w "$WORKSPACE" -e "MIGRATION_DATABASE_URL=$url" "$container" bash scripts/d101/markup-undo-drill.sh
