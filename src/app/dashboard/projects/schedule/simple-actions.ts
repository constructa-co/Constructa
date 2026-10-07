"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEditableProjectAccess } from "@/lib/supabase/project-resource-access";
import { precontractLockMessage } from "@/lib/project-editability";
import { computeProgrammePlan, isWorkingDay } from "@/lib/programme-plan";
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
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
    const { startDate, stages } = parsed.data;

    const stageCountOk = stages.length === 1 || stages.length >= MIN_STAGES;
    const total = stages.reduce((sum, stage) => sum + stage.workingDays, 0);
    if (!isWorkingDay(startDate) || !stageCountOk || total > MAX_WORKING_DAYS) {
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

    const phases = buildProgrammePhases({ startDate, stages }, project.programme_phases as unknown[] | null);
    if (!computeProgrammePlan(startDate, phases)) return { success: false, error: PROGRAMME_SAVE_ERROR };

    const { data: saved, error } = await supabase
        .from("projects")
        .update({ start_date: startDate, programme_phases: phases })
        .eq("id", parsed.data.projectId)
        .eq("user_id", user.id)
        .select("id")
        .single();
    if (error || !saved) {
        console.error("saveSimpleProgrammeAction update failed", { projectId: parsed.data.projectId, code: error?.code });
        return { success: false, error: PROGRAMME_SAVE_ERROR };
    }

    revalidatePath("/dashboard/projects/schedule");
    revalidatePath("/dashboard/projects/proposal");
    return { success: true };
}
