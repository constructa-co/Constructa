"use server";

import { requireAuth } from "@/lib/supabase/auth-utils";
import { PROJECT_TEMPLATES } from "@/lib/templates";
import { CreateProjectFromTemplateSchema, parseInput } from "@/lib/validation/schemas";

type CreateProjectResult =
    | { success: true; projectId: string }
    | { success: false; error: string };

export async function createProjectFromTemplateAction(
    formData: FormData,
): Promise<CreateProjectResult> {
    try {
        const potentialValueRaw = String(formData.get("potentialValue") ?? "").trim();
        const input = parseInput(CreateProjectFromTemplateSchema, {
            requestId: String(formData.get("requestId") ?? ""),
            name: String(formData.get("name") ?? ""),
            client: String(formData.get("client") ?? ""),
            clientEmail: String(formData.get("clientEmail") ?? ""),
            clientPhone: String(formData.get("clientPhone") ?? ""),
            clientAddress: String(formData.get("clientAddress") ?? ""),
            siteAddress: String(formData.get("siteAddress") ?? ""),
            projectType: String(formData.get("projectType") ?? "Extension"),
            startDate: String(formData.get("startDate") ?? ""),
            potentialValue: potentialValueRaw ? Number(potentialValueRaw) : null,
            typeId: String(formData.get("typeId") ?? ""),
        }, "new project");
        const { supabase } = await requireAuth();

        const template = PROJECT_TEMPLATES.find((candidate) => candidate.id === input.typeId);
        if (!template) return { success: false, error: "Project template not found" };

        const project = {
            name: input.name,
            client_name: input.client,
            client_email: input.clientEmail || null,
            client_phone: input.clientPhone || null,
            client_address: input.clientAddress || input.siteAddress || null,
            site_address: input.siteAddress || input.clientAddress || null,
            project_type: input.projectType,
            start_date: input.startDate || null,
            potential_value: input.potentialValue ?? null,
            status: template.items.length > 0 ? "Estimating" : "Lead",
            proposal_complexity: "full",
        };
        const estimates = template.items.map((item, index) => ({
            version_name: item.name,
            total_cost: item.cost,
            overhead_pct: 10,
            profit_pct: 20,
            risk_pct: 0,
            prelims_pct: 0,
            is_active: index === 0,
            lines: item.lines.map((line) => ({
                trade_section: item.name,
                description: line.desc,
                quantity: line.qty,
                unit: line.unit,
                unit_rate: line.rate,
                line_total: line.qty * line.rate,
                pricing_mode: "simple",
                line_type: "general",
            })),
        }));

        const { data, error } = await supabase.rpc("create_phase1_project_graph", {
            p_request_id: input.requestId,
            p_project: project,
            p_estimates: estimates,
        });
        const created = Array.isArray(data) ? data[0] : data;
        if (error || !created?.project_id) {
            console.error("createProjectFromTemplateAction failed", {
                requestId: input.requestId,
                code: error?.code,
                message: error?.message,
            });
            return { success: false, error: "Could not create the project. Your inputs are still available; please retry." };
        }

        return { success: true, projectId: created.project_id };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Could not create the project",
        };
    }
}
