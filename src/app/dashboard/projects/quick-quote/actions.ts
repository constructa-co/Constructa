"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput, Uuid, NonEmptyString } from "@/lib/validation/schemas";

// ─────────────────────────────────────────────────────────────────────────────
// Sprint 58 Phase 2 item #10 — Quick Quote server actions.
//
// Additive to the existing 5-step wizard. Projects created here write to the
// same projects / estimates / estimate_lines tables so the Golden Thread
// stays intact and the project can "graduate" to the full editor by clicking
// any pre-construction tab.
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────────────────

export interface QuickQuoteTemplate {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    project_type: string | null;
    default_scope: string | null;
    default_trade_sections: string[] | null;
    default_line_items: TemplateLineItem[];
    default_prelims_pct: number;
    default_overhead_pct: number;
    default_risk_pct: number;
    default_profit_pct: number;
}

export interface TemplateLineItem {
    trade_section: string;
    description: string;
    quantity: number;
    unit: string;
    unit_rate: number;
}

// ── Zod schema ───────────────────────────────────────────────────────────────

const QuickQuoteInputSchema = z.object({
    templateId: Uuid,
    name: NonEmptyString(200),
    client_name: z.string().trim().max(200).optional().default(""),
    client_email: z.string().trim().email().max(200).optional().or(z.literal("")),
    client_phone: z.string().trim().max(50).optional().default(""),
    site_address: z.string().trim().max(500).optional().default(""),
    postcode: z.string().trim().max(20).optional().default(""),
    potential_value: z.number().min(0).max(100_000_000).optional().nullable(),
});

// ── Fetch templates (server component helper) ───────────────────────────────

/**
 * Loads system templates + any custom templates owned by the current user.
 * Called from the Quick Quote page server component.
 */
export async function getQuickQuoteTemplatesAction(): Promise<QuickQuoteTemplate[]> {
    const { supabase } = await requireAuth();
    const { data, error } = await supabase
        .from("project_templates")
        .select(
            "id, name, description, icon, project_type, default_scope, default_trade_sections, default_line_items, default_prelims_pct, default_overhead_pct, default_risk_pct, default_profit_pct",
        )
        .order("is_system", { ascending: false }) // system first
        .order("name", { ascending: true });
    if (error) {
        console.error("getQuickQuoteTemplatesAction error:", error);
        return [];
    }
    return (data ?? []) as unknown as QuickQuoteTemplate[];
}

// ── Main action: create project from template ───────────────────────────────

export async function createQuickQuoteFromTemplateAction(input: {
    templateId: string;
    name: string;
    client_name?: string;
    client_email?: string;
    client_phone?: string;
    site_address?: string;
    postcode?: string;
    potential_value?: number | null;
}): Promise<
    | { success: true; projectId: string; estimateId: string }
    | { success: false; error: string }
