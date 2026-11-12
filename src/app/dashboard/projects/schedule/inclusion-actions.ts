"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireEditableProjectAccess } from "@/lib/supabase/project-resource-access";
import { precontractLockMessage } from "@/lib/project-editability";
import { PROGRAMME_CHOICE_UNCONFIRMED, writeProgrammeStorage } from "@/lib/server/programme-storage";

export type SaveProgrammeInclusion = (include: boolean) => Promise<
    { success: true; programmePhases: unknown[] } | { success: false; error: string }
>;

export async function saveProgrammeInclusionAction(projectId: string, include: boolean): ReturnType<SaveProgrammeInclusion> {
    if (!z.object({ projectId: z.string().uuid(), include: z.boolean() }).safeParse({ projectId, include }).success) {
        return { success: false, error: "Choose whether to include the programme." };
    }
    let access: Awaited<ReturnType<typeof requireEditableProjectAccess>>;
    try { access = await requireEditableProjectAccess(projectId); }
    catch (error) { return { success: false, error: precontractLockMessage(error) ?? "You can't change this project's programme." }; }
    try {
        const programmePhases = await writeProgrammeStorage(access.supabase, access.user.id, projectId, { include });
        revalidatePath("/dashboard/projects/schedule");
        revalidatePath("/dashboard/projects/proposal");
        return { success: true, programmePhases };
    } catch { return { success: false, error: PROGRAMME_CHOICE_UNCONFIRMED }; }
}
