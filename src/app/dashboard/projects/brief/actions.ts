"use server";
import { generateJSON } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function processBriefChatAction(
  message: string,
  projectContext: { name?: string; address?: string; projectType?: string }
): Promise<{
  scope: string;
  clientType: "domestic" | "commercial" | "public";
  suggestedTrades: string[];
  estimatedValue: number;
  response: string;
}> {
  return generateJSON<{
    scope: string;
    clientType: "domestic" | "commercial" | "public";
    suggestedTrades: string[];
    estimatedValue: number;
    response: string;
  }>(
    `You are a construction project brief assistant for UK contractors.
    Extract structured information from this contractor's description of their project.

    Project context: ${JSON.stringify(projectContext)}
    Contractor says: "${message}"

    Return JSON with:
    - scope: detailed scope of works paragraph (2-3 sentences, professional)
    - clientType: "domestic" | "commercial" | "public"
    - suggestedTrades: array of trade names from this list only: [
        "Groundworks & Civils", "Drainage", "Concrete / RC Works", "Masonry / Brickwork / Blockwork",
        "Carpentry & Joinery", "Roofing", "Domestic Electrical", "Domestic Plumbing", "Domestic Heating",
        "Plastering & Rendering", "Painting & Decorating", "Flooring", "Tiling", "Kitchen Installation",
        "Bathroom Installation", "Windows, Doors & Glazing", "Insulation", "Drylining & Partitions",
        "Landscaping & External Works", "Steel Frame / Steel Erection", "Structural Timber / Framing",
        "Commercial Electrical", "Commercial Plumbing / Public Health", "Mechanical / HVAC",
        "Surfacing, Paving & Kerbing", "Demolition & Strip Out", "Site Setup & Preliminaries",
        "Builders / General Building", "EV Chargers", "Fencing & Gates"
      ]
    - estimatedValue: estimated contract value in GBP as a number (0 if not mentioned)
    - response: friendly conversational reply confirming what was extracted and asking if it looks right`
  );
}

export async function saveBriefAction(projectId: string, data: {
  brief_scope: string;
  brief_trade_sections: string[];
  client_type: string;
  lat?: number;
  lng?: number;
  region?: string;
  brief_completed: boolean;
  potential_value?: number;
  start_date?: string;
}) {
  const supabase = createClient();

  // Fetch existing proposal fields so we don't overwrite them
  const { data: existing } = await supabase
    .from("projects")
    .select("proposal_introduction, scope_text")
    .eq("id", projectId)
    .single();

  const updateData: any = { ...data };

  // Pre-fill proposal_introduction if not already written
  if (!existing?.proposal_introduction && data.brief_scope) {
    updateData.proposal_introduction = data.brief_scope;
  }

  // Pre-fill scope_text if not already written
  if (!existing?.scope_text && data.brief_scope) {
    updateData.scope_text = data.brief_scope;
  }

  const { error } = await supabase.from("projects").update(updateData).eq("id", projectId);
  if (error) console.error("Save brief error:", error);
  revalidatePath("/dashboard/projects/brief");
}

export async function suggestEstimateLineItemsAction(
  projectId: string,
  scope: string,
  tradeSections: string[]
): Promise<{ success: boolean; sectionsCreated: number; linesCreated: number; error?: string }> {
  try {
    const supabase = createClient();

    // Step 1: Find or create estimate
    const { data: existingEstimate } = await supabase
      .from('estimates')
      .select('id')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let estimateId = existingEstimate?.id;

    if (!estimateId) {
      const { data: newEst, error: estErr } = await supabase
        .from('estimates')
        .insert({
          project_id: projectId,
          version_name: 'Estimate v1',
          overhead_pct: 10,
          profit_pct: 15,
          risk_pct: 5,
          prelims_pct: 10,
          is_active: true,
        })
        .select('id')
        .single();

      if (estErr || !newEst) {
        return { success: false, sectionsCreated: 0, linesCreated: 0, error: `Estimate creation failed: ${estErr?.message}` };
      }
      estimateId = newEst.id;
    }

    // Step 2: AI suggestions
    const scopeText = scope?.substring(0, 1000) || 'General construction works';
    const tradesText = tradeSections.slice(0, 6).join(', ') || 'General';

    const result = await generateJSON<{
      sections: Array<{
        trade: string;
        lines: Array<{ description: string; unit: string; quantity: number }>
      }>
    }>(
      `You are a UK construction estimator. Generate a Bill of Quantities for this project.

      Scope: "${scopeText}"
      Trade sections: ${tradesText}

      For each relevant trade section (max 4 sections), provide 3-5 specific measurable line items.
      Use UK construction standard: descriptions should be specific activities with materials
      (e.g. "Excavate topsoil 150mm by machine" not just "Excavation").
      Units: m, m², m³, nr, item, lm, tonne.
      Quantities should be realistic estimates based on typical project scale.

      Return ONLY valid JSON: { "sections": [{ "trade": "trade name from the list", "lines": [{ "description": "...", "unit": "m²", "quantity": 10 }] }] }`
    );

    // Step 3: Delete any existing zero-rate suggested lines to avoid duplicates
    await supabase
      .from('estimate_lines')
      .delete()
      .eq('estimate_id', estimateId)
      .eq('unit_rate', 0)
      .eq('pricing_mode', 'simple');

    // Step 4: Insert new lines
    let linesCreated = 0;
    for (const section of result.sections || []) {
      for (const line of section.lines || []) {
        if (!line.description) continue;
        const { error } = await supabase.from('estimate_lines').insert({
          estimate_id: estimateId,
          trade_section: section.trade,
          description: line.description,
          quantity: Number(line.quantity) || 1,
          unit: line.unit || 'nr',
          unit_rate: 0,
          line_total: 0,
          pricing_mode: 'simple',
        });
        if (!error) linesCreated++;
      }
    }

    return {
      success: true,
      sectionsCreated: result.sections?.length || 0,
      linesCreated,
    };
  } catch (err: any) {
    console.error('suggestEstimateLineItemsAction error:', err);
    return { success: false, sectionsCreated: 0, linesCreated: 0, error: err.message };
  }
}
