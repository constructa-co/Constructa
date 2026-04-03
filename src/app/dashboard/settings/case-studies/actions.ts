"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateText } from "@/lib/ai";

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

export async function enhanceCaseStudyAction(
    whatWeDelivered: string,
    valueAdded: string,
    projectName: string,
    projectType: string
): Promise<{ whatWeDelivered: string; valueAdded: string }> {
    const deliveredPrompt = `Rewrite this construction case study "What We Delivered" section to be more compelling and professional for a UK construction proposal PDF. Keep it to 3-4 sentences. Project: ${projectName} (${projectType}). Original: "${whatWeDelivered}"`;
    const valuePrompt = `Rewrite this construction case study "Value Added" section to be more compelling and highlight unique benefits for a UK construction proposal PDF. Keep it to 2-3 sentences. Project: ${projectName} (${projectType}). Original: "${valueAdded}"`;

    const [enhancedDelivered, enhancedValue] = await Promise.all([
        whatWeDelivered.trim().length > 10 ? generateText(deliveredPrompt) : Promise.resolve(whatWeDelivered),
        valueAdded.trim().length > 10 ? generateText(valuePrompt) : Promise.resolve(valueAdded),
    ]);

    return { whatWeDelivered: enhancedDelivered, valueAdded: enhancedValue };
}
