"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEditableProjectAccess } from "@/lib/supabase/project-resource-access";
import { precontractLockMessage } from "@/lib/project-editability";
import { isWorkingDay } from "@/lib/programme-plan";
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
} from "@/lib/simple-programme";

const SimpleProgrammeSchema = z.object({
    projectId: z.string().uuid(),
    timeBasis: z.literal("relative").optional(),
    startDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]),
    stages: z.array(z.object({
        name: z.string().trim().min(1).max(MAX_STAGE_NAME_LENGTH),
        workingDays: z.number().int().min(1).max(MAX_WORKING_DAYS),
        unit: z.enum(["days", "weeks"]),
        source: z.number().int().min(0).max(199).nullable(),
    })).min(1).max(MAX_STAGES),
});

type SaveResult = { success: true } | { success: false; error: string };

/**
 * Saves the simple programme: the start date and the stages, in order.
 *
 * The phases are rebuilt here from the saved project, so the dates on the
 * proposal never depend on arithmetic done in the browser and the fields the
 * detailed planner keeps on a phase are carried over from the database, not
 * from the request. Blocked once pre-contract information is locked.
 */
export async function saveSimpleProgrammeAction(projectId: string, input: SimpleProgrammeInput): Promise<SaveResult> {
    const parsed = SimpleProgrammeSchema.safeParse({ projectId, ...input });
    if (!parsed.success) return { success: false, error: "Check the start date and durations, then save again." };
    const { startDate, stages, timeBasis } = parsed.data;

    const stageCountOk = stages.length === 1 || stages.length >= MIN_STAGES;
    const total = stages.reduce((sum, stage) => sum + stage.workingDays, 0);
    const validStart = timeBasis === "relative" ? startDate === "" : isWorkingDay(startDate);
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
        .select("programme_phases")
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

    const phases = buildProgrammePhases({ startDate, stages, timeBasis }, project.programme_phases as unknown[] | null);
    if (!computeDisplayProgramme(startDate, phases)) return { success: false, error: PROGRAMME_SAVE_ERROR };

    let update = supabase
        .from("projects")
        .update(timeBasis === "relative" ? { programme_phases: phases } : { start_date: startDate, programme_phases: phases })
        .eq("id", parsed.data.projectId)
        .eq("user_id", user.id);
    update = project.programme_phases == null ? update.is("programme_phases", null)
        : update.eq("programme_phases", JSON.stringify(project.programme_phases));
    const { data: saved, error } = await update.select("id").single();
    if (error || !saved) {
        console.error("saveSimpleProgrammeAction update failed", { projectId: parsed.data.projectId, code: error?.code });
        return { success: false, error: PROGRAMME_SAVE_ERROR };
    }

    revalidatePath("/dashboard/projects/schedule");
    revalidatePath("/dashboard/projects/proposal");
    return { success: true };
}
