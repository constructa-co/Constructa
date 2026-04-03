"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateText } from "@/lib/ai";

export async function updateProfileAction(formData: FormData) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return { success: false, error: "Not authenticated" };

    const profileData: Record<string, any> = {
        id: user.id,
        full_name: formData.get("full_name") as string,
        company_name: formData.get("company_name") as string,
        phone: formData.get("phone") as string,
        website: formData.get("website") as string,
        address: formData.get("address") as string,
        company_number: formData.get("company_number") as string,
        vat_number: formData.get("vat_number") as string,
        years_trading: formData.get("years_trading") ? parseInt(formData.get("years_trading") as string, 10) : null,
        specialisms: formData.get("specialisms") as string,
        capability_statement: formData.get("capability_statement") as string,
        insurance_details: formData.get("insurance_details") as string,
        accreditations: formData.get("accreditations") as string,
        logo_url: formData.get("logo_url") as string,
        business_type: formData.get("business_type") as string,
        sales_email: formData.get("sales_email") as string,
        sales_phone: formData.get("sales_phone") as string,
        accounts_email: formData.get("accounts_email") as string,
        pdf_theme: formData.get("pdf_theme") as string || "slate",
        md_name: formData.get("md_name") as string || null,
        md_message: formData.get("md_message") as string || null,
        preferred_trades: (() => {
            const raw = formData.get("preferred_trades") as string;
            try { return raw ? JSON.parse(raw) : []; } catch { return []; }
        })(),
    };

    // Case studies — stored as JSONB
    const caseStudiesRaw = formData.get("case_studies") as string;
    if (caseStudiesRaw) {
        try {
            (profileData as Record<string, any>).case_studies = JSON.parse(caseStudiesRaw);
        } catch {
            // skip malformed JSON
        }
    } else {
        (profileData as Record<string, any>).case_studies = [];
    }

    const { error } = await supabase.from("profiles").upsert(profileData, { onConflict: "id" });

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/settings/profile");
    return { success: true };
}

export async function rewriteWithAIAction(text: string, fieldName: string): Promise<{ text: string }> {
    const prompts: Record<string, string> = {
        capability_statement: `Rewrite this construction company capability statement to be more compelling, professional and concise. Keep it to 3-4 sentences. Focus on what makes them specialists. Original: "${text}"`,
        accreditations: text,
    };
    const prompt = prompts[fieldName] || `Rewrite this text to be more professional and compelling for a construction company proposal: "${text}"`;
    if (fieldName === "accreditations") return { text };
    const result = await generateText(prompt);
    return { text: result };
}
