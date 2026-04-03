"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateCaseStudiesAction(caseStudies: any[]) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase
        .from("profiles")
        .update({ case_studies: caseStudies })
        .eq("id", user.id);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/settings/case-studies");
    return { success: true };
}
