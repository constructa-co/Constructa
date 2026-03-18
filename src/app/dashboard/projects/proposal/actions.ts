"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function saveProposalAction(formData: FormData) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return { success: false };

    const id = formData.get("projectId") as string;

    await supabase.from("projects").update({
        scope_text: formData.get("scope"),
        exclusions_text: formData.get("exclusions"),
        clarifications_text: formData.get("clarifications")
    }).eq("id", id).eq("user_id", user.id);

    revalidatePath(`/dashboard/projects/proposal?projectId=${id}`);
    return { success: true };
}

export async function generateAiScopeAction(projectId: string) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return "Error: Not authenticated.";

    const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

    if (!project) return "Error: Project not found or unauthorized.";

    const { data: estimates } = await supabase
        .from("estimates")
        .select("*, estimate_lines(*)")
        .eq("project_id", projectId);

    if (!estimates || estimates.length === 0) return "Error: No Estimates found.";

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");

    const genAI = new GoogleGenerativeAI(apiKey);

    let itemsList = "";
    estimates.forEach(est => {
        itemsList += `\n[PHASE: ${est.version_name}]\n`;
        if (est.estimate_lines) {
            est.estimate_lines.forEach((l: any) => {
                itemsList += `- ${l.description} (${l.quantity} ${l.unit})\n`;
            });
        }
    });

    const prompt = `
    ROLE: You are an expert Construction Estimator / Senior Quantity Surveyor.
    CLIENT: ${project?.client_name || "Valued Client"}
    PROJECT TYPE: ${project?.project_type || "Construction Works"}
    SITE ADDRESS: ${project?.address || "As per project details"}
    
    BILL OF QUANTITIES DATA:
    ${itemsList}
    
    INSTRUCTION: Write a professional, comprehensive construction proposal.
    Return ONLY a JSON object with:
    1. "scope_narrative": A full technical narrative (3+ paragraphs).
    2. "suggested_exclusions": An array of at least 5 standard exclusions based on this work.
    3. "suggested_clarifications": An array of at least 3 technical clarifications.

    TONAL RULES:
    - Use "The Contractor" and "The Client".
    - Professional, authoritative UK construction tone.
    - NO prices or currency symbols.
    `;

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const result = await model.generateContent(prompt);
        const response = JSON.parse(result.response.text());

        // Return all three structured fields so the UI can populate each section
        return {
            scope_narrative: response.scope_narrative || "",
            suggested_exclusions: Array.isArray(response.suggested_exclusions)
                ? response.suggested_exclusions.join("\n")
                : "",
            suggested_clarifications: Array.isArray(response.suggested_clarifications)
                ? response.suggested_clarifications.join("\n")
                : "",
        };
    } catch (error: any) {
        console.error("AI Error:", error);
        return { scope_narrative: `Error generating scope: ${error.message}`, suggested_exclusions: "", suggested_clarifications: "" };
    }
}
