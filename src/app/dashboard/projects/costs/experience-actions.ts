"use server";

import { isDeepStrictEqual } from "node:util";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEditableProjectAccess } from "@/lib/supabase/project-resource-access";
import { precontractLockMessage } from "@/lib/project-editability";
import { loadPricingExperienceSource } from "@/lib/server/pricing-experience";
import { pricingExperienceChangeError, type PricingExperienceSource } from "@/lib/pricing-experience";

type Failure = { success: false; error: string; uncertain?: boolean };
export async function savePricingExperienceAction(projectId: string, expected: { catalogKey: string; selected: string[] | null }, selected: string[]): Promise<{ success: true; source: PricingExperienceSource } | Failure> {
    const choices = z.array(z.string().min(1).max(100)).max(50);
    const parsed = z.object({ projectId: z.string().uuid(), expected: z.object({ catalogKey: z.string().regex(/^[a-f0-9]{64}$/), selected: z.array(z.string()).nullable() }).strict(), selected: choices }).strict().safeParse({ projectId, expected, selected });
    if (!parsed.success) return { success: false, error: "Check the saved choices. Nothing has been shortened or changed." };
    let access;
    try { access = await requireEditableProjectAccess(projectId); }
    catch (error) { return { success: false, error: precontractLockMessage(error) ?? "You can't change these proposal choices." }; }
    const { supabase, user } = access;
    const columns = "id, selected_case_study_ids";
    const { data: project, error: readError } = await supabase.from("projects").select(columns).eq("id", projectId).eq("user_id", user.id).single();
    if (readError || !project || !isDeepStrictEqual(project.selected_case_study_ids, expected.selected)) return { success: false, error: "The saved choices couldn't be confirmed or changed elsewhere. Keep your draft and reload." };
    const source = await loadPricingExperienceSource(supabase, user.id, project.selected_case_study_ids);
    if (!source || source.catalogKey !== expected.catalogKey) return { success: false, error: "The saved experience sources changed or couldn't be read. Keep your draft and reload." };
    const problem = pricingExperienceChangeError(source, selected);
    if (problem) return { success: false, error: problem };
    const query = supabase.from("projects").update({ selected_case_study_ids: selected }).eq("id", projectId).eq("user_id", user.id);
    const guarded = expected.selected === null ? query.is("selected_case_study_ids", null) : query.eq("selected_case_study_ids", JSON.stringify(expected.selected));
    const { data: saved, error } = await guarded.select(columns).single();
    if (error || saved?.id !== projectId || !isDeepStrictEqual(saved.selected_case_study_ids, selected)) return { success: false, uncertain: true, error: "The selection save wasn't confirmed. It may have saved. Keep your draft and reload before saving again." };
    // Sources live in other rows: recheck after the acknowledged selection write, without claiming an atomic cross-table transaction.
    const confirmed = await loadPricingExperienceSource(supabase, user.id, selected);
    if (!confirmed || confirmed.catalogKey !== source.catalogKey) return { success: false, uncertain: true, error: "Experience sources changed while saving. Your selection may have saved; keep the draft and reload to review it." };
    revalidatePath("/dashboard/projects/costs"); revalidatePath("/dashboard/projects/proposal");
    return { success: true, source: confirmed };
}
