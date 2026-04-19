"use server";

// Stage 4 hardening (19 Apr 2026): saveAsBuiltPhasesAction writes directly to
// the projects row so it now runs through requireProjectAccess and anchors
// the UPDATE by (id, user_id) as defence-in-depth alongside RLS.
import { requireProjectAccess } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";

function revalidate(projectId: string) {
    revalidatePath(`/dashboard/projects/programme?projectId=${projectId}`);
    revalidatePath(`/dashboard/projects/schedule?projectId=${projectId}`);
    revalidatePath(`/dashboard/projects/overview?projectId=${projectId}`);
}

export async function saveAsBuiltPhasesAction(projectId: string, phases: any[]) {
    const { user, supabase } = await requireProjectAccess(projectId);
    const { error } = await supabase
        .from("projects")
        .update({ programme_phases: phases })
        .eq("id", projectId)
        .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    revalidate(projectId);
}
