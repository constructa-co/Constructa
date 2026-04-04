"use server";

import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { generateJSON } from "@/lib/ai";

interface ExtractedRawItem {
    item_name: string;
    estimated_quantity: number;
}

interface MatchResult {
    extracted: string;
    matched: string | null;
    unit: string;
    rate: number;
}

export interface VisionResultItem {
    item_name: string;
    estimated_quantity: number;
    unit: string;
    suggested_rate: number;
    library_match?: string | null;
}

export async function analyzeDrawingAction(
    base64Image: string,
    orgId?: string
): Promise<VisionResultItem[]> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error("OPENAI_API_KEY is missing from environment.");

    const client = new OpenAI({ apiKey });

    const prompt = `You are an expert Quantity Surveyor / Construction Estimator.
Analyze the provided floor plan or architectural sketch.
Identify the visible construction elements required to price this project.

ELEMENTS TO LOOK FOR:
- Doors (Internal/External)
- Windows
- Internal partition walls (estimate length in meters)
- External walls (estimate length in meters)
- Room types (Kitchen, Bathroom, etc.)
- Any specific structural notes.

Return EXCLUSIVELY a JSON array. Each object must have exactly: "item_name" (text) and "estimated_quantity" (number).

EXAMPLE:
[
    {"item_name": "Standard Internal Door", "estimated_quantity": 4},
    {"item_name": "Double Glazed Window", "estimated_quantity": 3},
    {"item_name": "Stud Wall Partition (m)", "estimated_quantity": 12.5}
]

DO NOT include any text outside the JSON array.`;

    try {
        const imageData = base64Image.split(',')[1] || base64Image;
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageData}` } }
                ]
            }],
            response_format: { type: "json_object" },
        });

        const text = response.choices[0]?.message?.content || "[]";
        const parsed = JSON.parse(text);
        const extractedItems: ExtractedRawItem[] = Array.isArray(parsed) ? parsed : (parsed.items || []);

        // Step 2: Match each item to the cost library
        const supabase = createClient();

        const { data: library } = await supabase
            .from("cost_library_items")
            .select("description, unit, base_rate, category")
            .or(`is_system_default.eq.true${orgId ? `,organization_id.eq.${orgId}` : ""}`)
            .order("category");

        if (!library || library.length === 0) {
            return extractedItems.map((item) => ({
                item_name: item.item_name,
                estimated_quantity: item.estimated_quantity,
                unit: "nr",
                suggested_rate: 0,
                library_match: null,
            }));
        }

        // Use AI to match extracted items to library items
        const matchPrompt = `Match each extracted construction item to the most appropriate item from this cost library.

Extracted items: ${JSON.stringify(extractedItems.map((i) => i.item_name))}

Cost library (description|unit|rate):
${library.slice(0, 100).map(l => `${l.description}|${l.unit}|\u00A3${l.base_rate}`).join("\n")}

For each extracted item, return the best matching library item name, its unit, and rate.
If no good match exists, return unit "nr" and rate 0.

Return JSON: { "matches": [{ "extracted": "item name", "matched": "library description or null", "unit": "m2", "rate": 45.00 }] }`;

        const matchResult = await generateJSON<{ matches: MatchResult[] }>(matchPrompt);
        const matches = matchResult.matches || [];

        return extractedItems.map((item) => {
            const match = matches.find((m) => m.extracted === item.item_name);
            return {
                item_name: item.item_name,
                estimated_quantity: item.estimated_quantity,
                unit: match?.unit || "nr",
                suggested_rate: match?.rate || 0,
                library_match: match?.matched || null,
            };
        });
    } catch (error: any) {
        console.error("AI Vision Error:", error);
        throw new Error(`Failed to analyze drawing: ${error.message}`);
    }
}
