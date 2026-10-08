import Link from "next/link";
import { redirect } from "next/navigation";
import { caseLibraryEnabled } from "@/lib/case-library/gate";
import { LIBRARY_MESSAGES } from "@/lib/case-library/messages";
import { viewOf } from "@/lib/case-library/service";
import { readStudyAtOneRevision, sessionReader } from "@/lib/case-library/store";
import { CASE_STUDIES_PATH } from "@/lib/first-session";
import { createClient } from "@/lib/supabase/server";
import GuidedCapture from "../../guided-capture";

export const dynamic = "force-dynamic";

/**
 * Go through the questions for one library case study. Signed in first, then
 * the switch. What is shown is what is saved, read with the contractor's own
 * session at one revision: nothing else is remembered between visits.
 */
export default async function GuidedCaseStudyPage(props: { params: Promise<{ id: string }> }) {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");
    if (!caseLibraryEnabled()) redirect(CASE_STUDIES_PATH);

    const { id } = await props.params;
    const read = await readStudyAtOneRevision(sessionReader(supabase), user.id, id);
    const problem = read.state === "ok" ? (read.study.archived ? "This case study is archived. Bring it back on the Case Studies page first." : null) : read.state === "missing" ? LIBRARY_MESSAGES.notFound : read.state === "changing" ? LIBRARY_MESSAGES.changingOnOpen : LIBRARY_MESSAGES.unavailable;

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            {read.state !== "ok" || problem ? (
                <div className="space-y-3">
                    <p role="status" className="text-base text-amber-200">{problem}</p>
                    <Link href={CASE_STUDIES_PATH} className="inline-flex items-center min-h-11 text-base font-semibold text-blue-200 underline underline-offset-4">Back to case studies</Link>
                </div>
            ) : (
                <GuidedCapture initial={viewOf(read.study, read.disciplines)} disciplines={read.disciplines} basePath={`${CASE_STUDIES_PATH}/library`} listHref={CASE_STUDIES_PATH} />
            )}
        </div>
    );
}
