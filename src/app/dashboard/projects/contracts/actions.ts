"use server";

import { createClient } from "@/lib/supabase/server";
import { generateJSON, generateText } from "@/lib/ai";
import { revalidatePath } from "next/cache";

export async function saveTcTierAction(projectId: string, tier: string) {
    const supabase = createClient();
    await supabase.from("projects").update({ tc_tier: tier }).eq("id", projectId);
    revalidatePath("/dashboard/projects/contracts");
}

export async function analyseContractAction(projectId: string, contractText: string) {
    const flags = await generateJSON<{ flags: Array<{ type: string; clause: string; description: string; severity: string; recommendation: string }> }>(
        `You are a UK construction contract expert. Analyse this contract text and identify:
    1. Onerous obligations (fitness for purpose, design liability, unlimited liability)
    2. Unusual payment terms (pay-when-paid, long payment periods >30 days, set-off rights)
    3. High liquidated damages exposure
    4. Unusual insurance requirements
    5. Unfair termination clauses
    6. Missing standard protections (adjudication rights, final account provisions)

    Contract text: ${contractText.substring(0, 4000)}

    Return JSON: { "flags": [{ "type": "risk" or "obligation" or "unusual", "clause": "clause ref or short quote", "description": "plain English explanation", "severity": "low" or "medium" or "high", "recommendation": "what to do" }] }`
    );

    const supabase = createClient();
    await supabase.from("projects").update({ contract_review_flags: flags.flags }).eq("id", projectId);
    revalidatePath("/dashboard/projects/contracts");
    return flags;
}

export async function saveRiskRegisterAction(projectId: string, register: any[]) {
    const supabase = createClient();
    await supabase.from("projects").update({ risk_register: register }).eq("id", projectId);
    revalidatePath("/dashboard/projects/contracts");
}

export async function generateRiskRegisterAction(projectId: string, scope: string, projectType: string) {
    const result = await generateJSON<{
        risks: Array<{ description: string; likelihood: string; impact: string; mitigation: string }>;
        opportunities: Array<{ description: string; likelihood: string; impact: string; action: string }>;
    }>(
        `You are a UK construction risk manager. Generate a risk and opportunity register for this project.
    Project type: ${projectType}. Scope: ${scope?.substring(0, 500) || "Not specified"}.

    Return 4-6 risks and 3-4 opportunities.
    JSON: {
      "risks": [{ "description": "...", "likelihood": "low" or "medium" or "high", "impact": "low" or "medium" or "high", "mitigation": "..." }],
      "opportunities": [{ "description": "...", "likelihood": "low" or "medium" or "high", "impact": "low" or "medium" or "high", "action": "..." }]
    }`
    );

    const combined = [
        ...result.risks.map(r => ({ ...r, id: crypto.randomUUID(), type: "risk" as const })),
        ...result.opportunities.map(o => ({ ...o, id: crypto.randomUUID(), type: "opportunity" as const })),
    ];

    const supabase = createClient();
    await supabase.from("projects").update({ risk_register: combined }).eq("id", projectId);
    revalidatePath("/dashboard/projects/contracts");
    return { risks: result.risks, opportunities: result.opportunities };
}

export async function saveContractExclusionsAction(projectId: string, exclusions: string, clarifications: string) {
    const supabase = createClient();
    await supabase.from("projects").update({
        contract_exclusions: exclusions,
        contract_clarifications: clarifications,
    }).eq("id", projectId);
    revalidatePath("/dashboard/projects/contracts");
}

export async function contractChatAction(message: string, contractContext: {
    tcTier: string;
    projectType: string;
    flags: any[];
}): Promise<{ response: string }> {
    const response = await generateText(
        `You are a UK construction contract risk awareness assistant for SME contractors.
    Help the contractor understand contract terms, risks, and standard practice.

    IMPORTANT: Always clarify you are providing risk awareness information, not legal advice.
    For complex matters, recommend seeking professional legal advice.

    Contract context: ${contractContext.tcTier} tier, ${contractContext.projectType} project.
    ${contractContext.flags.length > 0 ? `Known flags: ${contractContext.flags.map((f: any) => f.description).join(", ")}` : ""}

    Contractor question: ${message}

    Respond in plain English, be practical and helpful. Keep responses concise (2-3 paragraphs max).`
    );
    return { response };
}

export async function suggestTcTierAction(clientType: string, projectType: string): Promise<{ tier: string; reason: string }> {
    return generateJSON<{ tier: string; reason: string }>(
        `Based on this construction project, suggest the most appropriate Terms & Conditions tier.
    Client type: ${clientType || "unknown"}
    Project type: ${projectType || "general"}

    Tiers:
    - domestic: For homeowner clients, plain English, RICS Homeowner Adjudication
    - commercial: For business clients, JCT Minor Works based, liquidated damages
    - specialist: For specialist/trade works, subcontract packages

    Return JSON: { "tier": "domestic" or "commercial" or "specialist", "reason": "one line explanation" }`
    );
}