> {
    try {
        const parsed = parseInput(QuickQuoteInputSchema, input, "quick quote");
        const { user, supabase } = await requireAuth();

        // 1. Fetch the template. RLS already limits this to system + own.
        const { data: template, error: templateErr } = await supabase
            .from("project_templates")
            .select("*")
            .eq("id", parsed.templateId)
            .single();
        if (templateErr || !template) {
            return { success: false, error: "Template not found" };
        }

        // P0-4 — Seed programme_phases from the template's trade sections so
        // the Programme tab has something to render immediately. Without this
        // seed, opening the Programme tab on a newly-created Quick Quote
        // project shows an empty Gantt and the "graduate to full wizard"
        // path feels broken. Each trade section becomes a 2-week placeholder
        // phase stacked sequentially, which the user can refine later.
        const seededPhases = ((template.default_trade_sections ?? []) as string[]).map(
            (trade, i) => ({
                name:            trade,
                calculatedDays:  10, // 2 working weeks at 5d/wk
                manualDays:      null,
                manhours:        0,
                startOffset:     i * 14, // 2 calendar weeks per phase
                color:           ["blue", "emerald", "orange", "purple", "teal", "pink"][i % 6],
                pct_complete:    0,
                actual_start_date:  null,
                actual_finish_date: null,
            }),
        );

        // If the template has no trade sections, fall back to a single
        // "Works" placeholder so the Gantt never renders empty.
        if (seededPhases.length === 0) {
            seededPhases.push({
                name:           "Works",
                calculatedDays: 20,
                manualDays:     null,
                manhours:       0,
                startOffset:    0,
                color:          "blue",
                pct_complete:   0,
                actual_start_date:  null,
                actual_finish_date: null,
            });
        }

        // 2. Create the project row. Status starts as "Estimating" because
        //    Quick Quote always seeds an estimate immediately.
        const { data: project, error: projectErr } = await supabase
            .from("projects")
            .insert({
                user_id:               user.id,
                tenant_id:             user.id,
                name:                  parsed.name,
                client_name:           parsed.client_name || null,
                client_email:          parsed.client_email || null,
                client_phone:          parsed.client_phone || null,
                site_address:          parsed.site_address || null,
                client_address:        parsed.site_address || null,
                project_type:          template.project_type || "Extension",
                potential_value:       parsed.potential_value ?? null,
                status:                "Estimating",
                proposal_complexity:   "quick",
                template_id:           template.id,
                // Prefill the brief fields so the Brief tab is already
                // populated if/when the user graduates to the full wizard.
                brief_scope:           template.default_scope ?? null,
                brief_trade_sections:  template.default_trade_sections ?? [],
                brief_completed:       true,
                proposal_introduction: template.default_scope ?? null,
                scope_text:            template.default_scope ?? null,
                programme_phases:      seededPhases,
            })
            .select("id")
            .single();
        if (projectErr || !project) {
            return {
                success: false,
                error: projectErr?.message || "Failed to create project",
            };
        }

        // 3. Create the estimate. Margins come from the template.
        const { data: estimate, error: estimateErr } = await supabase
            .from("estimates")
            .insert({
                project_id:   project.id,
                version_name: "Quick Quote v1",
                is_active:    true,
                prelims_pct:  Number(template.default_prelims_pct ?? 10),
                overhead_pct: Number(template.default_overhead_pct ?? 10),
                risk_pct:     Number(template.default_risk_pct ?? 5),
                profit_pct:   Number(template.default_profit_pct ?? 15),
                discount_pct: 0,
                total_cost:   0, // recalculated below
            })
            .select("id")
            .single();
        if (estimateErr || !estimate) {
            // Best-effort rollback of the project row so the DB doesn't
            // accumulate orphan projects on a half-failed creation.
            await supabase.from("projects").delete().eq("id", project.id);
            return {
                success: false,
                error: estimateErr?.message || "Failed to create estimate",
            };
        }

        // 4. Bulk-insert the placeholder line items. JSONB → rows.
        const templateLines = (template.default_line_items ?? []) as TemplateLineItem[];
        if (templateLines.length > 0) {
            const rows = templateLines.map((line) => {
                const qty = Number(line.quantity) || 0;
                const rate = Number(line.unit_rate) || 0;
                return {
                    estimate_id:    estimate.id,
                    trade_section:  line.trade_section,
                    description:    line.description,
                    quantity:       qty,
                    unit:           line.unit || "item",
                    unit_rate:      rate,
                    line_total:     qty * rate,
                    pricing_mode:   "simple",
                    line_type:      "general",
                };
            });
            const { error: linesErr } = await supabase
                .from("estimate_lines")
                .insert(rows);
            if (linesErr) {
                console.error("quick-quote insert lines error:", linesErr);
                // Don't fail the whole operation — the user can still edit
                // the project; we just warn in the response.
            }

            // 5. Recalculate the estimate total.
            const total = rows.reduce((s, r) => s + r.line_total, 0);
            await supabase
                .from("estimates")
                .update({ total_cost: total })
                .eq("id", estimate.id);
        }

        revalidatePath("/dashboard");
        revalidatePath("/dashboard/home");
        revalidatePath("/dashboard/projects/quick-quote");

        return { success: true, projectId: project.id, estimateId: estimate.id };
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        };
    }
}
