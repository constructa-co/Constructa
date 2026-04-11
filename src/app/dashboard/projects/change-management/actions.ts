"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";
import { CreateChangeEventSchema, parseInput } from "@/lib/validation/schemas";

function revalidate(projectId: string) {
    revalidatePath(`/dashboard/projects/change-management?projectId=${projectId}`);
    revalidatePath(`/dashboard/projects/overview?projectId=${projectId}`);
}

export async function createChangeEventAction(data: {
    project_id: string;
    title: string;
    description?: string;
    type: string;
    issued_by: string;
    clause_reference?: string;
    value_claimed?: number;
    time_claimed_days?: number;
    date_notified?: string;
    notes?: string;
}) {
    const input = parseInput(CreateChangeEventSchema, data, "change event");
    const { user, supabase } = await requireAuth();

    // Auto-number: CE-001, CE-002 …
    const { count } = await supabase
        .from("change_events")
        .select("id", { count: "exact", head: true })
        .eq("project_id", input.project_id);

    const reference = `CE-${String((count ?? 0) + 1).padStart(3, "0")}`;

    const { error } = await supabase.from("change_events").insert([{
        ...input,
        user_id: user.id,
        reference,
        status: "Draft",
        value_claimed: input.value_claimed ?? 0,
        time_claimed_days: input.time_claimed_days ?? 0,
    }]);
    if (error) throw new Error(error.message);
    revalidate(input.project_id);
}

export async function updateChangeEventAction(
    id: string,
    projectId: string,
    data: {
        title?: string;
        description?: string;
        type?: string;
        status?: string;
        issued_by?: string;
        clause_reference?: string;
        value_claimed?: number;
        value_agreed?: number | null;
        time_claimed_days?: number;
        time_agreed_days?: number | null;
        date_notified?: string;
        date_submitted?: string;
        date_assessed?: string;
        date_agreed?: string;
        notes?: string;
    }
) {
    const { supabase } = await requireAuth();
    const { error } = await supabase
        .from("change_events")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error) throw new Error(error.message);
    revalidate(projectId);
}

export async function deleteChangeEventAction(id: string, projectId: string) {
    const { supabase } = await requireAuth();
    const { error } = await supabase.from("change_events").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidate(projectId);
}
