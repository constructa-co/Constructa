"use server";

import { requireEditableProjectAccess } from "@/lib/supabase/project-resource-access";
import { revalidatePath } from "next/cache";
import OpenAI from "openai";
import { CreateBoQEstimateSchema, parseInput } from "@/lib/validation/schemas";
import { requireLaunchCapability } from "@/lib/launch-profile";
import { batchSectionHeadings } from "@/lib/estimate-batch-sections";
import { normalizeClientBoQLines } from "@/lib/client-boq-normalize";
import { reconcileBoQLineTotal, type BoQTotalMismatch } from "@/lib/boq-number";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClientBoQLine {
    client_ref: string;       // e.g. "2.1.3" or "A" or ""
    section: string;          // client's section heading, e.g. "Substructure"
    description: string;
    quantity: number | null;  // null = not provided
    unit: string;
    unit_rate: number;        // 0 = unpriced
    line_total: number;
    /** Set when qty/rate cells were present but not readable — no invented numbers. */
    parse_warnings?: string[];
    /** The client's stated total disagreed with qty × rate; line_total holds qty × rate. Does not block import. */
    total_mismatch?: BoQTotalMismatch;
}

export interface ParsedClientBoQ {
    filename: string;
    sections: string[];
    lines: ClientBoQLine[];
    totalLines: number;
}

// ─── PDF BoQ Parser ───────────────────────────────────────────────────────────
// Accepts base64-encoded pages (from pdfjs in browser), sends to GPT-4o,
// returns structured BoQ lines preserving client refs and section headings.

export async function parseBoQFromPdfAction(
    base64Pages: string[],
    filename: string
): Promise<{ success: boolean; boq?: ParsedClientBoQ; error?: string }> {
    requireLaunchCapability("client-boq-import");
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return { success: false, error: "AI not configured" };

    const pagesToSend = base64Pages.slice(0, 10);

    try {
        const client = new OpenAI({ apiKey });

        const imageContent = pagesToSend.map((page) => {
            const base64Data = page.includes(",") ? page.split(",")[1] : page;
            return {
                type: "image_url" as const,
                image_url: { url: `data:image/jpeg;base64,${base64Data}`, detail: "high" as const },
            };
        });

        const prompt = `You are a UK construction estimator parsing a client Bill of Quantities (BoQ).

Extract ALL line items from the BoQ exactly as written. Preserve:
- The client's item reference numbers (e.g. "A", "1.1", "2.3.4", "B/1") — use "" if none
- The client's section/heading structure (e.g. "Substructure", "2. Frame", "Section B")
- The exact item descriptions — do not paraphrase or shorten
- Quantities and units where provided (null if blank/not given)
- Any rates or totals already filled in (0 if blank)

Return ONLY valid JSON — no markdown:
{
  "lines": [
    {
      "client_ref": "2.1",
      "section": "Substructure",
      "description": "Excavate to reduce levels, remove spoil off site",
      "quantity": 45,
      "unit": "m3",
      "unit_rate": 0,
      "line_total": 0
    }
  ]
}

Rules:
- Include section header rows as lines with description = the heading text, quantity = null, unit = "item"
- Preserve provisional sums, PC sums, and contingencies as line items
- If a quantity cell is blank/dash, set quantity to null
- Units: use exactly what is shown (m2, m², m3, nr, No., item, sum, LS, etc.)`;

        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            max_tokens: 4000,
            messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...imageContent] }],
        });

        const rawText = response.choices[0]?.message?.content || '{"lines":[]}';
        let lines: ClientBoQLine[] = [];
        try {
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(jsonMatch?.[0] || rawText);
            const raw = Array.isArray(parsed.lines) ? parsed.lines : [];
            lines = normalizeClientBoQLines(raw);
        } catch {
            lines = [];
        }

        const sections = batchSectionHeadings(lines);

        return {
            success: true,
            boq: { filename, sections, lines, totalLines: lines.length },
        };
    } catch (err: any) {
        return { success: false, error: err.message || "PDF parsing failed" };
    }
}

