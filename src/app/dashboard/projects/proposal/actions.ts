"use server";

import { requireProjectAccess } from "@/lib/supabase/auth-utils";
import { requireEditableProjectAccess } from "@/lib/supabase/project-resource-access";
import { SaveProposalSchema, parseInput } from "@/lib/validation/schemas";
import { revalidatePath } from "next/cache";
import { generateJSON, generateText } from "@/lib/ai";
import { sendProposalEmail } from "@/lib/email";
import {
    buildProposalPublicationSnapshot,
    hashProposalAccessToken,
    hashProposalPublication,
    type ProposalPublicationEstimateInput,
    type ProposalPublicationSnapshot,
} from "@/lib/proposal-publication";
import {
    PROPOSAL_TERMS_PROFILE_VERSION,
    resolveProposalTerms,
    type ProposalTermsClause,
} from "@/lib/proposal-terms";

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
    const { user, supabase } = await requireEditableProjectAccess(projectId);

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
    // Validate the user-editable text fields before touching the DB. We validate
    // only the free-text portions here because the JSONB fields (gantt, photos,
    // T&Cs, payment schedule) are parsed with try/catch below and have their
    // own shape-checking downstream.
    const rawInput = {
        projectId:             formData.get("projectId") ?? "",
        scope:                 (formData.get("scope") as string | null) ?? undefined,
        exclusions:            (formData.get("exclusions") as string | null) ?? undefined,
        clarifications:        (formData.get("clarifications") as string | null) ?? undefined,
        proposal_introduction: (formData.get("proposal_introduction") as string | null) ?? undefined,
    };
    const input = parseInput(SaveProposalSchema, rawInput, "proposal save");
    const id = input.projectId;
    const { user, supabase } = await requireEditableProjectAccess(id);

    const updateData: Record<string, any> = {
        scope_text:            input.scope ?? null,
        exclusions_text:       input.exclusions ?? null,
        clarifications_text:   input.clarifications ?? null,
        proposal_introduction: input.proposal_introduction ?? null,
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

    // Closing statement
    const closingStatement = formData.get("closing_statement") as string;
    if (closingStatement !== null) {
        updateData.closing_statement = closingStatement || null;
    }

    // P0-3 — Proposal validity in days (clamped 1..365 in the UI already)
    const validityRaw = formData.get("validity_days");
    if (validityRaw !== null) {
        const n = parseInt(String(validityRaw), 10);
        if (Number.isFinite(n) && n >= 1 && n <= 365) {
            updateData.validity_days = n;
        }
    }

    const { data: savedProject, error: saveError } = await supabase
        .from("projects")
        .update(updateData)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id")
        .single();
    if (saveError || !savedProject) {
        console.error("saveProposalAction update failed", { projectId: id, code: saveError?.code });
        return { success: false, error: "Could not save the proposal. Your draft remains on screen; please retry." };
    }

    revalidatePath(`/dashboard/projects/proposal?projectId=${id}`);
    return { success: true };
}

export async function getProposalLinkAction(projectId: string) {
    return publishProposal(projectId, false);
}

export async function sendProposalAction(projectId: string) {
    return publishProposal(projectId, true);
}

export async function getCurrentProposalPublicationAction(projectId: string): Promise<
    { success: true; snapshot: ProposalPublicationSnapshot; snapshotHash: string }
    | { success: false; error: string }
> {
    const { user, supabase } = await requireProjectAccess(projectId);
    const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("current_proposal_publication_id")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();
    if (projectError || !project?.current_proposal_publication_id) {
        return { success: false, error: "Publish the proposal before downloading its final PDF." };
    }

    const { data: publication, error: publicationError } = await supabase
        .from("proposal_publications")
        .select("snapshot, snapshot_hash")
        .eq("id", project.current_proposal_publication_id)
        .eq("project_id", projectId)
        .single();
    if (publicationError || !publication?.snapshot) {
        return { success: false, error: "The published proposal could not be loaded." };
    }
    return {
        success: true,
        snapshot: publication.snapshot as ProposalPublicationSnapshot,
        snapshotHash: publication.snapshot_hash,
    };
}

