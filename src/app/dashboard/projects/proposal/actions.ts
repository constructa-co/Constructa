"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateJSON, generateText } from "@/lib/ai";

// ── Types for AI Wizard ──────────────────────────────────────
export interface ProposalAnswers {
    description: string;
    client: string;
    siteAddress: string;
    value: string;
    startDate: string;
    duration: string; // e.g. "6 weeks"
    extras: string;
}

export interface GanttPhaseResult {
    name: string;
    duration_days: number;
    duration_unit: string;
}

export interface PaymentStageResult {
    stage: string;
    description: string;
    percentage: number;
}

export interface GeneratedProposal {
    introduction: string;
    scope_narrative: string;
    exclusions: string;
    clarifications: string;
    gantt_phases: GanttPhaseResult[];
    payment_stages: PaymentStageResult[];
}

export async function generateFullProposalAction(
    answers: ProposalAnswers,
    projectId: string
): Promise<{ success: false; error: string } | { success: true; data: GeneratedProposal }> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return { success: false, error: "Not authenticated" };

    const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

    const { data: profile } = await supabase
        .from("profiles")
        .select("business_type, specialisms")
        .eq("id", user.id)
        .single();

    if (!project) return { success: false, error: "Project not found" };

    // AI key check handled by generateJSON utility

    const prompt = `You are a senior UK construction quantity surveyor generating a professional proposal.

PROJECT DETAILS:
- Description: ${answers.description}
- Client: ${answers.client || project?.client_name || "The Client"}
- Site: ${answers.siteAddress || project?.site_address || "As agreed"}
- Value: £${answers.value || project?.potential_value || "TBC"}
- Start: ${answers.startDate || "TBC"}
- Duration: ${answers.duration}
- Highlights/Exclusions: ${answers.extras || "None specified"}
- Contractor Trade: ${profile?.business_type || "General Contractor"}
- Contractor Specialisms: ${profile?.specialisms || "Construction Works"}

Generate a complete proposal package. Return ONLY valid JSON:
{
  "introduction": "2-sentence personalised opening paragraph starting with Dear [Client],",
  "scope_narrative": "3 professional paragraphs describing the works technically",
  "exclusions": "item1\nitem2\nitem3\nitem4\nitem5",
  "clarifications": "item1\nitem2\nitem3",
  "gantt_phases": [{"name": "Phase Name", "duration_days": 14, "duration_unit": "Weeks"}],
  "payment_stages": [{"stage": "Stage Name", "description": "trigger description", "percentage": 20}]
}

Rules:
- Use "The Contractor" and "The Client" throughout
- Professional UK construction tone
- gantt_phases: 4-6 phases appropriate to the work type
- payment_stages: 4-5 stages, percentages must sum to exactly 100
- Return ONLY the JSON object, no markdown`;

    try {
        const parsed = await generateJSON<GeneratedProposal>(prompt);

        // Normalise gantt phases — ensure duration_days is set
        const ganttPhases = (parsed.gantt_phases || []).map((p, i) => ({
            id: String(Date.now() + i),
            name: p.name,
            start_date: answers.startDate || "",
            duration_days: p.duration_days || 14,
            duration_unit: (p.duration_unit as "Hours" | "Days" | "Weeks") || "Weeks",
            color: ["blue", "green", "orange", "purple", "slate", "red"][i % 6],
        }));

        const paymentStages = (parsed.payment_stages || []).map((p, i) => ({
            id: String(Date.now() + i + 100),
            stage: p.stage,
            description: p.description,
            percentage: p.percentage,
        }));

        // Persist to DB immediately
        await supabase.from("projects").update({
            scope_text: parsed.scope_narrative,
            exclusions_text: parsed.exclusions,
            clarifications_text: parsed.clarifications,
            proposal_introduction: parsed.introduction,
            gantt_phases: ganttPhases,
            payment_schedule: paymentStages,
        }).eq("id", projectId).eq("user_id", user.id);

        revalidatePath(`/dashboard/projects/proposal?projectId=${projectId}`);

        return {
            success: true,
            data: {
                introduction: parsed.introduction,
                scope_narrative: parsed.scope_narrative,
                exclusions: parsed.exclusions,
                clarifications: parsed.clarifications,
                gantt_phases: ganttPhases,
                payment_stages: paymentStages,
            },
        };
    } catch (error: any) {
        console.error("generateFullProposalAction error:", error);
        return { success: false, error: error.message };
    }
}

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

    // Payment schedule
    const paymentRaw = formData.get("payment_schedule") as string;
    if (paymentRaw) {
        try { updateData.payment_schedule = JSON.parse(paymentRaw); } catch { /* skip */ }
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
    if (!user) return { scope_narrative: "Error: Not authenticated.", suggested_exclusions: "", suggested_clarifications: "" };

    const { data: project } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

    if (!project) return { scope_narrative: "Error: Project not found or unauthorized.", suggested_exclusions: "", suggested_clarifications: "" };

    const { data: estimates } = await supabase
        .from("estimates")
        .select("*, estimate_lines(*)")
        .eq("project_id", projectId);

    // AI via OpenAI utility

    // Build context from all available info
    let contextSection = "";

    if (estimates && estimates.length > 0) {
        let itemsList = "";
        estimates.forEach(est => {
            itemsList += `\n[PHASE: ${est.version_name}]\n`;
            if (est.estimate_lines) {
                est.estimate_lines.forEach((l: any) => {
                    itemsList += `- ${l.description} (${l.quantity} ${l.unit})\n`;
                });
            }
        });
        contextSection = `BILL OF QUANTITIES:\n${itemsList}`;
    } else {
        contextSection = `NOTE: No detailed bill of quantities available. Use project type and scope to generate a professional narrative.`;
    }

    // Add gantt phases if available
    let timelineSection = "";
    if (project.gantt_phases?.length) {
        timelineSection = `\nPROJECT PHASES:\n${project.gantt_phases.map((p: any) => `- ${p.name}`).join("\n")}`;
    }

    // Add existing scope if available
    let existingScopeSection = "";
    if (project.scope_text?.trim()) {
        existingScopeSection = `\nEXISTING SCOPE NOTES:\n${project.scope_text}`;
    }

    const prompt = `
    ROLE: You are an expert Construction Estimator / Senior Quantity Surveyor writing a professional proposal.
    CLIENT: ${project?.client_name || "Valued Client"}
    PROJECT TYPE: ${project?.project_type || "Construction Works"}
    SITE ADDRESS: ${project?.site_address || project?.client_address || "As per project details"}

    ${contextSection}
    ${timelineSection}
    ${existingScopeSection}

    INSTRUCTION: Based on the following project information, write a professional scope of works narrative.
    Return ONLY a JSON object with:
    1. "scope_narrative": A full technical narrative (3+ paragraphs).
    2. "suggested_exclusions": An array of at least 5 standard exclusions based on this work type.
    3. "suggested_clarifications": An array of at least 3 technical clarifications.

    TONAL RULES:
    - Use "The Contractor" and "The Client".
    - Professional, authoritative UK construction tone.
    - NO prices or currency symbols.
    `;

    try {
        const response = await generateJSON<{scope_narrative: string; suggested_exclusions: string[]; suggested_clarifications: string[]}>(prompt);

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

export async function rewriteIntroductionAction(projectId: string, currentText: string) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return { error: "Not authenticated" };

    // AI via OpenAI utility

    const prompt = `Rewrite this contractor proposal introduction to be more professional and persuasive, maintaining the factual content. Return plain text only, no markdown, no JSON.

Original text:
${currentText}`;

    try {
        const text = await generateText(prompt);
        return { text };
    } catch (error: any) {
        return { error: error.message };
    }
}

export async function extractScopeBulletsAction(scopeText: string): Promise<string[]> {
    if (!scopeText || scopeText.length <= 100) return [];
    try {
        const result = await generateJSON<{ bullets: string[] }>(
            `Extract 5-7 concise scope-of-works bullet points from this construction project scope text.
             Each bullet should be a short actionable deliverable (max 10 words).
             Return JSON with key "bullets" containing an array of strings.
             Scope text: ${scopeText.substring(0, 1500)}`
        );
        return result.bullets || [];
    } catch {
        return [];
    }
}

export async function saveWizardResultsAction(projectId: string, data: {
    proposal_introduction?: string;
    scope_text?: string;
    exclusions_text?: string;
    clarifications_text?: string;
    gantt_phases?: any[];
    payment_schedule?: any[];
}) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase
        .from("projects")
        .update(data)
        .eq("id", projectId)
        .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };
    revalidatePath(`/dashboard/projects/proposal?projectId=${projectId}`);
    return { success: true };
}

