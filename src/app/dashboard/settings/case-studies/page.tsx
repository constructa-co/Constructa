import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PROPOSAL_READINESS_PATH } from "@/lib/first-session";
import { caseLibraryEnabled } from "@/lib/case-library/gate";
import { legacyCaseStudies } from "@/lib/case-library/legacy";
import { viewOf } from "@/lib/case-library/service";
import { sessionReader } from "@/lib/case-library/store";
import CaseStudiesClient from "./case-studies-client";
import LibraryPanel from "./library-panel";

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

    // The library is read only when it is switched on, and with the
    // contractor's own session. Switched off, this page is exactly as it was.
    const library = caseLibraryEnabled() ? await sessionReader(supabase).library(user.id) : null;

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
            {library && (
                <div className="mb-8 space-y-4" data-case-library>
                    <LibraryPanel
                        available={library.state === "ok"}
                        studies={library.state === "ok" ? library.value.studies.map((study) => viewOf(study, library.value.disciplines)) : []}
                        disciplines={library.state === "ok" ? library.value.disciplines : []}
                        older={legacyCaseStudies(profile?.case_studies).map((entry) => ({ index: entry.index, title: entry.title }))}
                        basePath="/dashboard/settings/case-studies/library"
                    />
                    <div>
                        <h2 className="text-xl font-bold text-slate-100">Older case studies</h2>
                        <p className="text-sm text-slate-300 mt-1">These work as they always have, and can include pictures. Changes here are saved with the button at the bottom of this section.</p>
                    </div>
                </div>
            )}
            <CaseStudiesClient
                initialCaseStudies={profile?.case_studies || []}
                userId={user.id}
            />
        </div>
    );
}
