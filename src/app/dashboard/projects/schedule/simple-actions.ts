"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { requireEditableProjectAccess } from "@/lib/supabase/project-resource-access";
import { precontractLockMessage } from "@/lib/project-editability";
import { planCoversEveryPhase } from "@/lib/programme-plan";
import { isDefaultJobWorkingPattern, isJobWorkingDay, resolveJobWorkingPattern } from "@/lib/job-working-pattern";
import { computeDisplayProgramme } from "@/lib/relative-programme";
import { readProgrammeInclusion } from "@/lib/programme-inclusion";
import {
    MAX_STAGES,
    MAX_STAGE_NAME_LENGTH,
    MAX_WORKING_DAYS,
    MIN_STAGES,
    PROGRAMME_SAVE_ERROR,
    buildProgrammePhases,
    type SimpleProgrammeInput,
    type ProgrammeSaveResult,
} from "@/lib/simple-programme";

const WorkingPatternSchema = z.object({
    version: z.literal(1), weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
}).strict().refine(value => new Set(value.weekdays).size === value.weekdays.length);

const SimpleProgrammeSchema = z.object({
    projectId: z.string().uuid(),
    timeBasis: z.literal("relative").optional(),
    workingPattern: WorkingPatternSchema.optional(),
    expectedWorkingPattern: WorkingPatternSchema.nullable().optional(),
    startDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]),
    stages: z.array(z.object({
        name: z.string().trim().min(1).max(MAX_STAGE_NAME_LENGTH),
        workingDays: z.number().int().min(1).max(MAX_WORKING_DAYS),
        unit: z.enum(["days", "weeks"]),
        source: z.number().int().min(0).max(199).nullable(),
    })).min(1).max(MAX_STAGES),
});

/**
 * Saves the simple programme: the start date and the stages, in order.
 *
 * The phases are rebuilt here from the saved project, so the dates on the
 * proposal never depend on arithmetic done in the browser and the fields the
 * detailed planner keeps on a phase are carried over from the database, not
 * from the request. Blocked once pre-contract information is locked.
 */
export async function saveSimpleProgrammeAction(projectId: string, input: SimpleProgrammeInput): Promise<ProgrammeSaveResult> {
    const parsed = SimpleProgrammeSchema.safeParse({ projectId, ...input });
    if (!parsed.success) return { success: false, error: "Check the start date and durations, then save again." };
    const { startDate, stages, timeBasis, workingPattern, expectedWorkingPattern } = parsed.data;
    const changesPattern = workingPattern !== undefined;
    if (changesPattern && expectedWorkingPattern === undefined) return { success: false, error: PROGRAMME_SAVE_ERROR };

    const stageCountOk = stages.length === 1 || stages.length >= MIN_STAGES;
    const total = stages.reduce((sum, stage) => sum + stage.workingDays, 0);
    const validStart = timeBasis === "relative" ? startDate === "" : isJobWorkingDay(startDate, workingPattern);
    if (!validStart || !stageCountOk || total > MAX_WORKING_DAYS) {
        return { success: false, error: "Check the start date and durations, then save again." };
    }

    let access: Awaited<ReturnType<typeof requireEditableProjectAccess>>;
    try {
        access = await requireEditableProjectAccess(parsed.data.projectId);
    } catch (error) {
        return { success: false, error: precontractLockMessage(error) ?? "You can't change this project's programme." };
    }
    const { user, supabase } = access;

    const { data: project, error: readError } = await supabase
        .from("projects")
        // An absent, unapplied calendar column must not break legacy saves.
        .select("*")
        .eq("id", parsed.data.projectId)
        .eq("user_id", user.id)
        .single();
    if (readError || !project) {
        console.error("saveSimpleProgrammeAction read failed", { projectId: parsed.data.projectId, code: readError?.code });
        return { success: false, error: PROGRAMME_SAVE_ERROR };
    }
    if (readProgrammeInclusion(project.programme_phases).intent !== "include") {
        return { success: false, error: "Include the programme before editing its activities." };
    }
    const hasPatternColumn = Object.hasOwn(project, "programme_working_pattern");
    const storedPattern = resolveJobWorkingPattern(project.programme_working_pattern);
    if (!storedPattern || (!changesPattern && !isDefaultJobWorkingPattern(storedPattern))) {
        return { success: false, error: "The job's working days changed elsewhere. Reload Programme before saving again." };
    }
    if (changesPattern && !hasPatternColumn) {
        return { success: false, error: "Calendar storage is not set up for this job yet. Nothing was saved." };
    }
    if (changesPattern && !isDeepStrictEqual(
        project.programme_working_pattern == null ? null : resolveJobWorkingPattern(project.programme_working_pattern),
        expectedWorkingPattern,
    )) return { success: false, error: "The job's working days changed elsewhere. Reload Programme before saving again." };

    const phases = buildProgrammePhases({ startDate, stages, timeBasis, workingPattern }, project.programme_phases as unknown[] | null);
    if (!planCoversEveryPhase(computeDisplayProgramme(startDate, phases, workingPattern), phases)) return { success: false, error: PROGRAMME_SAVE_ERROR };

    const updateFields = {
        programme_phases: phases,
        ...(timeBasis === "relative" ? {} : { start_date: startDate }),
        ...(changesPattern ? { programme_working_pattern: workingPattern } : {}),
    };
    let update = supabase
        .from("projects")
        .update(updateFields)
        .eq("id", parsed.data.projectId)
        .eq("user_id", user.id);
    update = project.programme_phases == null ? update.is("programme_phases", null)
        : update.eq("programme_phases", JSON.stringify(project.programme_phases));
    if (hasPatternColumn) update = project.programme_working_pattern == null ? update.is("programme_working_pattern", null)
        : update.eq("programme_working_pattern", JSON.stringify(project.programme_working_pattern));
    const { data: returnedRow, error } = await update.select(changesPattern ? "id,programme_phases,programme_working_pattern,start_date" : "id").single();
    const row: unknown = returnedRow;
    const saved = row && typeof row === "object" && !Array.isArray(row) ? row as Record<string, unknown> : null;
    if (error || !saved) {
        console.error("saveSimpleProgrammeAction update failed", { projectId: parsed.data.projectId, code: error?.code });
        return { success: false, error: PROGRAMME_SAVE_ERROR };
    }
    const savedPhases = Array.isArray(saved.programme_phases) ? saved.programme_phases : null;
    if (changesPattern && (saved.programme_working_pattern == null || !isDeepStrictEqual(savedPhases, phases)
        || !isDeepStrictEqual(resolveJobWorkingPattern(saved.programme_working_pattern), workingPattern)
        || (timeBasis !== "relative" && saved.start_date !== startDate))) {
        return { success: false, error: "The programme save wasn't confirmed and may already have saved. Reload Programme before retrying." };
    }

    revalidatePath("/dashboard/projects/schedule");
    revalidatePath("/dashboard/projects/proposal");
    return changesPattern ? { success: true, confirmedProject: {
        programme_phases: savedPhases,
        programme_working_pattern: workingPattern,
        start_date: typeof saved.start_date === "string" ? saved.start_date : null,
    } } : { success: true };
}
