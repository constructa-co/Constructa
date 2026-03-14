import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/supabase/auth-utils";
import ClientEstimator from "./client-page";
import ProjectNavBar from "@/components/project-navbar";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: { asm?: string, res?: string, projectId?: string } }) {
    const supabase = createClient();
    const orgId = await getActiveOrganizationId();

    // 1. Fetch Dropdown Data (Scoped to organization)
    const { data: assemblies } = await supabase
        .from("assemblies")
        .select("id, name, required_inputs")
        .eq("organization_id", orgId)
        .order("name");

    // 2. Fetch "Basket" (Saved Items)
    let savedEstimates: any[] = [];
    const { data: proj } = await supabase
        .from("projects")
        .select("id")
        .eq("organization_id", orgId)
        .limit(1)
        .single();
    
    if (proj) {
        const { data: ests } = await supabase
            .from("estimates")
            .select("*, estimate_lines(*)")
            .eq("project_id", proj.id)
            .eq("organization_id", orgId)
            .order('created_at', { ascending: false });
        savedEstimates = ests || [];
    }

    // 3. Selection State
    const selectedId = searchParams.asm || assemblies?.[0]?.id;
    const selectedAssembly = assemblies?.find(a => a.id === selectedId) || assemblies?.[0] || null;

    // 4. Fetch Options
    let assemblyOptions: any[] = [];
    if (selectedId) {
        const { data: opts } = await supabase
            .from("assembly_options")
            .select("*")
            .eq("assembly_id", selectedId)
            .eq("organization_id", orgId);
        assemblyOptions = opts || [];
    }

    // 5. Fetch Organization's Library (MoM Architecture)
    const { data: items } = await supabase
        .from("mom_items")
        .select("*")
        .eq("organization_id", orgId)
        .order("description");

    const globalLibrary = items?.map(i => ({
        ...i,
        unit_cost: i.base_rate
    })) || [];

    // 6. Fetch Active Project (For PDF)
    const query = supabase
        .from("projects")
        .select("*")
        .eq("organization_id", orgId);

    if (searchParams.projectId) {
        query.eq("id", searchParams.projectId);
    } else {
        query.order("created_at", { ascending: false }).limit(1);
    }

    const { data: activeProject } = await query.single();

    // 7. Fetch Dependencies (For PDF Gantt)
    const { data: dependencies } = await supabase
        .from("estimate_dependencies")
        .select("*");

    // 8. Fetch Organization's Templates (Kits)
    const { data: templates } = await supabase
        .from("templates")
        .select("*")
        .eq("organization_id", orgId)
        .order("name");

    // 9. Fetch Variations
    let approvedVariationsTotal = 0;
    if (activeProject) {
        const { data: vars } = await supabase
            .from("variations")
            .select("amount")
            .eq("project_id", activeProject.id)
            .eq("organization_id", orgId)
            .eq("status", "Approved");
        approvedVariationsTotal = vars?.reduce((sum, v) => sum + Number(v.amount), 0) || 0;
    }

    return (
        <div className="max-w-[1400px] mx-auto p-6 pt-24">
            {activeProject && (
                <div className="mb-6">
                    <ProjectNavBar projectId={activeProject.id} activeTab="overview" />
                </div>
            )}

            <ClientEstimator
                assemblies={assemblies || []}
                savedEstimates={savedEstimates}
                selectedAssembly={selectedAssembly}
                assemblyOptions={assemblyOptions}
                resultJson={searchParams.res}
                resourceLibrary={globalLibrary}
                globalLibrary={globalLibrary}
                activeProject={activeProject}
                dependencies={dependencies || []}
                templates={templates || []}
                approvedVariationsTotal={approvedVariationsTotal}
            />
        </div>
    );
}
