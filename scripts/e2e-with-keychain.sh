#!/usr/bin/env bash
# Runs a command with the disposable E2E project's values taken from the
# macOS Keychain, so they never sit in a file or in shell history.
#
#   E2E_SUPABASE_PROJECT_REF=<disposable ref> scripts/e2e-with-keychain.sh npm run e2e:smoke
#
# The values are exported to the child process only. The harness itself
# (e2e/support/env.ts) then refuses to run unless they name the approved
# disposable project.
set -euo pipefail

account="constructa-e2e-pr79"

read_secret() {
    security find-generic-password -a "$account" -s "$1" -w 2>/dev/null || {
        echo "E2E CONFIGURATION FAILURE: Keychain item '$1' was not found." >&2
        exit 2
    }
}

NEXT_PUBLIC_SUPABASE_URL="$(read_secret "Constructa Supabase E2E PR79 URL")"
NEXT_PUBLIC_SUPABASE_ANON_KEY="$(read_secret "Constructa Supabase E2E PR79 Anon Key")"
SUPABASE_SERVICE_ROLE_KEY="$(read_secret "Constructa Supabase E2E PR79 Service Role Key")"
export NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY

# The sentinel is stated by the operator, never derived from the values above:
# it is the independent statement of which project this run may write to.
if [ -z "${E2E_SUPABASE_PROJECT_REF:-}" ]; then
    echo "E2E CONFIGURATION FAILURE: set E2E_SUPABASE_PROJECT_REF to the disposable project reference." >&2
    exit 2
fi

exec "$@"
