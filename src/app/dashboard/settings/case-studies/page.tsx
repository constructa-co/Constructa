import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CaseStudiesClient from "./case-studies-client";

export const dynamic = "force-dynamic";

export default async function CaseStudiesPage() {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("case_studies, company_name")
        .eq("id", user.id)
        .single();

    return (
        <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-100">Case Studies</h1>
                <p className="text-sm text-slate-500 mt-1">
                    Showcase your past projects. These appear in proposal PDFs to build client confidence.
                </p>
            </div>
            <CaseStudiesClient
                initialCaseStudies={profile?.case_studies || []}
                userId={user.id}
            />
        </div>
    );
}
