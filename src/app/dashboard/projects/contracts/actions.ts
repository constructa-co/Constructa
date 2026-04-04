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

        // Sanitise: strip control chars but preserve newlines (clause structure depends on them)
        const cleanText = contractText
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
            .replace(/[^\S\n]+/g, " ")
            .replace(/\n{4,}/g, "\n\n\n")
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

export async function generateContractExclusionsAction(
    scope: string,
    projectType: string,
    contractFlags?: Array<{ clause: string; description: string; severity: string; recommendation: string }>
) {
    const flagsContext = contractFlags && contractFlags.length > 0
        ? `\n\nContract Shield has identified these risks/obligations in the client contract:\n${
            contractFlags
                .filter(f => f.severity !== "low")
                .map(f => `- ${f.clause}: ${f.description}. Recommendation: ${f.recommendation}`)
                .join("\n")
          }\nUse these to inform specific exclusions and clarifications that protect the contractor.`
        : "";

    return generateJSON<{ exclusions: string; clarifications: string }>(
        `You are a UK construction contract expert. Based on this scope, project type, and any contract risks identified, generate targeted exclusions and clarifications to protect the contractor.

    Project type: ${projectType}. Scope: ${scope?.substring(0, 500) || "Not specified"}.${flagsContext}

    Return JSON: {
      "exclusions": "item1\nitem2\nitem3\nitem4\nitem5",
      "clarifications": "item1\nitem2\nitem3\nitem4"
    }

    Common exclusions: surveys, asbestos, party wall awards, building control fees, council charges, architect fees, furniture/white goods.
    Common clarifications: working hours, access assumptions, waste disposal included, customer obligations.
    Where contract risks have been identified above, add specific exclusions/clarifications that address those risks.`
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

// ── Parse Client Contract into Clauses ──────────────────
// Single-pass approach: parse structure + suggest amendments in one AI call.
// (Two-pass was too slow — sequential calls risked Vercel function timeouts.)
export async function structureClientContractAction(
    contractText: string,
    flags: Array<{ clause: string; description: string; severity: string; recommendation: string }>
): Promise<{ clauses: Array<{ id: string; clauseRef: string; title: string; original: string; proposed: string; status: "accepted" | "modified" | "rejected"; reason: string; flagged: boolean }>; error?: string }> {
    try {
        // Sanitise: remove control chars but PRESERVE newlines — clause structure depends on them
        const cleanText = contractText
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")  // strip control chars
            .replace(/[^\S\n]+/g, " ")                              // normalise spaces/tabs, keep newlines
            .replace(/\n{4,}/g, "\n\n\n")                           // collapse excessive blank lines
            .trim();
        if (!cleanText) return { clauses: [], error: "Contract text is empty." };

        // Cap at 20k chars to keep AI response time well within Vercel's 60s limit.
        // 20k chars ≈ 5k tokens input — fast enough even on cold starts.
        const excerpt = cleanText.length > 20000
            ? cleanText.substring(0, 10000) + "\n\n[...middle section omitted...]\n\n" + cleanText.substring(cleanText.length - 10000)
            : cleanText;

        const highMedFlags = flags.filter(f => f.severity === "high" || f.severity === "medium");
        const flagSummary = highMedFlags.map(f => `"${f.clause}": ${f.recommendation}`).join("; ");

        // ── Single pass: parse clauses + recommend amendments in one call ──
        const result = await generateJSON<{ clauses: Array<{
            clauseRef: string;
            title: string;
            original: string;
            flagged: boolean;
            status: string;
            proposed: string;
            reason: string;
        }> }>(
            `You are advising a UK SME contractor reviewing a client contract.

Extract the key commercial clauses and for each one recommend Accept, Modify, or Reject.

IMPORTANT: Contracts vary in format. Some use numbered clauses (1.1, 2.3), some use headings, some use plain paragraphs. Whatever the format, identify the 8-12 most commercially significant sections covering:
payment terms, completion dates, liability, insurance, defects/retention, termination, variations, design responsibility, and dispute resolution.

If the document has no clear clause structure, treat each distinct topic or paragraph as a clause.
Always return at least some clauses — even informal agreements have commercial terms.

Known contract risks to address:
${flagSummary || "None identified — apply standard UK contractor protections."}

For each clause return:
- clauseRef: clause number, heading, or a short label if unstructured (e.g. "3.1", "Payment", "Para 4")
- title: short plain English title
- original: first 120 characters of the clause text, ending with "..." if longer
- flagged: true if this clause relates to a known risk listed above
- status: "accepted" | "modified" | "rejected"
- proposed: contractor-friendly alternative wording (1-2 sentences, empty string if accepted)
- reason: plain English explanation of why modified/rejected (empty string if accepted)

Use "rejected" ONLY for illegal or grossly onerous clauses (pay-when-paid, unlimited liability, fitness-for-purpose).
Most clauses should be "accepted" or "modified".

Return ONLY valid JSON — no markdown, no explanation:
{ "clauses": [{ "clauseRef": "", "title": "", "original": "", "flagged": false, "status": "accepted", "proposed": "", "reason": "" }] }

Contract text:
${excerpt}`
        );

        console.log("structureClientContractAction result:", JSON.stringify(result).substring(0, 500));

        if (!result?.clauses?.length) {
            return { clauses: [], error: `AI returned no clauses (response: ${JSON.stringify(result).substring(0, 200)}). The document may not contain recognisable contract terms.` };
        }

        const clauses = result.clauses.map((c: any) => ({
            id: Math.random().toString(36).substring(2, 11),
            clauseRef: c.clauseRef || "",
            title: c.title || "Untitled",
            original: c.original || "",
            proposed: c.proposed || "",
            status: (["accepted", "modified", "rejected"].includes(c.status) ? c.status : "accepted") as "accepted" | "modified" | "rejected",
            reason: c.reason || "",
            flagged: !!c.flagged,
        }));

        return { clauses };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("structureClientContractAction error:", msg);
        return { clauses: [], error: msg || "Unknown error during contract parsing." };
    }
}

export async function saveClientContractClausesAction(
    projectId: string,
    clauses: Array<{ id: string; clauseRef: string; title: string; original: string; proposed: string; status: string; reason: string; flagged: boolean }>
) {
    try {
        const supabase = createClient();
        const { error } = await supabase.from("projects").update({ client_contract_clauses: clauses }).eq("id", projectId);
        if (error) console.error("Save client contract clauses error:", error);
        revalidatePath("/dashboard/projects/contracts");
    } catch (e) {
        console.error("saveClientContractClausesAction error:", e);
    }
}

// ── Legacy (kept for compatibility) ─────────────────────
export async function generateContractAction(projectId: string) {
    return "Use the Contracts hub tabs to manage your contract.";
}
