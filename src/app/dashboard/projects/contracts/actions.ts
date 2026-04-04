"use server";

import { createClient } from "@/lib/supabase/server";
import { generateJSON, generateText } from "@/lib/ai";
import { revalidatePath } from "next/cache";

// ── PDF / DOCX server-side text extraction ──────────────
export async function extractContractTextAction(storagePath: string): Promise<{ text: string; error?: string }> {
    try {
        const supabase = createClient();

        // Download file bytes from Supabase storage
        const { data, error } = await supabase.storage.from("contracts").download(storagePath);
        if (error || !data) return { text: "", error: "Could not download file: " + error?.message };

        const ext = storagePath.split(".").pop()?.toLowerCase();
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (ext === "pdf") {
            // unpdf is purpose-built for server-side PDF extraction —
            // no DOMMatrix / canvas browser API dependencies.
            const { getDocumentProxy, extractText } = await import("unpdf");
            const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
            const { text } = await extractText(pdf, { mergePages: true });
            if (!text?.trim()) return { text: "", error: "No readable text found in PDF — try a text-based PDF rather than a scanned image." };
            return { text: text.trim() };
        }

        if (ext === "docx" || ext === "doc") {
            const mammoth = await import("mammoth");
            const result = await mammoth.extractRawText({ buffer });
            if (!result.value?.trim()) return { text: "", error: "No readable text found in document." };
            return { text: result.value.trim() };
        }

        return { text: "", error: "Unsupported file type. Use PDF, DOCX, or TXT." };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return { text: "", error: "Extraction failed: " + msg };
    }
}

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
        `You are an expert UK construction contract reviewer, specialising in JCT, NEC, and bespoke SME contractor agreements.

IMPORTANT CONTEXT — These clauses are STANDARD and should NOT be flagged as risks:
- Standard JCT defects liability periods (6-12 months)
- Standard RICS adjudication clauses
- 30-day payment terms (standard under the Construction Act 1996)
- Standard CDM 2015 principal contractor obligations
- Standard practical completion definitions
- Reasonable skill and care workmanship standard
- Standard retention clauses (3-5%)
- Standard public liability insurance requirements (£2m-£10m)
- Standard materials and workmanship warranties

ONLY flag as Red (high severity) if you see:
- Payment terms longer than 45 days (violates Construction Act)
- Fitness for purpose obligations (not just reasonable skill and care)
- Unlimited liability clauses
- Pay-when-paid clauses (illegal in UK construction)
- Liquidated damages above 0.5% per week of contract value
- Contractor takes on design liability without design fees
- Set-off rights without formal Pay Less Notice requirement

Flag as Amber (medium) for:
- Retention above 5%
- Defects liability longer than 24 months
- Unusual insurance requirements (above £10m)
- Non-standard termination clauses
- Unusual exclusions of contractor's standard protections

Flag as Green (acceptable) for standard JCT/NEC language.

Contract text: ${contractText.substring(0, 4000)}

Return JSON: { "flags": [{ "type": "risk"|"obligation"|"unusual", "clause": "clause ref or short quote", "description": "plain English explanation for a non-lawyer contractor", "severity": "low"|"medium"|"high", "recommendation": "what to do about this" }] }

Important: do not over-flag. A standard domestic building contract should have 0-2 Red flags, 2-4 Amber, and several Green.`
    );

    await supabase.from("projects").update({ contract_review_flags: flags.flags || [] }).eq("id", projectId);
    revalidatePath("/dashboard/projects/contracts");
    return flags;
}

// ── Dismiss / Accept Contract Flag ─────────────────────
export async function dismissContractFlagAction(
    projectId: string,
    flagIndex: number,
    status: "accepted" | "disputed"
) {
    const supabase = createClient();
    const { data } = await supabase.from("projects").select("contract_review_flags").eq("id", projectId).single();
    if (!data?.contract_review_flags) return;

    const flags = [...data.contract_review_flags];
    if (flags[flagIndex]) {
        flags[flagIndex] = { ...flags[flagIndex], dismissed: true, dismiss_status: status };
    }

    await supabase.from("projects").update({ contract_review_flags: flags }).eq("id", projectId);
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
