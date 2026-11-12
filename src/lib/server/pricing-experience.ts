import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { caseLibraryEnabled } from "../case-library/gate";
import { readProposalLibrary } from "../case-library/proposal-read";
import { sessionReader } from "../case-library/store";
import { pricingExperienceSource } from "../pricing-experience";

function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]));
    return value;
}

export async function loadPricingExperienceSource(supabase: Pick<SupabaseClient, "from">, userId: string, selected: unknown) {
    if (selected !== null && (!Array.isArray(selected) || selected.some(tick => typeof tick !== "string"))) return null;
    const { data, error } = await supabase.from("profiles").select("case_studies").eq("id", userId).single();
    if (error || !data || (data.case_studies !== null && !Array.isArray(data.case_studies))) return null;
    const library = caseLibraryEnabled() ? await readProposalLibrary(sessionReader(supabase), userId, selected) : undefined;
    const catalog = { older: data.case_studies, library: library ? { ...library, rows: [...library.rows].sort((a, b) => a.id.localeCompare(b.id)) } : null };
    const key = createHash("sha256").update(JSON.stringify(canonical(catalog))).digest("hex");
    return pricingExperienceSource(key, data.case_studies, selected, library);
}