function randomProposalToken(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
        byte.toString(16).padStart(2, "0"),
    ).join("");
}

async function publishProposal(projectId: string, deliverByEmail: boolean) {
    const { user, supabase } = await requireEditableProjectAccess(projectId);

    const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();
    if (projectError || !project) {
        return { success: false, error: "Could not load the proposal for publishing." };
    }

    const { data: estimates, error: estimateError } = await supabase
        .from("estimates")
        .select("*, estimate_lines(id, trade_section, description, quantity, unit, line_total)")
        .eq("project_id", projectId)
        .eq("is_active", true);
    if (estimateError || !estimates || estimates.length !== 1) {
        return {
            success: false,
            error: "Exactly one active estimate is required before publishing this proposal.",
        };
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("company_name, logo_url, phone, website, accreditations, capability_statement, years_trading, specialisms, insurance_details, pdf_theme")
        .eq("id", user.id)
        .single();
    if (profileError || !profile) {
        return { success: false, error: "Complete your company profile before publishing." };
    }

    const { data: latestPublication, error: versionError } = await supabase
        .from("proposal_publications")
        .select("version_number")
        .eq("project_id", projectId)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (versionError) {
        return { success: false, error: "Could not determine the next proposal version." };
    }

    const estimate = estimates[0] as ProposalPublicationEstimateInput;
    const publicationId = crypto.randomUUID();
    const versionNumber = (latestPublication?.version_number ?? 0) + 1;
    const sentAt = new Date().toISOString();
    const validityDays = Math.max(1, Math.min(365, Number(project.validity_days) || 30));
    const token = randomProposalToken();
    let snapshot: ProposalPublicationSnapshot;
    let tokenHash: string;
    let snapshotHash: string;
    try {
        const terms = resolveProposalTerms(project.tc_overrides as ProposalTermsClause[] | null);
        snapshot = buildProposalPublicationSnapshot({
            publicationId,
            versionNumber,
            sentAt,
            validityDays,
            project,
            profile,
            estimate,
            termsProfileVersion: PROPOSAL_TERMS_PROFILE_VERSION,
            resolvedTerms: terms,
            responseMode: "acknowledgement",
            vatRate: project.is_vat_reverse_charge === true ? 0 : 20,
        });
        [tokenHash, snapshotHash] = await Promise.all([
            hashProposalAccessToken(token),
            hashProposalPublication(snapshot),
        ]);
    } catch (publicationError) {
        console.error("Proposal snapshot validation failed", { projectId, publicationError });
        return {
            success: false,
            error: publicationError instanceof Error
                ? publicationError.message
                : "The proposal is incomplete and could not be published.",
        };
    }

    const { error: publishError } = await supabase.rpc("publish_proposal_publication", {
        p_project_id: projectId,
        p_publication_id: publicationId,
        p_estimate_id: estimate.id,
        p_version_number: versionNumber,
        p_token_hash: tokenHash,
        p_snapshot: snapshot,
        p_snapshot_hash: snapshotHash,
        p_contract_sum_ex_vat: snapshot.commercial.contract_sum_ex_vat,
        p_vat_rate: snapshot.commercial.vat_rate,
        p_vat_amount: snapshot.commercial.vat_amount,
        p_contract_sum_inc_vat: snapshot.commercial.contract_sum_inc_vat,
        p_sent_at: snapshot.publication.sent_at,
        p_validity_days: snapshot.publication.validity_days,
        p_expires_at: snapshot.publication.expires_at,
    });
    if (publishError) {
        console.error("publishProposal transaction failed", {
            projectId,
            code: publishError.code,
        });
        return { success: false, error: publishError.message || "Could not publish the proposal." };
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/projects/proposal?projectId=${projectId}`);

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://constructa-nu.vercel.app";
    const url = `${baseUrl}/proposal/${token}`;

    // Delivery starts only after the publication transaction commits. Email
    // failure can never roll back or disguise the immutable sent version.
    if (deliverByEmail && project.client_email) {
        sendProposalEmail({
            clientEmail: project.client_email,
            clientName: project.client_name || "Client",
            projectName: project.name || "Your Project",
            proposalUrl: url,
            companyName: profile?.company_name || "The Contractor",
            siteAddress: project.site_address,
            responseMode: snapshot.publication.response_mode,
        }).catch((e) => console.error("Proposal email send failed:", e));
    }

    return {
        success: true,
        url,
        hasClientEmail: deliverByEmail && !!project.client_email,
        publicationId,
        versionNumber,
    };
}

export async function generateAiScopeAction(projectId: string) {
    const { user, supabase } = await requireEditableProjectAccess(projectId);

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
    await requireEditableProjectAccess(projectId);

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
    const { user, supabase } = await requireEditableProjectAccess(projectId);

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
    const { user, supabase } = await requireEditableProjectAccess(projectId);

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
    const { user, supabase } = await requireEditableProjectAccess(projectId);

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
    const file = formData.get("file") as File;
    const projectId = formData.get("projectId") as string;

    if (!file) return { error: "No file provided" };
    const { user, supabase } = await requireEditableProjectAccess(projectId);

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${projectId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
        .from("proposal-photos")
        .upload(path, file, { upsert: true });

    if (error) return { error: error.message };

    const { data } = supabase.storage.from("proposal-photos").getPublicUrl(path);
    return { url: data.publicUrl };
}

export async function generateClosingStatementAction(
    projectId: string,
    context: {
        companyName: string;
        capability: string;
        projectName: string;
        clientName: string;
        contractValue: number;
        discountPct: number;
        discountReason: string;
        mdName: string;
    }
): Promise<{ text: string }> {
    const { supabase } = await requireEditableProjectAccess(projectId);
    const discount = context.discountPct > 0
        ? `We are also pleased to offer a ${context.discountPct}% ${context.discountReason || 'discount'} on this proposal.`
        : '';

    const text = await generateText(
        `Write a compelling, personal closing statement for a construction proposal "Why Choose Us" page.
    Company: ${context.companyName}
    About the company: ${context.capability?.substring(0, 200) || 'specialist construction contractor'}
    Project: ${context.projectName} for ${context.clientName}
    Contract value: £${context.contractValue.toLocaleString()}
    ${discount}
    ${context.mdName ? `Written from the perspective of ${context.mdName}` : ''}

    Write 2 paragraphs. First: why this company is the right choice (expertise, approach, track record).
    Second: genuine enthusiasm for this project, clear call to action to accept.
    Tone: warm, professional, confident. Avoid cliches. Max 150 words.`
    );

    const { error } = await supabase
        .from("projects")
        .update({ closing_statement: text })
        .eq("id", projectId);
    if (error) throw new Error(error.message);

    return { text };
}

export async function saveClosingStatementAction(projectId: string, text: string) {
    const { supabase } = await requireEditableProjectAccess(projectId);
    const { error } = await supabase
        .from("projects")
        .update({ closing_statement: text })
        .eq("id", projectId);
    if (error) throw new Error(error.message);
}

export async function saveProposalOverridesAction(
    projectId: string,
    overrides: { proposal_capability?: string; proposal_company_name?: string }
) {
    const { supabase } = await requireEditableProjectAccess(projectId);
    const { error } = await supabase
        .from("projects")
        .update(overrides)
        .eq("id", projectId);
    if (error) throw new Error(error.message);
}

// ─── Sprint 22: Proposal Versioning ──────────────────────────────────────────

export interface ProposalVersionRow {
    id: string;
    project_id: string;
    version_number: number;
    notes: string | null;
    snapshot: Record<string, any>;
    created_at: string;
}

/** Snapshot the current proposal state and increment the version number. */
export async function createProposalVersionAction(
    projectId: string,
    notes: string
): Promise<{ success: boolean; error?: string; version_number?: number }> {
    const { user, supabase } = await requireEditableProjectAccess(projectId);

    // Fetch current project (scoped to user)
    // Cast to any to work around stale Supabase generated types (current_version_number added in Sprint 22)
    const { data: projectRaw, error: projectErr } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

    if (projectErr || !projectRaw) return { success: false, error: "Project not found" };
    const project = projectRaw as any;

    const nextVersion = (project.current_version_number || 1) + 1;

    // Build snapshot — everything that represents the proposal at this point in time
    const snapshot: Record<string, any> = {
        scope_text: project.scope_text,
        proposal_introduction: project.proposal_introduction,
        exclusions_text: project.exclusions_text,
        clarifications_text: project.clarifications_text,
        proposal_capability: project.proposal_capability,
        proposal_company_name: project.proposal_company_name,
        closing_statement: project.closing_statement,
        discount_pct: project.discount_pct,
        discount_reason: project.discount_reason,
        tc_tier: project.tc_tier,
        tc_overrides: project.tc_overrides,
        contract_exclusions: project.contract_exclusions,
        contract_clarifications: project.contract_clarifications,
        risk_register: project.risk_register,
        programme_phases: project.programme_phases,
        gantt_phases: project.gantt_phases,
        payment_schedule: project.payment_schedule,
        payment_schedule_type: project.payment_schedule_type,
        selected_case_study_ids: project.selected_case_study_ids,
        potential_value: project.potential_value,
        site_photos: project.site_photos,
    };

    // Insert version row
    const { error: insertErr } = await supabase
        .from("proposal_versions")
        .insert({
            project_id: projectId,
            version_number: nextVersion,
            notes: notes.trim() || null,
            snapshot,
            created_by: user.id,
        });

    if (insertErr) return { success: false, error: insertErr.message };

    // Update projects.current_version_number
    await supabase
        .from("projects")
        .update({ current_version_number: nextVersion })
        .eq("id", projectId)
        .eq("user_id", user.id);

    revalidatePath(`/dashboard/projects/proposal?projectId=${projectId}`);
    return { success: true, version_number: nextVersion };
}

/** Fetch full version history for a project (newest first). */
export async function getProposalVersionsAction(
    projectId: string
): Promise<{ success: boolean; versions?: ProposalVersionRow[]; error?: string }> {
    const { user, supabase } = await requireProjectAccess(projectId);

    // Verify project belongs to user
    const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

    if (!project) return { success: false, error: "Project not found" };

    const { data, error } = await supabase
        .from("proposal_versions")
        .select("id, project_id, version_number, notes, snapshot, created_at")
        .eq("project_id", projectId)
        .order("version_number", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, versions: (data || []) as ProposalVersionRow[] };
}

/** Restore a past version — writes snapshot fields back to the project row. */
export async function restoreProposalVersionAction(
    projectId: string,
    versionId: string
): Promise<{ success: boolean; error?: string }> {
    const { user, supabase } = await requireEditableProjectAccess(projectId);

    // Verify ownership (select * to avoid stale-type issues with new columns)
    const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

    if (!project) return { success: false, error: "Project not found" };

    // Fetch the version
    const { data: version, error: vErr } = await supabase
        .from("proposal_versions")
        .select("snapshot, version_number")
        .eq("id", versionId)
        .eq("project_id", projectId)
        .single();

    if (vErr || !version) return { success: false, error: "Version not found" };

    const snap = version.snapshot as Record<string, any>;

    // Write snapshot fields back to project (exclude any nulls in snapshot)
    const updateFields: Record<string, any> = {};
    const snapshotKeys = [
        "scope_text", "proposal_introduction", "exclusions_text", "clarifications_text",
        "proposal_capability", "proposal_company_name", "closing_statement",
        "discount_pct", "discount_reason", "tc_tier", "tc_overrides",
        "contract_exclusions", "contract_clarifications", "risk_register",
        "programme_phases", "gantt_phases", "payment_schedule", "payment_schedule_type",
        "selected_case_study_ids", "potential_value", "site_photos",
    ];
    snapshotKeys.forEach((k) => {
        if (k in snap) updateFields[k] = snap[k];
    });

    const { error: updateErr } = await supabase
        .from("projects")
        .update(updateFields)
        .eq("id", projectId)
        .eq("user_id", user.id);

    if (updateErr) return { success: false, error: updateErr.message };

    revalidatePath(`/dashboard/projects/proposal?projectId=${projectId}`);
    return { success: true };
}
