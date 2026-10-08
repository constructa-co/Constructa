import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { buildCompanyReadiness } from "@/lib/company-readiness";
import { caseLibraryEnabled } from "@/lib/case-library/gate";
import { sessionReader } from "@/lib/case-library/store";
import ReadinessClient from "./readiness-client";

export const dynamic = "force-dynamic";

export default async function ProposalReadinessPage() {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    const [{ data: profile, error: profileError }, { count, error: projectsError }] = await Promise.all([
        supabase
            .from("profiles")
            .select("company_name, business_type, phone, logo_url, capability_statement, case_studies")
            .eq("id", user.id)
            .single(),
        supabase
            .from("projects")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
    ]);

    if (profileError) throw new Error(`Company profile failed to load: ${profileError.message}`);
    if (projectsError) throw new Error(`Project count failed to load: ${projectsError.message}`);

    // Counts only, with the contractor's own session, and only when the library is switched on.
    // If it cannot be read, readiness is worked out from the older case studies alone, as before.
    const libraryCounts = caseLibraryEnabled() ? await sessionReader(supabase).counts(user.id) : null;
    const library = libraryCounts?.state === "ok" ? libraryCounts.value : null;

    return <ReadinessClient readiness={buildCompanyReadiness(profile, library)} hasProjects={(count ?? 0) > 0} />;
}
