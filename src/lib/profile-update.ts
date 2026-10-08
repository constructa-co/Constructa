/**
 * What the Company Profile form is allowed to save, built from the posted
 * form. Shared by the real server action and the fixture harness so both
 * apply exactly the same rule.
 *
 * Case studies are NOT in it, whatever is posted. They have their own page
 * and their own save. The profile action used to write the whole list from
 * this form, and an empty list when the field was missing, which let a
 * profile saved from an out-of-date page wipe case studies added elsewhere.
 * A `case_studies` field in the form data is ignored: absent, stale, empty
 * or malformed, it never reaches the database from here.
 *
 * Every other field is read exactly as the action read it before.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function profileUpdateFromForm(userId: string, formData: FormData): Record<string, any> {
    return {
        id: userId,
        full_name: formData.get("full_name") as string,
        company_name: formData.get("company_name") as string,
        phone: formData.get("phone") as string,
        website: formData.get("website") as string,
        address: formData.get("address") as string,
        company_number: formData.get("company_number") as string,
        vat_number: formData.get("vat_number") as string,
        years_trading: formData.get("years_trading") ? parseInt(formData.get("years_trading") as string, 10) : null,
        financial_year_start_month: formData.get("financial_year_start_month") ? parseInt(formData.get("financial_year_start_month") as string, 10) : 4,
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
        data_consent: formData.get("data_consent") === "true",
        data_consent_at: formData.get("data_consent") === "true" ? new Date().toISOString() : null,
    };
}
