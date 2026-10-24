import type { SupabaseClient } from "@supabase/supabase-js";
import { readProgrammeInclusion, withProgrammeInclusion } from "@/lib/programme-inclusion";

export const PROGRAMME_CHOICE_UNCONFIRMED = "The programme choice wasn't confirmed and may already have saved. Reload Programme before retrying.";

/** Compare the complete stored JSON, so a concurrent editor is never overwritten. */
export async function writeProgrammeStorage(
    supabase: SupabaseClient, userId: string, projectId: string,
    change: { include: boolean } | { phases: unknown[]; startDate?: string },
): Promise<unknown[]> {
    const { data: project, error: readError } = await supabase.from("projects")
        .select("programme_phases").eq("id", projectId).eq("user_id", userId).single();
    if (readError || !project) throw new Error(PROGRAMME_CHOICE_UNCONFIRMED);
    const decision = readProgrammeInclusion(project.programme_phases);
    if (decision.intent === "invalid") throw new Error("Check the saved programme choice before changing it.");
    let next: unknown[];
    if ("include" in change) {
        next = withProgrammeInclusion(project.programme_phases, change.include);
        if ((decision.intent === "include") === change.include) return next;
    } else {
        if (readProgrammeInclusion(change.phases).intent !== "include") throw new Error("Use the explicit programme inclusion choice.");
        next = withProgrammeInclusion(change.phases, decision.intent === "include");
    }
    let query = supabase.from("projects").update({
        programme_phases: next,
        ...("startDate" in change && change.startDate ? { start_date: change.startDate } : {}),
    }).eq("id", projectId).eq("user_id", userId);
    query = project.programme_phases == null
        ? query.is("programme_phases", null)
        : query.eq("programme_phases", JSON.stringify(project.programme_phases));
    const { data: saved, error } = await query.select("programme_phases").single();
    if (error || !saved || !Array.isArray(saved.programme_phases)) throw new Error(PROGRAMME_CHOICE_UNCONFIRMED);
    if ("include" in change && readProgrammeInclusion(saved.programme_phases).intent !== (change.include ? "include" : "omit")) {
        throw new Error(PROGRAMME_CHOICE_UNCONFIRMED);
    }
    return saved.programme_phases;
}
