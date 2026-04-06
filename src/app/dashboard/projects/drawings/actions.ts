"use server";

import { createClient } from "@/lib/supabase/server";
import { generateJSON } from "@/lib/ai";
import OpenAI from "openai";
import { revalidatePath } from "next/cache";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DrawingResultItem {
    item_name: string;
    estimated_quantity: number;
    unit: string;
    suggested_rate: number;
    trade_section: string;
    library_match: string | null;
}

export interface DrawingExtraction {
    id: string;
    project_id: string;
    filename: string;
    file_size_kb: number | null;
    format: string;
    page_count: number;
    pages_processed: number;
    extracted_items: DrawingResultItem[];
    status: string;
    error_message: string | null;
    created_at: string;
}

// ─── Analyse drawing pages (core AI action) ──────────────────────────────────
// base64Pages: array of data:image/png;base64,... strings (max 10)
// Each string is one rendered page of the drawing

export async function analyzeDrawingPagesAction(
    projectId: string,
    filename: string,
    fileSizeKb: number,
    format: string,
    pageCount: number,
    base64Pages: string[]
): Promise<{ success: boolean; extraction?: DrawingExtraction; error?: string }> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return { success: false, error: "Not authenticated" };

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return { success: false, error: "AI not configured" };

    const pagesProcessed = Math.min(base64Pages.length, 10);
    const pagesToProcess = base64Pages.slice(0, 10);

    // Create a pending extraction record
    const { data: record, error: insertErr } = await supabase
        .from("drawing_extractions")
        .insert({
            project_id: projectId,
            user_id: user.id,
            filename,
            file_size_kb: fileSizeKb,
            format,
            page_count: pageCount,
            pages_processed: pagesProcessed,
            status: "processing",
            extracted_items: [],
        })
        .select()
        .single();

    if (insertErr || !record) {
        return { success: false, error: insertErr?.message || "Failed to create record" };
    }

    try {
        const client = new OpenAI({ apiKey });

        // Build multi-image message content
        const imageContent = pagesToProcess.map((page) => {
            const base64Data = page.includes(",") ? page.split(",")[1] : page;
            return {
                type: "image_url" as const,
                image_url: {
                    url: `data:image/png;base64,${base64Data}`,
                    detail: "high" as const,
                },
            };
        });

        const prompt = `You are an expert UK Quantity Surveyor performing a measured survey from construction drawings.

Analyse ALL provided drawing pages and extract a comprehensive list of construction elements and quantities.

EXTRACT (where visible):
- Structural elements: foundations, columns, beams, slabs, walls (external + internal)
- Openings: doors (type, size if readable), windows (type, size if readable), rooflights
- Roofing: roof area (m²), roof type, gutters, downpipes
- Finishes: floor finishes by room (m²), wall finishes (m²), ceiling finishes (m²)
- M&E indicators: WCs, basins, baths, showers, electrical consumer units, radiators
- External works: paving, fencing, drainage, landscaping areas (m²)
- Any labelled room areas or dimensions shown on drawings

RULES:
- Use UK construction measurement conventions (m, m², m³, nr, kg, tonne, item)
- Estimate quantities from visible scale, room labels or dimension strings
- If scale bar visible, use it. If not, estimate proportionally.
- Group items by trade section
- Return ONLY valid JSON — no markdown, no commentary

Return JSON:
{
  "items": [
    {
      "item_name": "External Brick Wall",
      "estimated_quantity": 45.5,
      "unit": "m²",
      "trade_section": "Brickwork & Blockwork"
    }
  ]
}

Trade sections to use: Groundworks, Concrete, Brickwork & Blockwork, Roofing, Joinery & Ironmongery, Windows & Glazing, Plastering & Dry Lining, Floor Finishes, Ceiling Finishes, Painting & Decorating, Plumbing & Heating, Electrical, External Works, Preliminaries, General`;

        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            max_tokens: 4000,
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    ...imageContent,
                ],
            }],
        });

        const rawText = response.choices[0]?.message?.content || '{"items":[]}';

        // Parse AI response
        let rawItems: { item_name: string; estimated_quantity: number; unit: string; trade_section: string }[] = [];
        try {
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(jsonMatch?.[0] || rawText);
            rawItems = Array.isArray(parsed) ? parsed : (parsed.items || []);
        } catch {
            rawItems = [];
        }

        // Match items to cost library
        let extractedItems: DrawingResultItem[] = rawItems.map((item) => ({
            item_name: item.item_name,
            estimated_quantity: item.estimated_quantity,
            unit: item.unit || "nr",
            suggested_rate: 0,
            trade_section: item.trade_section || "General",
            library_match: null,
        }));

        if (rawItems.length > 0) {
            const { data: library } = await supabase
                .from("cost_library_items")
                .select("description, unit, base_rate, category")
                .eq("is_system_default", true)
                .limit(150);

            if (library && library.length > 0) {
                try {
                    const matchPrompt = `Match each extracted construction item to the closest cost library item.

Extracted items: ${JSON.stringify(rawItems.map((i) => i.item_name))}

Cost library (description|unit|rate per unit):
${library.slice(0, 120).map((l) => `${l.description}|${l.unit}|${l.base_rate}`).join("\n")}

Return JSON: { "matches": [{ "extracted": "item name", "matched": "library description or null", "unit": "m2", "rate": 45.00 }] }
If no good match exists use unit from extracted item and rate 0.`;

                    const matchResult = await generateJSON<{
                        matches: { extracted: string; matched: string | null; unit: string; rate: number }[];
                    }>(matchPrompt);

                    const matches = matchResult.matches || [];
                    extractedItems = extractedItems.map((item) => {
                        const match = matches.find((m) => m.extracted === item.item_name);
                        return {
                            ...item,
                            unit: match?.unit || item.unit,
                            suggested_rate: match?.rate || 0,
                            library_match: match?.matched || null,
                        };
                    });
                } catch {
                    // library matching failed — use raw items with rate 0
                }
            }
        }

        // Update the DB record with results
        const { data: updated } = await supabase
            .from("drawing_extractions")
            .update({
                extracted_items: extractedItems,
                raw_ai_response: rawText.substring(0, 5000),
                status: "processed",
            })
            .eq("id", record.id)
            .select()
            .single();

        revalidatePath(`/dashboard/projects/drawings?projectId=${projectId}`);

        return {
            success: true,
            extraction: updated as DrawingExtraction,
        };
    } catch (error: any) {
        console.error("Drawing analysis error:", error);

        await supabase
            .from("drawing_extractions")
            .update({ status: "error", error_message: error.message?.substring(0, 500) })
            .eq("id", record.id);

        return { success: false, error: error.message || "AI analysis failed" };
    }
}

