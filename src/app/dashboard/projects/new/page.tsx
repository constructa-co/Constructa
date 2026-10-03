import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NewProjectForm from "./new-project-form";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    const { count } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

    return <NewProjectForm isFirstProject={(count ?? 0) === 0} />;
}
