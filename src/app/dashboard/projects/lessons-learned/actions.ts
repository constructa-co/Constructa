"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateText } from "@/lib/ai";

function revalidate(projectId: string) {
    revalidatePath(`/dashboard/projects/lessons-learned?projectId=${projectId}`);
}

// ── Review record (upsert) ────────────────────────────────────────────────────

export async function upsertLessonsLearnedAction(projectId: string, data: {
    overall_rating?:      number | null;
    client_satisfaction?: number | null;
    financial_outcome?:   string;
    programme_outcome?:   string;
    summary?:             string;
    ai_narrative?:        string;
}) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) throw new Error("Not authenticated");

    const { error } = await supabase
        .from("lessons_learned")
        .upsert([{ project_id: projectId, user_id: userId, ...data, updated_at: new Date().toISOString() }], { onConflict: "project_id" });
    if (error) throw new Error(error.message);
    revalidate(projectId);
}

// ── Lesson items ──────────────────────────────────────────────────────────────

export async function createLessonItemAction(data: {
    project_id:      string;
    type:            string;
    category:        string;
    title:           string;
    detail?:         string;
    impact:          string;
    action_required: boolean;
    action_owner?:   string;
    order_index:     number;
}) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) throw new Error("Not authenticated");

    const { error } = await supabase.from("lesson_items").insert([{ ...data, user_id: userId }]);
    if (error) throw new Error(error.message);
    revalidate(data.project_id);
}

export async function updateLessonItemAction(id: string, projectId: string, data: {
    type?:            string;
    category?:        string;
    title?:           string;
    detail?:          string;
    impact?:          string;
    action_required?: boolean;
    action_owner?:    string;
}) {
    const supabase = createClient();
    const { error } = await supabase.from("lesson_items").update(data).eq("id", id);
    if (error) throw new Error(error.message);
    revalidate(projectId);
}

export async function deleteLessonItemAction(id: string, projectId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("lesson_items").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidate(projectId);
}

// ── AI narrative ──────────────────────────────────────────────────────────────

export async function generateLessonsNarrativeAction(projectId: string): Promise<string> {
    const supabase = createClient();

    const [{ data: project }, { data: review }, { data: items }] = await Promise.all([
        supabase.from("projects").select("name, client_name").eq("id", projectId).single(),
        supabase.from("lessons_learned").select("*").eq("project_id", projectId).maybeSingle(),
        supabase.from("lesson_items").select("*").eq("project_id", projectId).order("order_index"),
    ]);

    const wentWell   = (items ?? []).filter(i => i.type === "Went Well");
    const improve    = (items ?? []).filter(i => i.type === "Improvement");
    const risks      = (items ?? []).filter(i => i.type === "Risk");
    const actions    = (items ?? []).filter(i => i.action_required);

    const prompt = `You are a construction project manager writing a professional post-project lessons learned summary.

Project: ${project?.name ?? "Unknown"}
Client: ${project?.client_name ?? "Unknown"}
Overall Rating: ${review?.overall_rating ?? "Not rated"}/5
Client Satisfaction: ${review?.client_satisfaction ?? "Not rated"}/5
Financial Outcome: ${review?.financial_outcome ?? "Not recorded"}
Programme Outcome: ${review?.programme_outcome ?? "Not recorded"}
${review?.summary ? `Project Summary: ${review.summary}` : ""}

What Went Well (${wentWell.length} items):
${wentWell.map(i => `- [${i.category}] ${i.title}${i.detail ? ": " + i.detail : ""}`).join("\n") || "None recorded"}

Areas for Improvement (${improve.length} items):
${improve.map(i => `- [${i.category}] ${i.title}${i.detail ? ": " + i.detail : ""}`).join("\n") || "None recorded"}

Risks Identified (${risks.length} items):
${risks.map(i => `- [${i.category}] ${i.title}${i.detail ? ": " + i.detail : ""}`).join("\n") || "None recorded"}

Actions Required (${actions.length} items):
${actions.map(i => `- ${i.title}${i.action_owner ? " (Owner: " + i.action_owner + ")" : ""}`).join("\n") || "None"}

Write a concise 3-4 paragraph professional narrative summarising the key lessons from this project.
Focus on what the team should carry forward and what should be done differently next time.
Be honest but constructive. End with 2-3 bullet-point recommendations.`;

    const narrative = await generateText(prompt);

    await supabase
        .from("lessons_learned")
        .upsert([{ project_id: projectId, ai_narrative: narrative, updated_at: new Date().toISOString() }], { onConflict: "project_id" });

    revalidate(projectId);
    return narrative;
}
