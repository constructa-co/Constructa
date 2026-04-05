"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateDependencyAction(formData: FormData) {
    const supabase = createClient();
    const predecessor = formData.get("predecessor") as string;
    const successor = formData.get("successor") as string;
    const duration = formData.get("duration") as string;

    if (duration) {
        await supabase.from("estimates").update({ manual_duration_days: parseInt(duration) }).eq("id", successor);
    }

    if (predecessor && predecessor !== "none") {
        await supabase.from("estimate_dependencies").delete().eq("successor_id", successor);
        await supabase.from("estimate_dependencies").insert({
            predecessor_id: predecessor,
            successor_id: successor,
            lag_days: 0
        });
    } else if (predecessor === "none") {
        await supabase.from("estimate_dependencies").delete().eq("successor_id", successor);
    }

    revalidatePath("/dashboard/projects/schedule");
}

export async function updatePhasesAction(
    projectId: string,
    phases: {
        name: string;
        calculatedDays: number;
        manualDays: number | null;
        manhours: number;
        startOffset: number;
        color?: string;
        dependsOn?: number[];
    }[],
    startDate?: string   // ISO YYYY-MM-DD — if provided, saves to projects.start_date
): Promise<void> {
    const supabase = createClient();
    const payload: Record<string, unknown> = {
        timeline_phases: phases,
        programme_phases: phases,
    };
    if (startDate) payload.start_date = startDate;

    const { error } = await supabase
        .from("projects")
        .update(payload)
        .eq("id", projectId);

    if (error) console.error("Update phases error:", error);
    revalidatePath("/dashboard/projects/schedule");
    revalidatePath("/dashboard/projects/proposal");
    revalidatePath("/proposal", "layout");
}

export async function getEstimatePhasesAction(
    projectId: string
): Promise<{ name: string; calculatedDays: number; manualDays: number | null; manhours: number; startOffset: number }[]> {
    const supabase = createClient();

    const { data: estimates } = await supabase
        .from("estimates")
        .select("*, estimate_lines(*, estimate_line_components(*))")
        .eq("project_id", projectId)
        .order("created_at");

    const estimate = (estimates || []).find((e: any) => e.is_active) || (estimates || [])[0];
    if (!estimate) return [];

    const sectionManhours: Record<string, number> = {};
    (estimate.estimate_lines || []).forEach((line: any) => {
        const section = line.trade_section || "General";
        const lineManHours = (line.estimate_line_components || []).reduce(
            (sum: number, c: any) => sum + (c.total_manhours || 0),
            0
        );
        sectionManhours[section] = (sectionManhours[section] || 0) + lineManHours * (line.quantity || 1);
    });

    const sections = Object.keys(sectionManhours).filter(s => sectionManhours[s] > 0);

    if (sections.length === 0) {
        const { data: proj } = await supabase
            .from("projects")
            .select("brief_trade_sections, start_date")
            .eq("id", projectId)
            .single();

        if (proj?.brief_trade_sections && (proj.brief_trade_sections as string[]).length > 0) {
            let briefOffset = 0;
            return (proj.brief_trade_sections as string[]).map((trade: string) => {
                const phase = { name: trade, calculatedDays: 10, manualDays: null, manhours: 0, startOffset: briefOffset };
                briefOffset += 14; // 2 calendar weeks at 5-day week default
                return phase;
            });
        }
    }

    // Return working days; client converts to calendar days using daysPerWeek
    let offset = 0;
    return sections.map(section => {
        const manhours = sectionManhours[section];
        const calculatedDays = Math.max(Math.ceil(manhours / 8), 1);
        const phase = { name: section, calculatedDays, manualDays: null, manhours, startOffset: offset };
        offset += calculatedDays; // client re-sequences on load
        return phase;
    });
}

export async function saveProgrammePhasesAction(
    projectId: string,
    phases: any[]
): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
        .from("projects")
        .update({ programme_phases: phases })
        .eq("id", projectId);

    if (error) console.error("Save programme phases error:", error);
    revalidatePath("/dashboard/projects/schedule");
}
