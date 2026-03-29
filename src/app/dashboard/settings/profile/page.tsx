import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import ProfileForm from "./profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    return (
        <div className="max-w-4xl mx-auto p-8 pt-12 space-y-8">
            <Toaster richColors position="top-right" />
            <div>
                <h1 className="text-3xl font-bold text-slate-100">Company Profile</h1>
                <p className="text-slate-400 mt-1">
                    This information feeds into every proposal PDF you generate.
                </p>
            </div>
            <ProfileForm profile={profile} userEmail={user.email || ""} />
        </div>
    );
}
