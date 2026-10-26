import type { SupabaseClient } from "@supabase/supabase-js";
import { isDeepStrictEqual } from "node:util";
import { isDefaultJobWorkingPattern, resolveJobWorkingPattern } from "@/lib/job-working-pattern";
import { readProgrammeInclusion, withProgrammeInclusion } from "@/lib/programme-inclusion";
import { planCoversEveryPhase } from "@/lib/programme-plan";
import { computeDisplayProgramme } from "@/lib/relative-programme";

export const PROGRAMME_CHOICE_UNCONFIRMED = "The programme choice wasn't confirmed and may already have saved. Reload Programme before retrying.";

const CALENDAR_CHANGED = "The job's working days changed elsewhere. Reload Programme before saving again.";
// These are operational observations/forecasts, not the saved pre-contract baseline.
const TRACKING_FIELDS = new Set([
    "pct_complete", "actual_start_date", "actual_finish_date", "revised_planned_finish",
    "delay_reason", "delay_category", "delay_notes",
]);

function planningFields(phase: unknown): unknown {
    if (!phase || typeof phase !== "object" || Array.isArray(phase)) return phase;
    return Object.fromEntries(Object.entries(phase).filter(([key]) => !TRACKING_FIELDS.has(key)));
}

/** Compare the complete stored phases and raw calendar, never overwriting a concurrent editor. */
export async function writeProgrammeStorage(
    supabase: SupabaseClient, userId: string, projectId: string,
    change: { include: boolean } | { phases: unknown[]; startDate?: string; expectedWorkingPattern?: unknown },
): Promise<unknown[]> {
    const { data: project, error: readError } = await supabase.from("projects")
        // Selecting * also works before the optional calendar column is applied.
        .select("*").eq("id", projectId).eq("user_id", userId).single();
    if (readError || !project) throw new Error(PROGRAMME_CHOICE_UNCONFIRMED);
    const hasPatternColumn = Object.hasOwn(project, "programme_working_pattern");
    const decision = readProgrammeInclusion(project.programme_phases);
    if (decision.intent === "invalid") throw new Error("Check the saved programme choice before changing it.");
    let next: unknown[];
    if ("include" in change) {
        next = withProgrammeInclusion(project.programme_phases, change.include);
        if ((decision.intent === "include") === change.include) return next;
    } else {
        if (readProgrammeInclusion(change.phases).intent !== "include") throw new Error("Use the explicit programme inclusion choice.");
        const storedPattern = resolveJobWorkingPattern(project.programme_working_pattern);
        if (!storedPattern) throw new Error(CALENDAR_CHANGED);
        if (change.expectedWorkingPattern !== undefined) {
            const expected = resolveJobWorkingPattern(change.expectedWorkingPattern);
            if (!expected || expected.weekdays.length !== storedPattern.weekdays.length
                || !expected.weekdays.every(day => storedPattern.weekdays.includes(day))) throw new Error(CALENDAR_CHANGED);
            // Validate the incoming activities, not their omission metadata or the old plan.
            if (change.phases.length > 200 || !planCoversEveryPhase(
                computeDisplayProgramme(change.startDate ?? project.start_date, change.phases, storedPattern), change.phases,
            )) throw new Error("Check every programme phase's start and duration before saving.");
        } else if (!isDefaultJobWorkingPattern(storedPattern)) {
            const trackingOnly = (change.startDate === undefined || change.startDate === project.start_date)
                && isDeepStrictEqual(decision.phases.map(planningFields), change.phases.map(planningFields));
            if (!trackingOnly) throw new Error(CALENDAR_CHANGED);
        }
        next = withProgrammeInclusion(change.phases, decision.intent === "include");
    }
    // Snapshot the JSON actually sent: optional undefined properties are omitted in storage.
    const expectedPhases: unknown[] = JSON.parse(JSON.stringify(next));
    const startDate = "startDate" in change ? change.startDate : undefined;
    let query = supabase.from("projects").update({
        programme_phases: expectedPhases,
        ...("startDate" in change && change.startDate ? { start_date: change.startDate } : {}),
    }).eq("id", projectId).eq("user_id", userId);
    query = project.programme_phases == null
        ? query.is("programme_phases", null)
        : query.eq("programme_phases", JSON.stringify(project.programme_phases));
    if (hasPatternColumn) query = project.programme_working_pattern == null
        ? query.is("programme_working_pattern", null)
        : query.eq("programme_working_pattern", JSON.stringify(project.programme_working_pattern));
    const readback = ["programme_phases", ...(hasPatternColumn ? ["programme_working_pattern"] : []),
        ...(startDate !== undefined ? ["start_date"] : [])].join(",");
    const { data: returnedRow, error } = await query.select(readback).single();
    const saved: unknown = returnedRow;
    if (error || !saved || typeof saved !== "object" || Array.isArray(saved)
        || !("programme_phases" in saved) || !Array.isArray(saved.programme_phases)
        || !isDeepStrictEqual(saved.programme_phases, expectedPhases)
        || (hasPatternColumn && (!("programme_working_pattern" in saved)
            || !isDeepStrictEqual(saved.programme_working_pattern, project.programme_working_pattern)))
        || (startDate !== undefined && (!("start_date" in saved) || saved.start_date !== startDate))) {
        throw new Error(PROGRAMME_CHOICE_UNCONFIRMED);
    }
    return saved.programme_phases;
}
