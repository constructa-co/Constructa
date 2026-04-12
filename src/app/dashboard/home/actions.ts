"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";

/** Mark the onboarding tour as seen so it never shows again. */
export async function dismissOnboardingAction(): Promise<void> {
    const { user, supabase } = await requireAuth();
    await supabase
        .from("profiles")
        .update({ onboarding_seen_at: new Date().toISOString() })
        .eq("id", user.id);
}
