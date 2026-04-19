import { createClient } from "./server";

/**
 * Defence-in-depth auth check for server actions.
 *
 * Sprint 58 Phase 1 item #2. Perplexity's audit found that ~60% of mutating
 * server actions rely solely on Supabase RLS as their defence layer. RLS is
 * strong but has failed before (see migration `20260324000006` which fixed a
 * circular dependency in the org_members policies). If RLS breaks again,
 * every unguarded action in `costs/`, `billing/`, `proposal/`, etc. becomes
 * exploitable.
 *
 * `requireAuth()` is the cheap, consistent second line of defence:
 *
 *   ```ts
 *   import { requireAuth } from "@/lib/supabase/auth-utils";
 *
 *   export async function myMutatingAction(...) {
 *     const { user, supabase } = await requireAuth();
 *     // `user` is guaranteed non-null from here on.
 *     // `supabase` is a ready-to-use server client bound to the request.
 *     ...
 *   }
 *   ```
 *
 * It throws `"Unauthorized: No user found."` on a missing session — the same
 * message `getActiveOrganizationId()` already throws, so existing error
 * handling paths continue to work unchanged.
 *
 * Return type is intentionally inferred from `createClient()` so the server
 * client remains fully typed against the rest of the codebase.
 */
export async function requireAuth() {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        throw new Error("Unauthorized: No user found.");
    }
    return {
        user: { id: user.id, email: user.email ?? undefined },
        supabase,
    };
}

/**
 * Defence-in-depth project-ownership check for server actions.
 *
 * Stage 4 of the 2026-04-19 hardening brief. Many mutating actions take a
 * `projectId` from the client and then issue an UPDATE/INSERT/DELETE scoped
 * only by row id — trusting Supabase RLS alone to reject cross-project
 * writes. RLS is correct today, but a future policy regression would widen
 * write scope silently. This helper adds the explicit second layer:
 *
 *   ```ts
 *   import { requireProjectAccess } from "@/lib/supabase/auth-utils";
 *
 *   export async function myProjectScopedAction(projectId: string, ...) {
 *     const { supabase } = await requireProjectAccess(projectId);
 *     // From here we have verified that auth.uid() = projects.user_id for
 *     // this projectId. Continue with the mutation, preferably also adding
 *     // .eq("project_id", projectId) as a row-level anchor.
 *     ...
 *   }
 *   ```
 *
 * Throws `"Unauthorized project access."` on any failure (no session,
 * project not found, project owned by another user). The message is
 * intentionally generic so we do not leak project-existence signals to an
 * unauthenticated caller.
 *
 * Does NOT replace RLS — it runs alongside it.
 */
export async function requireProjectAccess(projectId: string) {
    const { user, supabase } = await requireAuth();

    const { data: project, error } = await supabase
        .from("projects")
        .select("id, user_id")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

    if (error || !project) {
        throw new Error("Unauthorized project access.");
    }

    return { user, supabase, project };
}

/**
 * Fetches the current user's active organization ID.
 * This is the source of truth for all organization-level data filtering.
 */
export async function getActiveOrganizationId() {
    const supabase = createClient();

    // 1. Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        throw new Error("Unauthorized: No user found.");
    }

    // 2. Get the active organicaton from the profile
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("active_organization_id")
        .eq("id", user.id)
        .single();

    if (profileError || !profile?.active_organization_id) {
        // Fallback: If no active org is set, pick the first one they are a member of
        const { data: membership, error: memberError } = await supabase
            .from("organization_members")
            .select("organization_id")
            .eq("user_id", user.id)
            .limit(1)
            .single();

        if (memberError || !membership) {
            throw new Error("No organization found for this user.");
        }

        // Auto-update the profile for next time
        await supabase
            .from("profiles")
            .update({ active_organization_id: membership.organization_id })
            .eq("id", user.id);

        return membership.organization_id;
    }

    return profile.active_organization_id;
}
