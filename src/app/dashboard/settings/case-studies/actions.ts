"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveCaseStudiesAction(caseStudies: any[]) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase
        .from("profiles")
        .update({ case_studies: caseStudies })
        .eq("id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard/settings/case-studies");
}
