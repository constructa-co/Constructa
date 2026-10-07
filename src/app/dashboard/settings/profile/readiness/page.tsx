import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { buildCompanyReadiness } from "@/lib/company-readiness";
import ReadinessClient from "./readiness-client";

export const dynamic = "force-dynamic";

export default async function ProposalReadinessPage() {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    const [{ data: profile }, { count }] = await Promise.all([
        supabase
            .from("profiles")
            .select("company_name, business_type, address, phone, sales_phone, sales_email, logo_url, capability_statement, case_studies")
            .eq("id", user.id)
            .single(),
        supabase
            .from("projects")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id),
    ]);

    return <ReadinessClient readiness={buildCompanyReadiness(profile)} hasProjects={(count ?? 0) > 0} />;
}
