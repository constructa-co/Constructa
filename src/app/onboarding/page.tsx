import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OnboardingClient from "./onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("company_name, full_name, default_tc_overrides")
        .eq("id", user.id)
        .single();

    // If onboarding already done (company_name set), redirect to dashboard
    if (profile?.company_name) {
        redirect("/dashboard");
    }

    return <OnboardingClient initialFullName={profile?.full_name || ""} />;
}
