"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

export async function analyzeDrawingAction(base64Image: string) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is missing from environment.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Using gemini-1.5-flash-latest as it is fast and supports vision well
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const prompt = `
        ROLE: Expert Quantity Surveyor / Construction Estimator.
        
        TASK: Analyze the provided floor plan or architectural sketch. 
        Identify the visible construction elements required to price this project.
        
        ELEMENTS TO LOOK FOR:
        - Doors (Internal/External)
        - Windows
        - Internal partition walls (estimate length in meters)
        - External walls (estimate length in meters)
        - Room types (Kitchen, Bathroom, etc.)
        - Any specific structural notes.

        FORMAT: Return the result EXCLUSIVELY as a JSON array of objects. 
        Each object must have exactly: "item_name" (text) and "estimated_quantity" (number).
        Ensure the quantity is a reasonable number based on standard construction units (units like "Count" for doors or "Linear Meters" for walls).

        OUTPUT EXAMPLE:
        [
            {"item_name": "Standard Internal Door", "estimated_quantity": 4},
            {"item_name": "Double Glazed Window (1200x1200mm)", "estimated_quantity": 3},
            {"item_name": "Stud Wall Partition (m)", "estimated_quantity": 12.5}
        ]
        
        DO NOT include any text outside strictly formatted JSON.
    `;

    try {
        // Prepare the image for Gemini
        const imagePart = {
            inlineData: {
                data: base64Image.split(',')[1] || base64Image,
                mimeType: "image/jpeg" // Assuming JPEG, but flash handles common formats
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const responseText = result.response.text();

        // Clean up potential markdown code blocks if the AI includes them
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        const cleanedJson = jsonMatch ? jsonMatch[0] : responseText;

        return JSON.parse(cleanedJson);
    } catch (error: any) {
        console.error("AI Vision Error:", error);
        throw new Error(`Failed to analyze drawing: ${error.message}`);
    }
}
