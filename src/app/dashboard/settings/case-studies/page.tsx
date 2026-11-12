import { createClient } from "@/lib/supabase/server";
import { redirect, unstable_rethrow } from "next/navigation";
import PastWorkFrame from "@/components/past-work-frame";
import { caseLibraryEnabled } from "@/lib/case-library/gate";
import { legacyCaseStudies } from "@/lib/case-library/legacy";
import { viewOf } from "@/lib/case-library/service";
import { sessionReader } from "@/lib/case-library/store";
import CaseStudiesClient from "./case-studies-client";
import type { ComponentProps } from "react";
import LibraryPanel from "./library-panel";

export const dynamic = "force-dynamic";

const CASE_STUDIES_UNAVAILABLE =
    "Your past work could not be loaded. Reload the page to try again before editing or saving anything here.";

function CaseStudiesUnavailable({ detail }: { detail: string | null }) {
    return (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-6" role="alert">
            <p className="text-sm text-red-200">{CASE_STUDIES_UNAVAILABLE}</p>
            {detail ? <p className="text-xs text-red-300/80 mt-2">{detail}</p> : null}
        </div>
    );
}

export default async function CaseStudiesPage() {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    let profileUnavailable = false;
    let profileDetail: string | null = null;
    let profile: { case_studies: unknown; company_name: string | null } | undefined;

    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("case_studies, company_name")
            .eq("id", user.id)
            .single();

        if (error || !data) {
            profileUnavailable = true;
            profileDetail = error?.message || "Profile not found.";
        } else {
            profile = data;
        }
    } catch (error) {
        unstable_rethrow(error);
        profileUnavailable = true;
        profileDetail = error instanceof Error ? (error.message || "Unknown error") : "Unknown error";
    }

    // The library is read only when it is switched on, and with the
    // contractor's own session. Switched off, this page is exactly as it was.
    const library = !profileUnavailable && caseLibraryEnabled() ? await sessionReader(supabase).library(user.id) : null;

    return (
        <PastWorkFrame>
            {profileUnavailable ? (
                <CaseStudiesUnavailable detail={profileDetail} />
            ) : (
                <>
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
                        initialCaseStudies={(profile?.case_studies || []) as ComponentProps<typeof CaseStudiesClient>["initialCaseStudies"]}
                        userId={user.id}
                    />
                </>
            )}
        </PastWorkFrame>
    );
}
