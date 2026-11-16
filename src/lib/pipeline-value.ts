import { computeContractSumValue } from "@/lib/financial";
import { isPipelineProject } from "@/lib/project-helpers";

type EstimateLike = {
    project_id?: string;
    estimate_lines?: { trade_section?: string | null; line_total?: number | null }[] | null;
    total_cost?: number | null;
    overhead_pct?: number | null;
    profit_pct?: number | null;
    risk_pct?: number | null;
    prelims_pct?: number | null;
    discount_pct?: number | null;
};

type ProjectLike = {
    id: string;
    status?: string | null;
    is_archived?: boolean | null;
    potential_value?: number | null;
};

/** Contract value for an open opportunity: canonical estimate sum when present, else gut-feel budget. */
export function openOpportunityValue(
    project: ProjectLike,
    estimate: EstimateLike | undefined,
): number {
    const lines = Array.isArray(estimate?.estimate_lines) ? estimate.estimate_lines : [];
    const canonical = estimate ? computeContractSumValue(estimate, lines) : 0;
    return canonical > 0 ? canonical : (project.potential_value ?? 0);
}

function estimateByProject<T extends EstimateLike>(estimates: T[]): Map<string, T> {
    const map = new Map<string, T>();
    for (const estimate of estimates) {
        if (estimate.project_id) map.set(estimate.project_id, estimate);
    }
    return map;
}

/** Home command-centre strip: pre-construction pipeline projects only. */
export function totalHomePipelineValue(projects: ProjectLike[], estimates: EstimateLike[]): number {
    const byProject = estimateByProject(estimates);
    return projects
        .filter(isPipelineProject)
        .reduce((sum, project) => sum + openOpportunityValue(project, byProject.get(project.id)), 0);
}

/** CRM kanban KPI strip: every non-lost, non-completed project. */
export function totalKanbanPipelineValue(
    projects: ProjectLike[],
    financials: Record<string, number>,
): number {
    return projects
        .filter((p) => p.status !== "Lost" && p.status !== "Completed")
        .reduce((sum, p) => sum + (financials[p.id] > 0 ? financials[p.id] : (p.potential_value ?? 0)), 0);
}

/** Build the kanban financial map from active estimates (server-side). */
export function kanbanFinancialsFromEstimates(
    projects: ProjectLike[],
    estimates: EstimateLike[],
): Record<string, number> {
    const byProject = estimateByProject(estimates);
    const financials: Record<string, number> = {};
    for (const project of projects) {
        const estimate = byProject.get(project.id);
        if (!estimate) continue;
        const lines = Array.isArray(estimate.estimate_lines) ? estimate.estimate_lines : [];
        const value = computeContractSumValue(estimate, lines);
        if (value > 0) financials[project.id] = value;
    }
    return financials;
}