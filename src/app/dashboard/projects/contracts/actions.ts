"use server";

import { createClient } from "@/lib/supabase/server";
import { generateJSON, generateText } from "@/lib/ai";
import { revalidatePath } from "next/cache";

// ── T&C Tier Management ─────────────────────────────────
export async function saveTcTierAction(projectId: string, tier: string) {
    const supabase = createClient();
    const { error } = await supabase.from("projects").update({ tc_tier: tier }).eq("id", projectId);
    if (error) console.error("Save TC tier error:", error);
    revalidatePath("/dashboard/projects/contracts");
}

// ── Contract Upload & AI Analysis ───────────────────────
export async function analyseContractAction(projectId: string, contractText: string) {
    const supabase = createClient();

    // Save the raw uploaded text
    await supabase.from("projects").update({ uploaded_contract_text: contractText }).eq("id", projectId);

    const flags = await generateJSON<{ flags: Array<{ type: string; clause: string; description: string; severity: string; recommendation: string }> }>(
        `You are a UK construction contract expert. Analyse this contract text and identify:
    1. Onerous obligations (fitness for purpose, design liability, unlimited liability)
    2. Unusual payment terms (pay-when-paid, long payment periods >30 days, set-off rights)
    3. High liquidated damages exposure
    4. Unusual insurance requirements
    5. Unfair termination clauses
    6. Missing standard protections (adjudication rights, final account provisions)

    Contract text: ${contractText.substring(0, 4000)}

    Return JSON: { "flags": [{ "type": "risk"|"obligation"|"unusual", "clause": "clause ref or short quote", "description": "plain English explanation", "severity": "low"|"medium"|"high", "recommendation": "what to do" }] }`
    );

    await supabase.from("projects").update({ contract_review_flags: flags.flags || [] }).eq("id", projectId);
    revalidatePath("/dashboard/projects/contracts");
    return flags;
}

// ── Risk & Opportunities ────────────────────────────────
export async function saveRiskRegisterAction(
    projectId: string,
    riskRegister: Array<{ id: string; type: string; description: string; likelihood: string; impact: string; mitigation: string }>
) {
    const supabase = createClient();
    const { error } = await supabase.from("projects").update({ risk_register: riskRegister }).eq("id", projectId);
    if (error) console.error("Save risk register error:", error);
    revalidatePath("/dashboard/projects/contracts");
}

export async function generateRiskRegisterAction(projectId: string, scope: string, projectType: string) {
    return generateJSON<{ risks: Array<{ description: string; likelihood: string; impact: string; mitigation: string }>; opportunities: Array<{ description: string; likelihood: string; impact: string; action: string }> }>(
        `You are a UK construction risk manager. Generate a risk and opportunity register for this project.
    Project type: ${projectType}. Scope: ${scope?.substring(0, 500) || "Not specified"}.

    Return 4-6 risks and 3-4 opportunities.
    JSON: {
      "risks": [{ "description": "...", "likelihood": "low"|"medium"|"high", "impact": "low"|"medium"|"high", "mitigation": "..." }],
      "opportunities": [{ "description": "...", "likelihood": "low"|"medium"|"high", "impact": "low"|"medium"|"high", "action": "..." }]
    }`
    );
}

// ── Exclusions & Clarifications ─────────────────────────
export async function saveContractExclusionsAction(projectId: string, exclusions: string, clarifications: string) {
    const supabase = createClient();
    const { error } = await supabase.from("projects").update({
        contract_exclusions: exclusions,
        contract_clarifications: clarifications,
    }).eq("id", projectId);
    if (error) console.error("Save contract exclusions error:", error);
    revalidatePath("/dashboard/projects/contracts");
}

export async function generateContractExclusionsAction(scope: string, projectType: string) {
    return generateJSON<{ exclusions: string; clarifications: string }>(
        `You are a UK construction contract expert. Based on this scope and project type, generate standard exclusions and clarifications.

    Project type: ${projectType}. Scope: ${scope?.substring(0, 500) || "Not specified"}.

    Return JSON: {
      "exclusions": "item1\nitem2\nitem3\nitem4\nitem5",
      "clarifications": "item1\nitem2\nitem3\nitem4"
    }

    Common exclusions: surveys, asbestos, party wall awards, building control fees, council charges, architect fees, furniture/white goods.
    Common clarifications: working hours, access assumptions, waste disposal included, customer obligations.`
    );
}

// ── Contract AI Chat ────────────────────────────────────
export async function contractChatAction(message: string, contractContext: {
    tcTier: string;
    projectType: string;
    flags: Array<{ description: string }>;
}): Promise<{ response: string }> {
    const response = await generateText(
        `You are a UK construction contract risk awareness assistant for SME contractors.
    Help the contractor understand contract terms, risks, and standard practice.

    IMPORTANT: Always clarify you are providing risk awareness information, not legal advice.
    For complex matters, recommend seeking professional legal advice.

    Contract context: ${contractContext.tcTier} tier, ${contractContext.projectType} project.
    ${contractContext.flags.length > 0 ? `Known flags: ${contractContext.flags.map(f => f.description).join(", ")}` : ""}

    Contractor question: ${message}

    Respond in plain English, be practical and helpful. Keep responses concise (2-3 paragraphs max).
    End with: "⚠️ This is risk awareness information, not legal advice."`
    );
    return { response };
}

// ── Legacy (kept for compatibility) ─────────────────────
export async function generateContractAction(projectId: string) {
    return "Use the Contracts hub tabs to manage your contract.";
}
