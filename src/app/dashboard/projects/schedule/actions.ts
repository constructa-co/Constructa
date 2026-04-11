"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";
import { generateText } from "@/lib/ai";
import { UpdatePhasesSchema, parseInput } from "@/lib/validation/schemas";

export async function updateDependencyAction(formData: FormData) {
    const { supabase } = await requireAuth();
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
    const input = parseInput(UpdatePhasesSchema, { projectId, phases, startDate }, "programme phases");
    const { user, supabase } = await requireAuth();
    // Note: projects has no `timeline_phases` column — writing it used to cause the
    // whole UPDATE to fail silently, meaning programme edits weren't saved.
    const payload: Record<string, unknown> = {
        programme_phases: input.phases,
    };
    if (input.startDate) payload.start_date = input.startDate;

    const { error } = await supabase
        .from("projects")
        .update(payload)
        .eq("id", input.projectId)
        .eq("user_id", user.id);

    if (error) console.error("Update phases error:", error);
    revalidatePath("/dashboard/projects/schedule");
    revalidatePath("/dashboard/projects/proposal");
    revalidatePath("/proposal", "layout");
}

export async function getEstimatePhasesAction(
    projectId: string
): Promise<{ name: string; calculatedDays: number; manualDays: number | null; manhours: number; startOffset: number }[]> {
    const { supabase } = await requireAuth();

    const { data: estimates } = await supabase
        .from("estimates")
        .select("*, estimate_lines(*, estimate_line_components(*))")
        .eq("project_id", projectId)
        .order("created_at");

    // Use whatever estimate is marked active — if the client BoQ has been imported it
    // will be set as active and its sections become the programme phases.
    const estimate =
        (estimates || []).find((e: any) => e.is_active) ||
        (estimates || [])[0];
    if (!estimate) return [];

    const sectionManhours: Record<string, number> = {};
    const sectionHasLines: Record<string, boolean> = {};

    (estimate.estimate_lines || []).forEach((line: any) => {
        const section = line.trade_section || "General";
        sectionHasLines[section] = true;

        const lineManHours = (line.estimate_line_components || []).reduce(
            (sum: number, c: any) => sum + (c.total_manhours || 0),
            0
        );
        sectionManhours[section] = (sectionManhours[section] || 0) + lineManHours * (line.quantity || 1);
    });

    // Include all sections that have lines — not just those with calculated manhours.
    // Lines added from Drawing AI Takeoff (and other simple lines) have no components
    // so their manhours = 0, but they should still appear as programme phases.
    // For sections with no manhour data, default to 5 working days as a placeholder.
    const allSections = Object.keys(sectionHasLines);
    const sections = allSections.length > 0
        ? allSections
        : Object.keys(sectionManhours).filter(s => sectionManhours[s] > 0);

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
        const manhours = sectionManhours[section] || 0;
        // If no manhour data (e.g. simple lines from Drawing AI Takeoff),
        // default to 5 working days so the phase still appears on the Gantt
        const calculatedDays = manhours > 0 ? Math.max(Math.ceil(manhours / 8), 1) : 5;
        const phase = { name: section, calculatedDays, manualDays: null, manhours, startOffset: offset };
        offset += calculatedDays;
        return phase;
    });
}

export async function saveProgrammePhasesAction(
    projectId: string,
    phases: any[]
): Promise<void> {
    const { supabase } = await requireAuth();
    const { error } = await supabase
        .from("projects")
        .update({ programme_phases: phases })
        .eq("id", projectId);

    if (error) console.error("Save programme phases error:", error);
    revalidatePath("/dashboard/projects/schedule");
}

// ── Sprint 31: Live Programme Tracking ───────────────────────────────────────

export async function generateWeeklyUpdateAction(projectId: string): Promise<string> {
    const { supabase } = await requireAuth();

    const { data: project } = await supabase
        .from("projects")
        .select("name, client_name, start_date, programme_phases")
        .eq("id", projectId)
        .single();

    if (!project) throw new Error("Project not found");

    const phases: any[] = project.programme_phases || [];
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const phaseLines = phases.map((p: any) => {
        const pct = p.pct_complete ?? 0;
        const status = pct === 100 ? "Complete" : pct > 0 ? `${pct}% complete` : "Not started";
        const actual = p.actual_start_date ? `Started ${new Date(p.actual_start_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "";
        return `- ${p.name}: ${status}${actual ? ` (${actual})` : ""}${p.actual_finish_date ? `, finished ${new Date(p.actual_finish_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}`;
    }).join("\n");

    const overallPct = phases.length > 0
        ? Math.round(phases.reduce((s: number, p: any) => s + (p.pct_complete ?? 0), 0) / phases.length)
        : 0;

    const prompt = `You are a construction project manager writing a concise weekly progress update for a UK contractor.

Project: ${project.name}
Client: ${project.client_name || "Client"}
Report date: ${today}
Overall completion: ${overallPct}%

Phase progress:
${phaseLines}

Write a professional weekly progress update in plain English (3–5 short paragraphs). Cover:
1. Overall progress summary
2. What was completed or is in progress this week
3. Any phases not yet started and planned sequence
4. A positive, professional closing note

Keep it factual, concise and suitable to send directly to the client. Do not use bullet points. Use UK English spelling.`;

    const narrative = await generateText(prompt);

    // Store the narrative
    await supabase.from("programme_updates").insert([{
        project_id:      projectId,
        narrative,
        phases_snapshot: phases,
    }]);

    revalidatePath(`/dashboard/projects/schedule?projectId=${projectId}`);
    return narrative;
}

export async function getProgrammeUpdatesAction(projectId: string) {
    const { supabase } = await requireAuth();
    const { data } = await supabase
        .from("programme_updates")
        .select("id, narrative, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(10);
    return data || [];
}
