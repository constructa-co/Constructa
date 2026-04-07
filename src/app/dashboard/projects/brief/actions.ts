"use server";
import { generateJSON } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import OpenAI from "openai";

export async function processBriefChatAction(
  message: string,
  projectContext: { name?: string; address?: string; projectType?: string }
): Promise<{
  scope: string;
  clientType: "domestic" | "commercial" | "public";
  suggestedTrades: string[];
  estimatedValue: number;
  startDate: string | null;
  response: string;
}> {
  return generateJSON<{
    scope: string;
    clientType: "domestic" | "commercial" | "public";
    suggestedTrades: string[];
    estimatedValue: number;
    startDate: string | null;
    response: string;
  }>(
    `You are a construction project brief assistant for UK contractors.
    Extract structured information from this contractor's description of their project.

    Project context: ${JSON.stringify(projectContext)}
    Contractor says: "${message}"
    Today's date: ${new Date().toISOString().split("T")[0]}

    Return JSON with:
    - scope: detailed scope of works paragraph (2-3 sentences, professional)
    - clientType: "domestic" | "commercial" | "public"
    - suggestedTrades: array of trade names from this list only (use EXACT names):
      [
        "Site Setup & Preliminaries", "Demolition & Strip Out", "Asbestos Removal",
        "Temporary Works / Propping / Shoring", "Groundworks & Civils", "Drainage",
        "Utilities – Water", "Utilities – Gas", "Utilities – Electric / Ducting",
        "Piling", "Underpinning & Structural Stabilisation", "Concrete / RC Works",
        "Steel Frame / Steel Erection", "Structural Timber / Framing",
        "Masonry / Brickwork / Blockwork", "Cladding & Rainscreen", "Roofing",
        "Waterproofing", "Insulation", "Windows, Doors & Glazing",
        "Builders / General Building", "Scaffolding & Access", "Landscaping & External Works",
        "Surfacing, Paving & Kerbing", "Fencing & Gates", "External Lighting",
        "Domestic Electrical", "Commercial Electrical", "EV Chargers",
        "Domestic Plumbing", "Commercial Plumbing / Public Health", "Mechanical / HVAC",
        "Domestic Heating", "Air Conditioning / Refrigeration",
        "Fire Alarm & Life Safety", "Security / CCTV / Access Control",
        "Drylining & Partitions", "Plastering & Rendering", "Carpentry & Joinery",
        "Kitchen Installation", "Bathroom Installation", "Tiling", "Flooring",
        "Ceilings", "Painting & Decorating", "Fire Stopping",
        "Specialist Finishes", "Waste Management / Logistics"
      ]
    - estimatedValue: estimated contract value in GBP as a number (0 if not mentioned)
    - startDate: if the contractor mentions a start date or month (e.g. "start April", "beginning of June 2026", "start next month"), return it as an ISO date string (YYYY-MM-DD, first day of that month). Return null if not mentioned.
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

  // Auto-scaffold estimate sections from selected trades if an estimate has no lines yet
  if (data.brief_trade_sections?.length) {
    const { data: activeEst } = await supabase
      .from("estimates")
      .select("id, estimate_lines(id)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (activeEst && (!activeEst.estimate_lines || activeEst.estimate_lines.length === 0)) {
      // Insert a placeholder line per trade section (no rate — just scaffolds the section)
      const placeholders = data.brief_trade_sections.map((trade: string) => ({
        estimate_id: activeEst.id,
        trade_section: trade,
        description: "",
        quantity: 1,
        unit: "item",
        unit_rate: 0,
        line_total: 0,
        pricing_mode: "simple",
      }));
      await supabase.from("estimate_lines").insert(placeholders);
    }
  }

  revalidatePath("/dashboard/projects/brief");
  revalidatePath("/dashboard/projects/schedule");
  revalidatePath("/dashboard/projects/proposal");
  revalidatePath("/proposal", "layout");
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

// ─── Sprint 26: Video Walkthrough AI ─────────────────────────────────────────
// base64Frames: array of data:image/jpeg;base64,... strings (up to 20 frames)
// extracted evenly from video duration in-browser

export interface VideoAnalysisResult {
  scope: string;
  suggestedTrades: string[];
  estimatedValue: number;
  observations: string[];   // bullet-point site observations
  startDate: string | null;
}

export async function analyzeVideoAction(
  base64Frames: string[]
): Promise<{ success: boolean; result?: VideoAnalysisResult; error?: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { success: false, error: "AI not configured" };

  const framesToSend = base64Frames.slice(0, 20);

  try {
    const client = new OpenAI({ apiKey });

    const imageContent = framesToSend.map((frame) => {
      const base64Data = frame.includes(",") ? frame.split(",")[1] : frame;
      return {
        type: "image_url" as const,
        image_url: {
          url: `data:image/jpeg;base64,${base64Data}`,
          detail: "low" as const,   // low detail for video frames — faster + cheaper
        },
      };
    });

    const prompt = `You are an expert UK construction surveyor reviewing a site walkthrough video.

These ${framesToSend.length} frames are extracted evenly from a contractor's site survey video.

Analyse the frames and extract:
1. A professional scope of works paragraph (2-3 sentences describing what work is needed)
2. Relevant trade sections from the project
3. Key site observations (condition of existing structure, access issues, notable features, hazards)
4. A rough estimated contract value in GBP (integer, 0 if impossible to estimate)

Return ONLY valid JSON — no markdown, no commentary:
{
  "scope": "Professional scope of works paragraph...",
  "suggestedTrades": ["Trade 1", "Trade 2"],
  "estimatedValue": 50000,
  "observations": ["Observation 1", "Observation 2"],
  "startDate": null
}

Trade sections must come from this list only (use EXACT names):
Site Setup & Preliminaries, Demolition & Strip Out, Asbestos Removal,
Temporary Works / Propping / Shoring, Groundworks & Civils, Drainage,
Utilities – Water, Utilities – Gas, Utilities – Electric / Ducting,
Piling, Underpinning & Structural Stabilisation, Concrete / RC Works,
Steel Frame / Steel Erection, Structural Timber / Framing,
Masonry / Brickwork / Blockwork, Cladding & Rainscreen, Roofing,
Waterproofing, Insulation, Windows, Doors & Glazing,
Builders / General Building, Scaffolding & Access, Landscaping & External Works,
Surfacing, Paving & Kerbing, Fencing & Gates, External Lighting,
Domestic Electrical, Commercial Electrical, EV Chargers,
Domestic Plumbing, Commercial Plumbing / Public Health, Mechanical / HVAC,
Domestic Heating, Air Conditioning / Refrigeration,
Fire Alarm & Life Safety, Security / CCTV / Access Control,
Drylining & Partitions, Plastering & Rendering, Carpentry & Joinery,
Kitchen Installation, Bathroom Installation, Tiling, Flooring,
Ceilings, Painting & Decorating, Fire Stopping,
Specialist Finishes, Waste Management / Logistics`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          ...imageContent,
        ],
      }],
    });

    const rawText = response.choices[0]?.message?.content || "{}";

    let parsed: VideoAnalysisResult;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] || rawText);
    } catch {
      return { success: false, error: "AI returned an unexpected response. Please try again." };
    }

    return {
      success: true,
      result: {
        scope: parsed.scope || "",
        suggestedTrades: Array.isArray(parsed.suggestedTrades) ? parsed.suggestedTrades : [],
        estimatedValue: typeof parsed.estimatedValue === "number" ? parsed.estimatedValue : 0,
        observations: Array.isArray(parsed.observations) ? parsed.observations : [],
        startDate: parsed.startDate || null,
      },
    };
  } catch (err: any) {
    console.error("Video analysis error:", err);
    return { success: false, error: err.message || "Video analysis failed" };
  }
}
