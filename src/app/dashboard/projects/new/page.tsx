import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NewProjectWizard from "./new-project-wizard";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("business_type")
        .eq("id", user.id)
        .single();

    return <NewProjectWizard businessType={profile?.business_type || null} />;
}
