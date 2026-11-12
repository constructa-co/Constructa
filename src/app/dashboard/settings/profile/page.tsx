import { createClient } from "@/lib/supabase/server";
import { redirect, unstable_rethrow } from "next/navigation";
import { Toaster } from "sonner";
import CompanyProfilePresentation from "@/components/company-profile-presentation";
import ProfileForm from "./profile-form";

export const dynamic = "force-dynamic";

const PROFILE_UNAVAILABLE =
    "Your company profile could not be loaded. Reload the page to try again before editing or saving anything here.";

function ProfileUnavailable({ detail }: { detail: string | null }) {
    return (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-6" role="alert">
            <p className="text-sm text-red-200">{PROFILE_UNAVAILABLE}</p>
            {detail ? <p className="text-xs text-red-300/80 mt-2">{detail}</p> : null}
        </div>
    );
}

export default async function ProfilePage() {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    let profileUnavailable = false;
    let profileDetail: string | null = null;
    let profile: Parameters<typeof ProfileForm>[0]["profile"] | undefined;

    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        if (error || !data) {
            profileUnavailable = true;
            profileDetail = error?.message || "Profile not found.";
        } else {
            profile = data;
        }
    } catch (error) {
        unstable_rethrow(error);
        profileUnavailable = true;
        profileDetail = error instanceof Error ? (error.message || "Unknown error") : "Unknown error";
    }

    return (
        <CompanyProfilePresentation>
            <Toaster richColors position="top-right" />
            {profileUnavailable ? (
                <ProfileUnavailable detail={profileDetail} />
            ) : (
                <ProfileForm profile={profile!} userEmail={user.email || ""} />
            )}
        </CompanyProfilePresentation>
    );
}
