"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfileAction(formData: FormData) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

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
    };

    await supabase.from("profiles").upsert(profileData, { onConflict: "id" });

    revalidatePath("/dashboard/settings/profile");
}
