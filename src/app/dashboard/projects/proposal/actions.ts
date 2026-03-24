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

    const updateData: Record<string, any> = {
        scope_text: formData.get("scope"),
        exclusions_text: formData.get("exclusions"),
        clarifications_text: formData.get("clarifications"),
        proposal_introduction: formData.get("proposal_introduction"),
    };

    // Gantt phases
    const ganttRaw = formData.get("gantt_phases") as string;
    if (ganttRaw) {
        try { updateData.gantt_phases = JSON.parse(ganttRaw); } catch { /* skip */ }
    }

    // T&C overrides
    const tcRaw = formData.get("tc_overrides") as string;
    if (tcRaw) {
        try { updateData.tc_overrides = JSON.parse(tcRaw); } catch { /* skip */ }
    } else {
        updateData.tc_overrides = null;
    }

    // Site photos
    const photosRaw = formData.get("site_photos") as string;
    if (photosRaw) {
        try { updateData.site_photos = JSON.parse(photosRaw); } catch { /* skip */ }
    }

    // Generate proposal_token if it doesn't exist yet
    const { data: existing } = await supabase
        .from("projects")
        .select("proposal_token")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (!existing?.proposal_token) {
        updateData.proposal_token = crypto.randomUUID();
    }

    await supabase.from("projects").update(updateData).eq("id", id).eq("user_id", user.id);

    revalidatePath(`/dashboard/projects/proposal?projectId=${id}`);
    return { success: true };
}

export async function sendProposalAction(projectId: string) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return { success: false };

    // Get or generate token
    const { data: project } = await supabase
        .from("projects")
        .select("proposal_token")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

    let token = project?.proposal_token;
    if (!token) {
        token = crypto.randomUUID();
        await supabase.from("projects").update({
            proposal_token: token,
            proposal_sent_at: new Date().toISOString(),
        }).eq("id", projectId).eq("user_id", user.id);
    } else {
        await supabase.from("projects").update({
            proposal_sent_at: new Date().toISOString(),
        }).eq("id", projectId).eq("user_id", user.id);
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://constructa-nu.vercel.app";
    return { success: true, url: `${baseUrl}/proposal/${token}` };
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
