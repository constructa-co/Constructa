import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import CompanyProfilePresentation from "@/components/company-profile-presentation";
import ProfileForm from "./profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    return (
        <CompanyProfilePresentation>
            <Toaster richColors position="top-right" />
            <ProfileForm profile={profile} userEmail={user.email || ""} />
        </CompanyProfilePresentation>
    );
}
