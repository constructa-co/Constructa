"use server";

import { createClient } from "@/lib/supabase/server";
import { PROJECT_TEMPLATES } from "@/lib/templates";

// Return type for the client
export async function createProjectFromTemplateAction(formData: FormData) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    try {
        const name = formData.get("name") as string;
        const client = formData.get("client") as string;
        const typeId = formData.get("typeId") as string;

        // 1. Create Project
        const { data: project, error: projError } = await supabase.from("projects").insert({
            user_id: user?.id,
            tenant_id: user?.id, // <--- Added Tenant ID
            name,
            client_name: client,
            status: 'Estimating',
            project_type: typeId === 'extension_1' ? 'Extension' : typeId === 'renovation' ? 'Renovation' : 'Other'
        }).select().single();

        if (projError) return { success: false, error: "DB Error: " + projError.message };
        if (!project) return { success: false, error: "Project creation failed (No data returned)" };

        // 2. Unpack Template
        const template = PROJECT_TEMPLATES.find(t => t.id === typeId);

        if (template && template.items.length > 0) {
            for (const item of template.items) {
                const { data: estimate, error: estError } = await supabase.from("estimates").insert({
                    project_id: project.id,
                    tenant_id: user?.id, // <--- Added Tenant ID to Estimate as well for consistency
                    version_name: item.name,
                    status: 'Draft',
                    total_cost: item.cost,
                    margin_percent: 20
                }).select().single();

                if (estError) console.error("Estimate Error (Non-fatal):", estError.message);

                if (estimate && item.lines && item.lines.length > 0) {
                    const linesToInsert = item.lines.map(line => ({
                        estimate_id: estimate.id,
                        description: line.desc,
                        quantity: line.qty,
                        unit: line.unit,
                        unit_rate: line.rate, // Kept unit_rate consistent
                        line_total: line.qty * line.rate,
                        resource_type: 'Material'
                    }));
                    await supabase.from("estimate_lines").insert(linesToInsert);
                }
            }
        }

        // SUCCESS: Return the ID so the client can redirect
        return { success: true, projectId: project.id };

    } catch (err: any) {
        return { success: false, error: "Server Exception: " + err.message };
    }
}
