"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
