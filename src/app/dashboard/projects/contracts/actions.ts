"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function generateContractAction(projectId: string) {
    const supabase = createClient();
    const orgId = await getActiveOrganizationId();

    // 1. Fetch Project and Estimate Data
    const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("organization_id", orgId)
        .single();
    
    if (!project) throw new Error("Project not found or unauthorized.");

    const { data: estimates } = await supabase
        .from("estimates")
        .select("total_cost, version_name")
        .eq("project_id", projectId)
        .eq("organization_id", orgId)
        .order('created_at', { ascending: false });

    const latestEstimate = estimates?.[0];
    const contractSum = latestEstimate?.total_cost || 0;

    // 2. Initialize Gemini
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: {
            responseMimeType: "application/json",
        }
    });

    const prompt = `
        ROLE: Senior Construction Lawyer / Expert Contract Administrator.
        TASK: Generate a professional construction contract agreement.
        
        PROJECT DATA:
        - CLIENT: ${project.name}
        - SITE ADDRESS: ${project.address || "As specified"}
        - CONTRACT SUM: £${contractSum.toLocaleString('en-GB')}
        - SCOPE: ${project.scope_text || "As per proposal"}
        
        Return ONLY a JSON object with:
        "contract_html": The full contract text in professional formatting.
        "summary": A 2-sentence summary of the terms.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = JSON.parse(result.response.text());
        return response.contract_html;
    } catch (error: any) {
        console.error("Contract Generation Error:", error);
        throw new Error(`Failed to generate contract: ${error.message}`);
    }
}

export async function saveContractAction(projectId: string, contractText: string) {
    const supabase = createClient();
    const orgId = await getActiveOrganizationId();

    const { error } = await supabase.from("projects").update({
        contract_text: contractText
    }).eq("id", projectId).eq("organization_id", orgId);

    if (error) throw new Error(error.message);

    revalidatePath(`/dashboard/projects/contracts?projectId=${projectId}`);
    return { success: true };
}
