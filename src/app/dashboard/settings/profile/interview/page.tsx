import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { loadInterview } from "@/lib/company-interview/service";
import InterviewClient from "./interview-client";

export const dynamic = "force-dynamic";

export default async function CompanyInterviewPage() {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect("/login");

    return <InterviewClient initialState={await loadInterview({ supabase, userId: user.id })} />;
}
