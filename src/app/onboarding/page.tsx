import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OnboardingClient from "./onboarding-client";
import { getLaunchLandingPath } from "@/lib/launch-profile";
import { resolvePostSetupPath, resolveSetupStep } from "@/lib/first-session";

export const dynamic = "force-dynamic";

export default async function OnboardingPage(
    props: {
        searchParams?: Promise<{ force?: string }>;
    }
) {
    const searchParams = await props.searchParams;
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) redirect("/login");

    const [{ data: profile }, { count: projectCount }] = await Promise.all([
        supabase
            .from("profiles")
            .select("company_name, full_name, business_type")
            .eq("id", user.id)
            .single(),
        supabase
            .from("projects")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
    ]);

    // Only redirect if company_name is set AND force param is not present
    const forceParam = searchParams?.force;
    const alreadySetUp = !!profile?.company_name;
    if (alreadySetUp && !forceParam) {
        redirect(getLaunchLandingPath());
    }

    return (
        <OnboardingClient
            initialStep={alreadySetUp ? "trade" : resolveSetupStep(profile)}
            initialBusinessType={profile?.business_type || ""}
            initialCompanyName={profile?.company_name || ""}
            initialFullName={profile?.full_name || ""}
            completionPath={resolvePostSetupPath(projectCount ?? 1, getLaunchLandingPath())}
            exitPath={alreadySetUp ? getLaunchLandingPath() : null}
        />
    );
}