export async function generateClarificationsAction(
    projectType: string,
    scopeText: string,
    existingClarifications: string
): Promise<{ clarifications: string }> {
    const prompt = `You are an expert construction contract manager. Generate 5-7 professional clarifications for a construction proposal.
  Project type: ${projectType}
  Scope: ${scopeText?.substring(0, 500) || 'Not provided'}

  Clarifications are items the contractor needs the client to confirm or that set out the basis of the quote.
  Examples: "Works based on drawings ref X dated Y", "Assumes clear site access 7am-6pm", "PC sums allowances for X", "Excludes statutory utility diversions unless stated"

  Return as a bullet list, one clarification per line, starting each with "- ".
  Keep each clarification concise (one sentence). Make them specific to the project type.`;

    const text = await generateText(prompt);
    return { clarifications: text };
}

export async function generateExclusionsAction(
    projectType: string,
    scopeText: string
): Promise<{ exclusions: string }> {
    const prompt = `You are an expert construction contract manager. Generate 5-8 standard exclusions for a construction proposal.
  Project type: ${projectType}
  Scope: ${scopeText?.substring(0, 500) || 'Not provided'}

  Exclusions are items NOT included in the contractor's price.
  Examples: "Planning and Building Control fees", "Floor finishes and decorating", "Furniture and soft furnishings", "External landscaping beyond the site boundary"

  Return as a bullet list, one exclusion per line, starting each with "- ".
  Keep each exclusion concise. Make them specific to the project type.`;

    const text = await generateText(prompt);
    return { exclusions: text };
}

export async function updatePaymentScheduleTypeAction(projectId: string, type: string) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase
        .from("projects")
        .update({ payment_schedule_type: type })
        .eq("id", projectId)
        .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };
    revalidatePath(`/dashboard/projects/proposal?projectId=${projectId}`);
    return { success: true };
}

export async function updateCaseStudySelectionAction(projectId: string, selectedIds: (number | string)[]) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase
        .from("projects")
        .update({ selected_case_study_ids: selectedIds })
        .eq("id", projectId)
        .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };
    revalidatePath(`/dashboard/projects/proposal?projectId=${projectId}`);
    return { success: true };
}

export async function uploadPhotoAction(formData: FormData) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return { error: "Not authenticated" };

    const file = formData.get("file") as File;
    const projectId = formData.get("projectId") as string;

    if (!file) return { error: "No file provided" };

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${projectId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
        .from("proposal-photos")
        .upload(path, file, { upsert: true });

    if (error) return { error: error.message };

    const { data } = supabase.storage.from("proposal-photos").getPublicUrl(path);
    return { url: data.publicUrl };
}
