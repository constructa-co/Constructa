/** Display-only facts for pipeline cards and rows. Nothing here writes to a project. */

const DAY_MS = 86_400_000;

export interface ProjectAge {
    /** Whole days since the open-from date. */
    days: number;
    /** Compact age: "today", "3d", "6w", "4mo", "1y 2mo". */
    label: string;
    /** Full wording for title / accessible name. */
    description: string;
}

export interface PipelineOpenFacts {
    /** System record of when the job entered Constructa (until a user-editable enquiry date exists). */
    created_at?: string | null;
    is_archived?: boolean | null;
}

/**
 * Age since the job was added (created_at), not time in its current stage.
 * Returns null when the date is missing, unreadable or more than a day ahead,
 * so callers show a dash instead of "0d", "NaNd" or a negative age.
 */
export function projectAge(createdAt: string | null | undefined, now: number = Date.now()): ProjectAge | null {
    if (!createdAt) return null;
    const created = new Date(createdAt);
    const elapsed = now - created.getTime();
    if (!Number.isFinite(elapsed) || elapsed <= -DAY_MS) return null;
    const days = Math.max(0, Math.floor(elapsed / DAY_MS));
    const addedOn = created.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const description = days === 0
        ? `Open since today (${addedOn})`
        : `Open ${days} day${days === 1 ? "" : "s"} (${addedOn})`;
    return { days, label: compactAge(days), description };
}

/**
 * Days open for pipeline list/board: uses created_at (enquiry capture date).
 * No separate enquiry_date column exists yet — callers hide when the date is unusable.
 * Archived jobs are excluded from display metrics.
 */
export function pipelineDaysOpenAge(project: PipelineOpenFacts, now: number = Date.now()): ProjectAge | null {
    if (project.is_archived) return null;
    return projectAge(project.created_at, now);
}

function compactAge(days: number): string {
    if (days === 0) return "today";
    if (days < 14) return `${days}d`;
    if (days < 91) return `${Math.floor(days / 7)}w`;
    if (days < 365) return `${Math.min(11, Math.floor(days / 30))}mo`;
    const years = Math.floor(days / 365);
    const months = Math.min(11, Math.floor((days - years * 365) / 30));
    return months > 0 ? `${years}y ${months}mo` : `${years}y`;
}