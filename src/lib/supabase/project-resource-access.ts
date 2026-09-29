import { requireAuth, requireProjectAccess } from "./auth-utils";

type ProjectAccess = Awaited<ReturnType<typeof requireProjectAccess>>;

async function resolveEstimateProjectId(estimateId: string): Promise<string> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("estimates")
    .select("project_id")
    .eq("id", estimateId)
    .single();

  if (error || !data?.project_id) {
    throw new Error("Unauthorized project resource access.");
  }
  return data.project_id;
}

export async function requireEstimateAccess(
  estimateId: string,
): Promise<ProjectAccess & { estimateId: string; projectId: string }> {
  const projectId = await resolveEstimateProjectId(estimateId);
  const access = await requireProjectAccess(projectId);
  return { ...access, estimateId, projectId };
}

export async function requireEstimateLineAccess(
  lineId: string,
): Promise<ProjectAccess & { lineId: string; estimateId: string; projectId: string }> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("estimate_lines")
    .select("estimate_id")
    .eq("id", lineId)
    .single();

  if (error || !data?.estimate_id) {
    throw new Error("Unauthorized project resource access.");
  }

  const estimateId = data.estimate_id;
  const projectId = await resolveEstimateProjectId(estimateId);
  const access = await requireProjectAccess(projectId);
  return { ...access, lineId, estimateId, projectId };
}

export async function requireEstimateComponentAccess(
  componentId: string,
): Promise<ProjectAccess & {
  componentId: string;
  lineId: string;
  estimateId: string;
  projectId: string;
}> {
  const { supabase } = await requireAuth();
  const { data, error } = await supabase
    .from("estimate_line_components")
    .select("estimate_line_id")
    .eq("id", componentId)
    .single();

  if (error || !data?.estimate_line_id) {
    throw new Error("Unauthorized project resource access.");
  }

  const lineId = data.estimate_line_id;
  const lineAccess = await requireEstimateLineAccess(lineId);
  return { ...lineAccess, componentId, lineId };
}
