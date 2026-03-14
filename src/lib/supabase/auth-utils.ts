import { createClient } from "./server";

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
