"use server";

import OpenAI from "openai";

export async function analyzeDrawingAction(base64Image: string) {
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
        // Handle both {items: [...]} and [...] responses
        return Array.isArray(parsed) ? parsed : (parsed.items || []);
    } catch (error: any) {
        console.error("AI Vision Error:", error);
        throw new Error(`Failed to analyze drawing: ${error.message}`);
    }
}
