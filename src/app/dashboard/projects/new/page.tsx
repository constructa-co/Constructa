import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NewProjectForm from "./new-project-form";
import { buildJobTypeDatalistOptions, priorProjectTypesFromRows } from "@/lib/job-type-datalist";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    const [{ count }, { data: profile }, { data: priorRows }] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("profiles").select("business_type, specialisms, preferred_trades").eq("id", user.id).single(),
        supabase.from("projects").select("project_type").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);

    const jobTypeDatalistOptions = buildJobTypeDatalistOptions({
        priorProjectTypes: priorProjectTypesFromRows(priorRows ?? []),
        businessType: profile?.business_type,
        specialisms: profile?.specialisms,
        preferredTrades: (profile?.preferred_trades as string[] | null) ?? null,
    });

    return (
        <NewProjectForm
            isFirstProject={(count ?? 0) === 0}
            jobTypeDatalistOptions={jobTypeDatalistOptions}
        />
    );
}
