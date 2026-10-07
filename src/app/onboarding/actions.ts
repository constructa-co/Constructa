"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import { redirect } from "next/navigation";
import { sendWelcomeEmail } from "@/lib/email";
import { getLaunchLandingPath } from "@/lib/launch-profile";
import {
    SETUP_SAVE_FALLBACK_ERROR,
    buildSetupPatch,
    resolvePostSetupPath,
    shouldSendWelcomeEmail,
    type SetupStepInput,
} from "@/lib/first-session";

export type SaveSetupStepResult = { ok: true } | { error: string };

/**
 * The one save path for first-time setup. Each step sends only its own
 * answers and only those columns are written, so anything else already on
 * the profile (logo, address, capability statement, insurance, terms) is
 * left exactly as it was.
 *
 * The trade step returns `{ ok: true }`. The business step finishes setup and
 * redirects on the server, so the caller's await never resolves on success.
 */
export async function saveSetupStepAction(input: SetupStepInput): Promise<SaveSetupStepResult> {
    const built = buildSetupPatch(input);
    if (!built.ok) return { error: built.error };

    let userEmail: string | undefined;
    let destination: string | null = null;

    try {
        const { user, supabase } = await requireAuth();
        userEmail = user.email;

        // Finishing setup for the first time is the moment a business name
        // first lands on the profile. Claiming that in a single conditional
        // update means two overlapping submissions cannot both see "first
        // time", so the welcome email cannot be sent twice.
        let companyNameClaimedNow = false;
        if (built.step === "business") {
            const { data: claimed, error: claimError } = await supabase
                .from("profiles")
                .update(built.patch)
                .eq("id", user.id)
                .is("company_name", null)
                .select("id");
            if (claimError) {
                console.error("saveSetupStepAction claim failed", { code: claimError.code, message: claimError.message });
                return { error: SETUP_SAVE_FALLBACK_ERROR };
            }
            companyNameClaimedNow = (claimed?.length ?? 0) > 0;
        }

        if (!companyNameClaimedNow) {
            // Profile row already exists from the signup trigger, so update
            // and confirm a row was actually written.
            const { data: updated, error } = await supabase
                .from("profiles")
                .update(built.patch)
                .eq("id", user.id)
                .select("id");
            if (error || (updated?.length ?? 0) === 0) {
                console.error("saveSetupStepAction failed", { step: built.step, code: error?.code, message: error?.message });
                return { error: SETUP_SAVE_FALLBACK_ERROR };
            }
        }

        if (built.step === "trade") return { ok: true };

        if (shouldSendWelcomeEmail({ step: built.step, companyNameClaimedNow, hasEmail: !!userEmail })
            && userEmail && "company_name" in built.patch) {
            const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://constructa-nu.vercel.app";
            // Fire-and-forget: a mail failure must never block setup.
            sendWelcomeEmail({
                contractorEmail: userEmail,
                fullName: built.patch.full_name || undefined,
                companyName: built.patch.company_name,
                dashboardUrl: `${baseUrl}/dashboard`,
            }).catch((e) => console.error("Welcome email failed:", e));
        }

        // The answers are saved; if this count fails, fall back to the
        // normal landing page rather than reporting a save failure.
        const { count } = await supabase
            .from("projects")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id);
        destination = count === null
            ? getLaunchLandingPath()
            : resolvePostSetupPath(count, getLaunchLandingPath());
    } catch (error) {
        if (error instanceof Error && error.message === "Unauthorized: No user found.") {
            redirect("/login");
        }
        console.error("saveSetupStepAction threw", {
            message: error instanceof Error ? error.message : String(error),
        });
        return { error: SETUP_SAVE_FALLBACK_ERROR };
    }

    // Redirect server-side so navigation cannot be stranded by a client
    // router push that never settles (E2E-01). This throws NEXT_REDIRECT, so
    // it has to sit outside the try block above.
    redirect(destination ?? getLaunchLandingPath());
}
