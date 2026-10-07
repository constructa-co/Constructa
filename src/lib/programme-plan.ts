/**
 * The canonical pre-contract programme calculation.
 *
 * One function turns a start date and the project's saved phases into the
 * dates, durations and bar positions shown everywhere a proposal programme
 * appears: the programme editor, the publication snapshot, the public
 * proposal and the PDF. Nothing else works out a programme date.
 *
 * Basis: working days are Monday to Friday. Bank holidays are not allowed
 * for, and every surface that shows the programme says so.
 */

export const WORKING_DAYS_PER_WEEK = 5;
export const PROGRAMME_BASIS = "mon_fri_working_days" as const;
export const PROGRAMME_BASIS_NOTE =
    "Working days are Monday to Friday. Bank holidays are not allowed for.";

const DAY_MS = 86_400_000;

export interface ProgrammePlanStage {
    name: string;
    /** First and last working day of the stage, YYYY-MM-DD. */
    start_date: string;
    end_date: string;
    working_days: number;
    /** Calendar days from the programme start to the stage start. */
    offset_days: number;
    /** Calendar days the stage spans, first to last day inclusive. */
    span_days: number;
}

export interface ProgrammePlan {
    basis: typeof PROGRAMME_BASIS;
    start_date: string;
    end_date: string;
    /** Working days from the start to the finish, both included. */
    working_days: number;
    /** Calendar days from the start to the finish, both included. */
    calendar_days: number;
    duration_label: string;
    stages: ProgrammePlanStage[];
}

// ── Dates ────────────────────────────────────────────────────────────────────

/** UTC midnight for a YYYY-MM-DD date, or null when it is not a real date. */
export function parseIsoDate(value: unknown): number | null {
    if (typeof value !== "string") return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim().slice(0, 10));
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const ms = Date.UTC(year, month - 1, day);
    const date = new Date(ms);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return ms;
}

function toIso(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
}

function isWorkingMs(ms: number): boolean {
    const day = new Date(ms).getUTCDay();
    return day !== 0 && day !== 6;
}

export function isWorkingDay(iso: string): boolean {
    const ms = parseIsoDate(iso);
    return ms !== null && isWorkingMs(ms);
}

function rollToWorkingDay(ms: number): number {
    let cursor = ms;
    while (!isWorkingMs(cursor)) cursor += DAY_MS;
    return cursor;
}

/**
 * The last working day of a run of `workingDays` that begins on `startMs`.
 * The start counts as day one. A start on a weekend begins the next Monday.
 */
function endOfWorkingRun(startMs: number, workingDays: number): number {
    let cursor = rollToWorkingDay(startMs);
    let remaining = Math.max(1, Math.round(workingDays)) - 1;
    // Whole weeks first so a long programme is not walked day by day.
    const weeks = Math.floor(remaining / WORKING_DAYS_PER_WEEK);
    cursor += weeks * 7 * DAY_MS;
    remaining -= weeks * WORKING_DAYS_PER_WEEK;
    while (remaining > 0) {
        cursor += DAY_MS;
        if (isWorkingMs(cursor)) remaining -= 1;
    }
    return cursor;
}

/** The date a run of working days finishes, or null for an invalid start. */
export function addWorkingDays(startIso: string, workingDays: number): string | null {
    const start = parseIsoDate(startIso);
    if (start === null || !Number.isFinite(workingDays) || workingDays < 1) return null;
    return toIso(endOfWorkingRun(start, workingDays));
}

/** The first working day after the given date. */
export function nextWorkingDayAfter(iso: string): string | null {
    const ms = parseIsoDate(iso);
    return ms === null ? null : toIso(rollToWorkingDay(ms + DAY_MS));
}

function countWorkingMs(startMs: number, endMs: number): number {
    if (endMs < startMs) return 0;
    const totalDays = Math.round((endMs - startMs) / DAY_MS) + 1;
    const weeks = Math.floor(totalDays / 7);
    let count = weeks * WORKING_DAYS_PER_WEEK;
    for (let cursor = startMs + weeks * 7 * DAY_MS; cursor <= endMs; cursor += DAY_MS) {
        if (isWorkingMs(cursor)) count += 1;
    }
    return count;
}

/** Working days from one date to another, both included. */
export function countWorkingDays(startIso: string, endIso: string): number {
    const start = parseIsoDate(startIso);
    const end = parseIsoDate(endIso);
    return start === null || end === null ? 0 : countWorkingMs(start, end);
}

// ── Wording ──────────────────────────────────────────────────────────────────

