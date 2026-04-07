"use server";

import { createClient } from "@/lib/supabase/server";
import { generateJSON } from "@/lib/ai";
import { revalidatePath } from "next/cache";
import OpenAI from "openai";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClientBoQLine {
    client_ref: string;       // e.g. "2.1.3" or "A" or ""
    section: string;          // client's section heading, e.g. "Substructure"
    description: string;
    quantity: number | null;  // null = not provided
    unit: string;
    unit_rate: number;        // 0 = unpriced
    line_total: number;
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
            lines = Array.isArray(parsed.lines) ? parsed.lines : [];
        } catch {
            lines = [];
        }

        const sections = [...new Set(lines.map((l) => l.section).filter(Boolean))];

        return {
            success: true,
            boq: { filename, sections, lines, totalLines: lines.length },
        };
    } catch (err: any) {
        return { success: false, error: err.message || "PDF parsing failed" };
    }
}

// ─── Excel BoQ Parser ─────────────────────────────────────────────────────────
// Accepts parsed rows from SheetJS (done client-side), uses GPT to interpret
// column structure and extract lines.

export async function parseBoQFromExcelDataAction(
    rows: string[][],   // first 200 rows as string arrays from SheetJS
    filename: string
): Promise<{ success: boolean; boq?: ParsedClientBoQ; error?: string }> {
    try {
        // Convert rows to a readable text table for GPT
        const tableText = rows
            .slice(0, 150)
            .map((row) => row.map((cell) => String(cell ?? "").trim()).join("\t"))
            .join("\n");

        const result = await generateJSON<{ lines: ClientBoQLine[] }>(
            `You are a UK construction estimator parsing a client Bill of Quantities exported from Excel.

The spreadsheet data (tab-separated) is:
${tableText}

Identify the column structure (ref, section/heading, description, quantity, unit, rate, total) and extract ALL line items.
Preserve the client's exact item references and section headings.
If a cell is blank or "-", use null for quantities and 0 for rates.

Return JSON: { "lines": [{ "client_ref": "", "section": "", "description": "", "quantity": null, "unit": "item", "unit_rate": 0, "line_total": 0 }] }`
        );

        const lines = result.lines || [];
        const sections = [...new Set(lines.map((l) => l.section).filter(Boolean))];

        return {
            success: true,
            boq: { filename, sections, lines, totalLines: lines.length },
        };
    } catch (err: any) {
        return { success: false, error: err.message || "Excel parsing failed" };
    }
}

// ─── Create estimate from parsed BoQ ─────────────────────────────────────────

export async function createBoQEstimateAction(
    projectId: string,
    boq: ParsedClientBoQ
): Promise<{ success: boolean; estimateId?: string; error?: string }> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return { success: false, error: "Not authenticated" };

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

    // The client BoQ supersedes any previous estimate — deactivate all others first
    await supabase.from("estimates").update({ is_active: false }).eq("project_id", projectId).neq("id", estimate.id);
    await supabase.from("estimates").update({ is_active: true }).eq("id", estimate.id);

    // Insert lines — skip blank description rows, keep section headers
    const linesToInsert = boq.lines
        .filter((l) => l.description?.trim())
        .map((l) => ({
            estimate_id: estimate.id,
            trade_section: l.section || "General",
            client_ref: l.client_ref || null,
            description: l.description,
            quantity: l.quantity ?? 1,
            unit: l.unit || "item",
            unit_rate: l.unit_rate || 0,
            line_total: l.quantity != null ? (l.quantity * (l.unit_rate || 0)) : 0,
            pricing_mode: "simple",
            line_type: "general",
        }));

    if (linesToInsert.length > 0) {
        const { error: linesErr } = await supabase
            .from("estimate_lines")
            .insert(linesToInsert);
        if (linesErr) console.error("Insert BoQ lines error:", linesErr);
    }

    // Auto-advance project status
    const { data: proj } = await supabase.from("projects").select("status").eq("id", projectId).single();
    if (proj?.status === "Lead" || !proj?.status) {
        await supabase.from("projects").update({ status: "Estimating" }).eq("id", projectId);
    }

    revalidatePath(`/dashboard/projects/costs?projectId=${projectId}`);

    return { success: true, estimateId: estimate.id };
}
