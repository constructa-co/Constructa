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
  scope: string,
  tradeSections: string[]
): Promise<{
  sections: Array<{
    trade: string;
    lines: Array<{ description: string; unit: string; quantity: number }>
  }>
}> {
  return generateJSON<{
    sections: Array<{
      trade: string;
      lines: Array<{ description: string; unit: string; quantity: number }>
    }>
  }>(
    `You are a UK construction estimator. Based on this project scope, suggest specific line items for a Bill of Quantities.

    Scope: "${scope?.substring(0, 800) || "General construction works"}"
    Trade sections: ${tradeSections.slice(0, 8).join(", ")}

    For each relevant trade section, suggest 3-5 specific measurable line items.
    Use standard UK construction units (m, m², m³, nr, item, m run).
    Make descriptions specific and professional (e.g. "Excavate topsoil 150mm deep" not just "Excavation").

    Return JSON: { "sections": [{ "trade": "trade name", "lines": [{ "description": "item description", "unit": "m²", "quantity": 10 }] }] }
    Only include trades from the provided list.`
  );
}
