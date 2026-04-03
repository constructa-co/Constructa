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
  const { error } = await supabase.from("projects").update(data).eq("id", projectId);
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
    `You are a UK construction estimator. Based on this project scope, suggest line items for a Bill of Quantities.

    Scope: "${scope}"
    Trade sections involved: ${tradeSections.join(", ")}

    For each trade section, suggest 3-5 specific measurable line items.
    Each line item should be a specific work activity with realistic quantities.

    Return JSON: { "sections": [{ "trade": "trade name", "lines": [{ "description": "item", "unit": "m2", "quantity": 10 }] }] }

    Only suggest lines for the trades listed. Use standard UK construction units (m, m2, m3, nr, item, day, week, tonne, kg, lm).`
  );
}