// ─── Excel BoQ ────────────────────────────────────────────────────────────────
// Spreadsheets (.xlsx/.xls, and CSVs the batch reader cannot read) are read
// deterministically in the browser by src/lib/boq-workbook.ts: every tab, every
// row, with a row reconciliation shown before import. No AI and no row cap.

// ─── Create estimate from parsed BoQ ─────────────────────────────────────────

export async function createBoQEstimateAction(
    projectId: string,
    boq: ParsedClientBoQ
): Promise<{ success: boolean; estimateId?: string; importedLines?: number; error?: string }> {
    requireLaunchCapability("client-boq-import");
  const warned = boq.lines.filter((line) => line.parse_warnings?.length);
    if (warned.length) {
        return {
            success: false,
            error: `${warned.length} row(s) have unreadable quantities, rates or totals. Fix them in the file or remove those rows before importing.`,
        };
    }
    if (boq.totalLines !== boq.lines.length) {
        return { success: false, error: `The preview listed ${boq.totalLines} line(s) but ${boq.lines.length} were sent. Nothing was imported.` };
    }
    const blank = boq.lines.filter((line) => !line.description?.trim()).length;
    if (blank) {
        return { success: false, error: `${blank} line(s) have no description. Nothing was imported.` };
    }
    try {
        parseInput(CreateBoQEstimateSchema, { projectId, boq }, "client BoQ import");
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Invalid BoQ payload" };
    }
    const { supabase } = await requireEditableProjectAccess(projectId);

    // Create the estimate flagged as client BoQ
    const { data: estimate, error: estErr } = await supabase
        .from("estimates")
        .insert({
            project_id: projectId,
            version_name: `Client BoQ — ${boq.filename}`,
            overhead_pct: 10,
            profit_pct: 15,
            risk_pct: 0,
            prelims_pct: 0,   // prelims usually explicit in client BoQ
            is_active: false,
            is_client_boq: true,
            client_boq_filename: boq.filename,
        })
        .select("id")
        .single();

    if (estErr || !estimate) return { success: false, error: estErr?.message || "Failed to create estimate" };

    // Insert every previewed line; none is filtered out here (descriptions were checked above).
    const linesToInsert = boq.lines.map((l) => {
        const unit = (l.unit || "item").trim() || "item";
        const quantity = l.quantity ?? 1;
        // Never trust a posted total that disagrees with qty × rate: the row
        // would read "2 × £10 = £25" and change on its first edit.
        const line_total = Number.isFinite(l.line_total)
            ? reconcileBoQLineTotal(l.quantity, l.unit_rate || 0, l.line_total).line_total
            : quantity * (l.unit_rate || 0);
        return {
            estimate_id: estimate.id,
            trade_section: l.section || "General",
            client_ref: l.client_ref || null,
            description: l.description,
            quantity,
            unit,
            unit_rate: l.unit_rate || 0,
            line_total,
            pricing_mode: "simple",
            line_type: "general",
        };
    });

    const { data: insertedLines, error: linesErr } = await supabase
        .from("estimate_lines")
        .insert(linesToInsert)
        .select("id");
    const importedLines = Array.isArray(insertedLines) ? insertedLines.length : 0;
    if (linesErr || importedLines !== linesToInsert.length) {
        // The new estimate stays inactive, so the previous active estimate is untouched.
        return {
            success: false,
            error: linesErr?.message
                ? `Lines were not saved: ${linesErr.message}`
                : `Only ${importedLines} of ${linesToInsert.length} lines were saved. The previous estimate is still active.`,
        };
    }

    // The client BoQ supersedes any previous estimate — only once all its lines are in.
    await supabase.from("estimates").update({ is_active: false }).eq("project_id", projectId).neq("id", estimate.id);
    await supabase.from("estimates").update({ is_active: true }).eq("id", estimate.id);

    // Auto-advance project status
    const { data: proj } = await supabase.from("projects").select("status").eq("id", projectId).single();
    if (proj?.status === "Lead" || !proj?.status) {
        await supabase.from("projects").update({ status: "Estimating" }).eq("id", projectId);
    }

    revalidatePath(`/dashboard/projects/costs?projectId=${projectId}`);

    return { success: true, estimateId: estimate.id, importedLines };
}
