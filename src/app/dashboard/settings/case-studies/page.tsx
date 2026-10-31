import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PROPOSAL_READINESS_PATH } from "@/lib/first-session";
import CaseStudiesClient from "./case-studies-client";

export const dynamic = "force-dynamic";

export default async function CaseStudiesPage() {
    const supabase = await createClient();
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
                <Link href={PROPOSAL_READINESS_PATH} className="mt-2 inline-flex items-center min-h-11 text-sm font-semibold text-blue-400 hover:text-blue-300">
                    See what your proposals can use so far
                </Link>
            </div>
            <CaseStudiesClient
                initialCaseStudies={profile?.case_studies || []}
                userId={user.id}
            />
        </div>
    );
}
