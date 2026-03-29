"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function saveOnboardingAction(formData: FormData) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return { error: "Not authenticated" };

    // Parse insurance schedule from JSON string
    let insurance_schedule = null;
    const insuranceRaw = formData.get("insurance_schedule") as string;
    if (insuranceRaw) {
        try { insurance_schedule = JSON.parse(insuranceRaw); } catch { /* skip */ }
    }

    // Parse default TC overrides from JSON string
    let default_tc_overrides = null;
    const tcRaw = formData.get("default_tc_overrides") as string;
    if (tcRaw) {
        try { default_tc_overrides = JSON.parse(tcRaw); } catch { /* skip */ }
    }

    const years_trading_raw = formData.get("years_trading") as string;

    const updateData: Record<string, any> = {
        full_name: formData.get("full_name") as string || null,
        company_name: formData.get("company_name") as string || null,
        phone: formData.get("phone") as string || null,
        address: formData.get("address") as string || null,
        website: formData.get("website") as string || null,
        logo_url: formData.get("logo_url") as string || null,
        years_trading: years_trading_raw ? parseInt(years_trading_raw, 10) : null,
        business_type: formData.get("business_type") as string || null,
        specialisms: formData.get("specialisms") as string || null,
        capability_statement: formData.get("capability_statement") as string || null,
        accreditations: formData.get("accreditations") as string || null,
        insurance_schedule,
        default_tc_overrides,
    };

    // Use UPDATE (not upsert) — profile row already exists from signup trigger
    const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

    if (error) {
        return { error: error.message };
    }

    return { success: true };
}

export async function generateCapabilityStatementAction(trade: string, specialisms: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return "AI not configured. Please add your capability statement manually.";

    const genAI = new GoogleGenerativeAI(apiKey);

    const prompt = `Write a 2-paragraph professional capability statement for a UK building contractor with the following profile:
Primary Trade: ${trade}
Specialisms: ${specialisms || "general construction works"}

The statement should:
- Be written in third person ("The Contractor" or the company)
- Sound professional and authoritative
- Highlight expertise, quality, and reliability
- Be suitable for inclusion in a construction proposal document
- Be around 120-160 words total
- Return plain text only, no markdown, no headings`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error: any) {
        return `Error generating statement: ${error.message}`;
    }
}
