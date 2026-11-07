import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { latestImportDraft } from "@/lib/company-import/service";
import ImportClient from "./import-client";

export const dynamic = "force-dynamic";

export default async function CompanyImportPage() {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    const [{ data: profile }, draft] = await Promise.all([
        supabase.from("profiles").select("website").eq("id", user.id).single(),
        latestImportDraft({ supabase, userId: user.id }),
    ]);

    return <ImportClient initialDraft={draft} savedWebsite={profile?.website ?? ""} />;
}
