export interface PrecontractProjectState {
  status?: string | null;
  is_archived?: boolean | null;
  proposal_status?: string | null;
  proposal_accepted_at?: string | null;
}

const LOCKED_PROJECT_STATUSES = new Set([
  "active",
  "won",
  "completed",
  "lost",
  "archived",
]);

export function getPrecontractEditLockReason(
  project: PrecontractProjectState,
): string | null {
  if (project.is_archived) {
    return "This project is archived. Restore it before editing pre-contract information.";
  }

  if (project.proposal_accepted_at || project.proposal_status?.toLowerCase() === "accepted") {
    return "This proposal has been accepted. Record later scope or price changes as variations.";
  }

  const status = project.status?.toLowerCase() ?? "";
  if (LOCKED_PROJECT_STATUSES.has(status)) {
    return `Pre-contract information is locked because the project is ${status}. Record later changes as variations.`;
  }

  return null;
}