// ─── Get all extractions for a project ───────────────────────────────────────

export async function getDrawingExtractionsAction(
    projectId: string
): Promise<DrawingExtraction[]> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return [];

    const { data } = await supabase
        .from("drawing_extractions")
        .select("id, project_id, filename, file_size_kb, format, page_count, pages_processed, extracted_items, status, error_message, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

    return (data || []) as DrawingExtraction[];
}

// ─── Add selected items to active estimate ────────────────────────────────────

export async function addItemsToEstimateAction(
    projectId: string,
    items: DrawingResultItem[]
): Promise<{ success: boolean; added: number; error?: string }> {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return { success: false, added: 0, error: "Not authenticated" };

    // Find the active estimate for this project
    const { data: estimate } = await supabase
        .from("estimates")
        .select("id")
        .eq("project_id", projectId)
        .eq("is_active", true)
        .single();

    // If no active estimate, find any estimate
    let estimateId = estimate?.id;
    if (!estimateId) {
        const { data: anyEst } = await supabase
            .from("estimates")
            .select("id")
            .eq("project_id", projectId)
            .order("created_at", { ascending: true })
            .limit(1)
            .single();
        estimateId = anyEst?.id;
    }

    if (!estimateId) {
        return { success: false, added: 0, error: "No estimate found for this project. Create an estimate first." };
    }

    // Insert all items
    const linesToInsert = items.map((item) => ({
        estimate_id: estimateId,
        project_id: projectId,
        trade_section: item.trade_section || "General",
        description: item.item_name,
        quantity: item.estimated_quantity,
        unit: item.unit,
        unit_rate: item.suggested_rate,
        line_total: item.estimated_quantity * item.suggested_rate,
        line_type: "general",
    }));

    const { data: inserted, error: insertErr } = await supabase
        .from("estimate_lines")
        .insert(linesToInsert)
        .select("id");

    if (insertErr) return { success: false, added: 0, error: insertErr.message };

    // Recalculate estimate total
    const { data: lines } = await supabase
        .from("estimate_lines")
        .select("line_total")
        .eq("estimate_id", estimateId);

    const newTotal = (lines || []).reduce((s, l) => s + (l.line_total || 0), 0);
    await supabase.from("estimates").update({ total_cost: newTotal }).eq("id", estimateId);

    revalidatePath(`/dashboard/projects/costs?projectId=${projectId}`);
    revalidatePath(`/dashboard/projects/drawings?projectId=${projectId}`);

    return { success: true, added: inserted?.length || 0 };
}
