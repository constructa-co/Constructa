import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiWordingOffered } from "@/lib/company-interview/ai-availability";
import { loadInterview } from "@/lib/company-interview/service";
import InterviewClient from "./interview-client";

export const dynamic = "force-dynamic";

export default async function CompanyInterviewPage() {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    // Whether to show the AI wording controls. One settings row; no provider, no budget.
    let aiOffered = false;
    try {
        aiOffered = await aiWordingOffered(createAdminClient());
    } catch {
        // Without the server's own client the answer is no.
    }

    return <InterviewClient initialState={await loadInterview({ supabase, userId: user.id })} aiOffered={aiOffered} />;
}
