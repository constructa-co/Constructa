import Link from "next/link";
import { redirect } from "next/navigation";
import { caseLibraryEnabled } from "@/lib/case-library/gate";
import { LIBRARY_MESSAGES } from "@/lib/case-library/messages";
import { sessionReader } from "@/lib/case-library/store";
import { CASE_STUDIES_PATH } from "@/lib/first-session";
import { createClient } from "@/lib/supabase/server";
import EditorHost from "../editor-host";

export const dynamic = "force-dynamic";

/** Add a library case study. Signed in first, then the switch; off sends the contractor to the Case Studies page as it is today. */
export default async function NewCaseStudyPage() {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");
    if (!caseLibraryEnabled()) redirect(CASE_STUDIES_PATH);

    const disciplines = await sessionReader(supabase).disciplines(user.id);
    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            {disciplines.state !== "ok" ? (
                <div className="space-y-3">
                    <p role="status" className="text-base text-amber-200">{LIBRARY_MESSAGES.unavailable}</p>
                    <Link href={CASE_STUDIES_PATH} className="inline-flex items-center min-h-11 text-base font-semibold text-blue-200 underline underline-offset-4">Back to case studies</Link>
                </div>
            ) : (
                <EditorHost initial={null} disciplines={disciplines.value} />
            )}
        </div>
    );
}
