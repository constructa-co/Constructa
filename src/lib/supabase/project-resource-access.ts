import { requireAuth, requireProjectAccess } from "./auth-utils";
import { getPrecontractEditLockReason } from "../project-editability";

type ProjectAccess = Awaited<ReturnType<typeof requireProjectAccess>>;

export async function requireEditableAccessForVerifiedProject(
  access: ProjectAccess,
  projectId: string,
): Promise<ProjectAccess> {
  const { data, error } = await access.supabase
    .from("projects")
    .select("status, is_archived, proposal_status, proposal_accepted_at")
    .eq("id", projectId)
    .eq("user_id", access.user.id)
    .single();

  if (error || !data) {
    throw new Error("Unauthorized project access.");
  }

  const lockReason = getPrecontractEditLockReason(data);
  if (lockReason) throw new Error(lockReason);
  return access;
}

export async function requireEditableProjectAccess(
  projectId: string,
): Promise<ProjectAccess> {
  const access = await requireProjectAccess(projectId);
  return requireEditableAccessForVerifiedProject(access, projectId);
}

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
