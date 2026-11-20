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
    /** Genuine enquiry capture date only — not created_at. */
    enquiry_date?: string | null;
    is_archived?: boolean | null;
}

/**
 * Age since a dated event (e.g. enquiry). Returns null when the date is missing,
 * unreadable or more than a day ahead, so callers show nothing instead of "0d", "NaNd" or a negative age.
 */
export function projectAge(openFrom: string | null | undefined, now: number = Date.now()): ProjectAge | null {
    if (!openFrom) return null;
    const opened = new Date(openFrom);
    const elapsed = now - opened.getTime();
    if (!Number.isFinite(elapsed) || elapsed <= -DAY_MS) return null;
    const days = Math.max(0, Math.floor(elapsed / DAY_MS));
    const openedOn = opened.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const description = days === 0
        ? `Open since today (${openedOn})`
        : `Open ${days} day${days === 1 ? "" : "s"} (${openedOn})`;
    return { days, label: compactAge(days), description };
}

/**
 * Days open for pipeline list/board: enquiry_date only.
 * No enquiry_date column exists yet — always hidden until one is available.
 * Archived jobs are excluded from display metrics.
 */
export function pipelineDaysOpenAge(project: PipelineOpenFacts, now: number = Date.now()): ProjectAge | null {
    if (project.is_archived) return null;
    return projectAge(project.enquiry_date, now);
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