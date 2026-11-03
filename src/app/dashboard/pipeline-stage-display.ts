/** Canonical pipeline statuses persisted on projects — never use display copy in payloads. */
export const PIPELINE_STATUS_FILTER_OPTIONS = [
    "Lead",
    "Estimating",
    "Proposal Sent",
    "Active",
    "Won",
    "Completed",
    "Lost",
] as const;

const DISPLAY_LABELS: Partial<Record<(typeof PIPELINE_STATUS_FILTER_OPTIONS)[number], string>> = {
    Lead: "Enquiries",
    Estimating: "Preparing estimate",
};

/** UI-only label for filters, list badges, board headers, and legend. */
export function pipelineStageDisplayLabel(canonicalStatus: string): string {
    const key = canonicalStatus as (typeof PIPELINE_STATUS_FILTER_OPTIONS)[number];
    return DISPLAY_LABELS[key] ?? canonicalStatus;
}
