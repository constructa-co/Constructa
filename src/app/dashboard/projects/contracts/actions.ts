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

// ── Contract AI chunk analyser (internal) ───────────────
const CONTRACT_REVIEW_PROMPT = (section: string, sectionLabel: string) =>
    `You are an expert UK construction contract reviewer acting for the CONTRACTOR (SME builder/specialist).

Review ${sectionLabel} of the contract below. Identify risks, obligations, and notable clauses.

SEVERITY:
- high: payment >45 days, fitness-for-purpose, unlimited liability, pay-when-paid (illegal), LADs >0.5%/week, contractor design liability without fee, set-off without Pay Less Notice
- medium: retention >5%, defects period >24 months, insurance >£10m, unusual termination, onerous warranties, tight notice periods, unusual exclusions
- low: standard clauses that are acceptable but the contractor should be aware of (payment terms, CDM duties, defects periods, adjudication rights, etc.)

IMPORTANT: Always return flags. Even standard clauses should be noted as low severity so the contractor has a complete picture. Return 3-6 flags per section.

Contract section:
${section}

Return ONLY valid JSON — no markdown, no explanation: { "flags": [{ "type": "risk"|"obligation"|"unusual", "clause": "short clause reference or quote (max 15 words)", "description": "plain English explanation for a non-lawyer contractor", "severity": "low"|"medium"|"high", "recommendation": "specific action for the contractor" }] }`;

async function analyseChunk(section: string, label: string): Promise<Array<{ type: string; clause: string; description: string; severity: string; recommendation: string }>> {
    try {
        const result = await generateJSON<{ flags: Array<{ type: string; clause: string; description: string; severity: string; recommendation: string }> }>(
            CONTRACT_REVIEW_PROMPT(section, label)
        );
        return result.flags || [];
    } catch {
        return [];
    }
}

// ── Contract Upload & AI Analysis ───────────────────────
export async function analyseContractAction(
    projectId: string,
    contractText: string
): Promise<{ flags: Array<{ type: string; clause: string; description: string; severity: string; recommendation: string }>; error?: string }> {
    try {
        const supabase = createClient();

        // Save the raw uploaded text
        await supabase.from("projects").update({ uploaded_contract_text: contractText }).eq("id", projectId);

        // Sanitise: strip non-printable / control characters that can break JSON
        const cleanText = contractText
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        if (!cleanText) return { flags: [], error: "Contract text is empty after sanitisation." };

        // gpt-4o-mini: 128k token context. Chunk at 40k chars (~10k tokens) each.
        // Parallel chunk analysis then merge + deduplicate.
        const CHUNK = 40000;
        const chunks: { text: string; label: string }[] = [];

        if (cleanText.length <= CHUNK) {
            chunks.push({ text: cleanText, label: "the full contract" });
        } else {
            let start = 0;
            let idx = 1;
            const total = Math.ceil(cleanText.length / CHUNK);
            while (start < cleanText.length) {
                const end = Math.min(start + CHUNK, cleanText.length);
                chunks.push({ text: cleanText.slice(start, end), label: `section ${idx} of ${total}` });
                start += CHUNK - 2000; // 2k char overlap so boundary clauses aren't missed
                idx++;
            }
        }

        // Analyse all chunks in parallel
        const chunkResults = await Promise.all(
            chunks.map(c => analyseChunk(c.text, c.label))
        );

        // Merge and de-duplicate by clause text
        const merged = chunkResults.flat().filter(f => f && typeof f.clause === "string" && typeof f.severity === "string");
        const seen = new Set<string>();
        const deduped = merged.filter(flag => {
            const key = (flag.clause || "").toLowerCase().replace(/\s+/g, " ").substring(0, 40);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Sort: high → medium → low
        const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        deduped.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

        await supabase.from("projects").update({ contract_review_flags: deduped }).eq("id", projectId);
        revalidatePath("/dashboard/projects/contracts");
        return { flags: deduped };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Contract analysis error:", msg);
        return { flags: [], error: msg };
    }
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