/** "3 weeks" for whole working weeks, otherwise "8 working days". */
export function formatWorkingDuration(workingDays: number): string {
    const days = Math.max(0, Math.round(workingDays));
    if (days > 0 && days % WORKING_DAYS_PER_WEEK === 0) {
        const weeks = days / WORKING_DAYS_PER_WEEK;
        return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
    }
    return `${days} working ${days === 1 ? "day" : "days"}`;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * "Monday 12 October 2026" or, short, "12 Oct 2026". Empty for an invalid
 * date. Written out here rather than left to the machine's locale data, so
 * the server, the browser and the PDF always print the same words.
 */
export function formatPlanDate(iso: string | null | undefined, style: "long" | "short" | "short-month-long" = "long"): string {
    const ms = parseIsoDate(iso);
    if (ms === null) return "";
    const date = new Date(ms);
    const month = MONTHS[date.getUTCMonth()];
    if (style === "long") return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`;
    // "12 Oct 2026", or "12 October 2026" without the weekday.
    return `${date.getUTCDate()} ${style === "short" ? month.slice(0, 3) : month} ${date.getUTCFullYear()}`;
}

/** "12 Oct to 23 Oct 2026". The first year is shown only when it differs. */
export function formatDateRange(startIso: string, endIso: string): string {
    const start = parseIsoDate(startIso);
    const end = parseIsoDate(endIso);
    if (start === null || end === null) return "";
    const last = formatPlanDate(endIso, "short");
    if (start === end) return last;
    const from = new Date(start);
    const sameYear = from.getUTCFullYear() === new Date(end).getUTCFullYear();
    const first = sameYear ? `${from.getUTCDate()} ${MONTHS[from.getUTCMonth()].slice(0, 3)}` : formatPlanDate(startIso, "short");
    return `${first} to ${last}`;
}

// ── Reading saved phases ─────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function positive(value: unknown): number {
    if (value === null || value === undefined || value === "") return 0;
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * The working-day length of a Programme-tab phase: the contractor's own
 * figure when they set one, otherwise the calculated one. Zero when the
 * phase carries neither.
 */
export function phaseWorkingDays(phase: unknown): number {
    const p = asRecord(phase);
    const manual = p.manualDays === null || p.manualDays === undefined ? 0 : positive(p.manualDays);
    return Math.round(manual || positive(p.calculatedDays));
}

interface ReadPhase {
    name: string;
    startMs: number;
    endMs: number;
}

/**
 * One saved phase as dates. Two shapes exist:
 *  - Programme-tab phases: working days, placed by a calendar-day offset
 *    from the project start;
 *  - the earlier proposal timeline: calendar days from the phase's own
 *    start date.
 */
function readPhase(entry: unknown, index: number, programmeStartMs: number | null): ReadPhase | null {
    const p = asRecord(entry);
    const name = typeof p.name === "string" && p.name.trim() ? p.name.trim().slice(0, 200) : `Stage ${index + 1}`;

    const ownStart = parseIsoDate(p.start_date);
    const offset = p.startOffset === null || p.startOffset === undefined ? 0 : Number(p.startOffset);
    const startMs = ownStart !== null
        ? ownStart
        : programmeStartMs !== null && Number.isFinite(offset) && offset >= 0
            ? programmeStartMs + Math.round(offset) * DAY_MS
            : null;
    if (startMs === null) return null;

    const workingDays = phaseWorkingDays(p);
    if (workingDays > 0) {
        const firstDay = rollToWorkingDay(startMs);
        return { name, startMs: firstDay, endMs: endOfWorkingRun(firstDay, workingDays) };
    }

    const calendarDays = Math.ceil(positive(p.duration_days));
    if (calendarDays <= 0) return null;
    return { name, startMs, endMs: startMs + (calendarDays - 1) * DAY_MS };
}

// ── The plan ─────────────────────────────────────────────────────────────────

/**
 * The programme for a start date and saved phases, or null when there is no
 * dated phase to show. Phases without a usable start or duration are left
 * out rather than guessed.
 */
export function computeProgrammePlan(
    startDate: string | null | undefined,
    phases: unknown[] | null | undefined,
): ProgrammePlan | null {
    if (!Array.isArray(phases) || phases.length === 0) return null;
    const programmeStartMs = parseIsoDate(startDate);

    const read = phases
        .slice(0, 200)
        .map((entry, index) => readPhase(entry, index, programmeStartMs))
        .filter((phase): phase is ReadPhase => phase !== null);
    if (read.length === 0) return null;

    const startMs = Math.min(...read.map((phase) => phase.startMs));
    const endMs = Math.max(...read.map((phase) => phase.endMs));
    const workingDays = countWorkingMs(startMs, endMs);

    return {
        basis: PROGRAMME_BASIS,
        start_date: toIso(startMs),
        end_date: toIso(endMs),
        working_days: workingDays,
        calendar_days: Math.round((endMs - startMs) / DAY_MS) + 1,
        duration_label: formatWorkingDuration(workingDays),
        stages: read.map((phase) => ({
            name: phase.name,
            start_date: toIso(phase.startMs),
            end_date: toIso(phase.endMs),
            working_days: countWorkingMs(phase.startMs, phase.endMs),
            offset_days: Math.round((phase.startMs - startMs) / DAY_MS),
            span_days: Math.round((phase.endMs - phase.startMs) / DAY_MS) + 1,
        })),
    };
}

/**
 * True when the plan shows every saved phase: none was left out for want of
 * a start or a length. A proposal is only sent when this holds, so a stage
 * the contractor saved can never silently go missing from it.
 */
export function planCoversEveryPhase(plan: Pick<ProgrammePlan, "stages"> | null, phases: unknown[] | null | undefined): boolean {
    const saved = Array.isArray(phases) ? Math.min(phases.length, 200) : 0;
    return plan !== null && saved > 0 && plan.stages.length === saved;
}

/** Where a stage's bar sits on a timeline, as percentages of the whole. */
export function stageBar(plan: Pick<ProgrammePlan, "calendar_days">, stage: Pick<ProgrammePlanStage, "offset_days" | "span_days">) {
    const total = Math.max(1, plan.calendar_days);
    const left = Math.min(100, Math.max(0, (stage.offset_days / total) * 100));
    const width = Math.min(100 - left, Math.max(1, (stage.span_days / total) * 100));
    return { leftPct: Math.round(left * 100) / 100, widthPct: Math.round(width * 100) / 100 };
}

// ── The earlier proposal timeline ────────────────────────────────────────────

/**
 * The six phases the earlier proposal editor seeded on every project. They
 * are a template, not something the contractor decided, so they never count
 * as a programme until one of them has been changed.
 */
export const LEGACY_STARTER_PHASES: ReadonlyArray<{ name: string; duration_days: number; duration_unit: string }> = [
    { name: "Groundworks", duration_days: 14, duration_unit: "Weeks" },
    { name: "Structure", duration_days: 21, duration_unit: "Weeks" },
    { name: "Roofing", duration_days: 14, duration_unit: "Weeks" },
    { name: "First Fix", duration_days: 14, duration_unit: "Weeks" },
    { name: "Plastering", duration_days: 7, duration_unit: "Weeks" },
    { name: "Second Fix & Finish", duration_days: 14, duration_unit: "Weeks" },
];

export interface StarterPhaseSeed {
    name: string;
    duration_days: number;
    duration_unit: string;
}

/**
 * True when the phases are still a seeded starter list, i.e. nothing the
 * contractor has decided. Ids and colours carry no meaning, so they are
 * ignored. Any change to a name, a duration, a duration unit or a start
 * date, or adding or removing a phase, makes it the contractor's programme.
 *
 * Starter phases are seeded with the project start date, or with no start
 * when the project had none at the time. Both count as the seeded start.
 */
export function isUntouchedStarterProgramme(
    phases: unknown[] | null | undefined,
    seeds: readonly StarterPhaseSeed[],
    projectStartDate?: string | null,
): boolean {
    if (!Array.isArray(phases) || phases.length !== seeds.length) return false;
    const seededStart = typeof projectStartDate === "string" ? projectStartDate.trim() : "";
    return phases.every((phase, index) => {
        const p = asRecord(phase);
        const seed = seeds[index];
        const start = typeof p.start_date === "string" ? p.start_date.trim() : "";
        return p.name === seed.name
            && Number(p.duration_days) === seed.duration_days
            && p.duration_unit === seed.duration_unit
            && (start === "" || start === seededStart);
    });
}

export interface ProgrammeSource {
    /** Where the phases came from: the Programme tab, or the earlier proposal timeline. */
    origin: "programme" | "legacy_timeline" | "none";
    phases: unknown[];
}

/**
 * The phases a new proposal would publish. The Programme tab wins when it
 * has anything saved. Otherwise a timeline the contractor edited in the
 * earlier proposal editor is used; the untouched starter template never is.
 */
export function resolveProgrammeSource(project: {
    start_date?: string | null;
    programme_phases?: unknown[] | null;
    gantt_phases?: unknown[] | null;
}): ProgrammeSource {
    if (Array.isArray(project.programme_phases) && project.programme_phases.length > 0) {
        return { origin: "programme", phases: project.programme_phases };
    }
    if (Array.isArray(project.gantt_phases) && project.gantt_phases.length > 0
        && !isUntouchedStarterProgramme(project.gantt_phases, LEGACY_STARTER_PHASES, project.start_date)) {
        return { origin: "legacy_timeline", phases: project.gantt_phases };
    }
    return { origin: "none", phases: [] };
}

/** The programme a new proposal for this project would publish, if it has one. */
export function programmePlanForProject(project: {
    start_date?: string | null;
    programme_phases?: unknown[] | null;
    gantt_phases?: unknown[] | null;
}): ProgrammePlan | null {
    return computeProgrammePlan(project.start_date, resolveProgrammeSource(project).phases);
}
