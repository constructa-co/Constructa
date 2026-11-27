/**
 * Programme-driven costs (D121 first slice).
 *
 * Three time-related costs worked out from the saved, dated programme and
 * offered to the estimate as Preliminaries lines. Nothing here changes a
 * programme date or a stage length, and nothing reaches the estimate until
 * the contractor reviews the change and applies it.
 *
 *  1. Minimum paid gang. A cost floor, not a duration rule. For each unique
 *     working date × shift ("window") the uplift is
 *         max(0, minimum paid gang − operatives already costed in the window)
 *     operative-days at that shift's rate. It is charged once per window,
 *     however many stages overlap there, and never per stage. "Already
 *     costed" is the labour the measured work already pays for: each stage's
 *     priced labour hours spread over its working shift-days, unless the
 *     contractor states the figure. Supervision is never inside the floor.
 *  2. Supervision. One charge per unique working date × shift on which any
 *     stage works that shift (the union), so overlapping stages never pay a
 *     supervisor twice.
 *  3. Supplier hire. Billed in the supplier's declared periods (day, week,
 *     4 weeks, calendar month or per hire) between the on-hire date and the
 *     date the supplier stops charging (off-hire call plus notice, or
 *     collection), with the minimum hire applied and delivery/collection
 *     charged separately. A basis that is missing or ambiguous is refused,
 *     never guessed.
 *
 * Money is whole pence throughout. A gang-floor window is rounded half-up to
 * the penny on its own, and the line total is the sum of those rounded
 * windows, so every window shown adds up exactly to the line.
 */

import { z } from "zod";
import { computeContractSum, isPricedPreliminariesLine, type EstimateInput, type EstimateLineInput } from "./financial";
import { isJobWorkingDay, jobProductiveMinutesPerDay, programmeCalendarForProject, type ProgrammeCalendar } from "./job-working-pattern";
import { computeProgrammePlan, parseIsoDate, planCoversEveryPhase } from "./programme-plan";
import { readProgrammeInclusion } from "./programme-inclusion";
import { hasRelativeProgramme } from "./relative-programme";
import { isUkBankHoliday } from "./uk-bank-holidays";

// ── Inputs ───────────────────────────────────────────────────────────────────

export const SHIFT_KEYS = ["day", "night"] as const;
export type ShiftKey = (typeof SHIFT_KEYS)[number];

export const HIRE_UNITS = ["day", "week", "four_week", "month", "per_hire"] as const;
export type HireUnit = (typeof HIRE_UNITS)[number];

export const CHARGEABLE_DAYS = ["calendar", "mon_fri", "mon_fri_no_bank_holidays"] as const;
export type ChargeableDays = (typeof CHARGEABLE_DAYS)[number];

export const OFF_HIRE_RULES = ["call_date_plus_notice", "collection_date"] as const;
export type OffHireRule = (typeof OFF_HIRE_RULES)[number];

export const PROGRAMME_COST_SECTION = "Preliminaries";
export const MAX_PROGRAMME_COST_HIRES = 20;
const MAX_STAGES = 200;
const MAX_PENCE = 100_000_000_00; // £100m, matching the estimate's line ceiling order
const MAX_WINDOW_DAYS = 3660;

const pence = z.number().int().min(0).max(MAX_PENCE);
const shiftKey = z.enum(SHIFT_KEYS);
const anchor = z.union([
    z.object({
        kind: z.enum(["stage_start", "stage_finish"]),
        stage: z.number().int().min(0).max(MAX_STAGES - 1),
        /** The stage's name when the anchor was set (v2). A renamed or moved stage is refused, never followed silently. */
        stageName: z.string().max(200).optional(),
    }).strict(),
    z.object({ kind: z.literal("date"), date: z.string().refine((value) => parseIsoDate(value) !== null, "Enter a real date.") }).strict(),
]);

const crewId = z.string().regex(/^[a-z0-9-]{1,40}$/);

const StageInputSchemaV1 = z.object({
    name: z.string().max(200),
    shifts: z.array(shiftKey).max(2).refine((shifts) => new Set(shifts).size === shifts.length, "A shift is listed twice."),
    /** Operatives the measured work already pays for on each working shift-day. Null = from priced labour hours. */
    costedOperatives: z.number().min(0).max(1000).nullable(),
}).strict();

const StageInputSchema = StageInputSchemaV1.extend({
    /** The planned crew working each shift of the stage (v2). Planned capacity only: never a cost. */
    crewByShift: z.object({ day: crewId.nullable(), night: crewId.nullable() }).strict(),
}).strict();

/**
 * A planned crew (v2): who the contractor intends to put on a shift, used
 * only to check the programme length against the priced labour hours. It is
 * never priced and is separate from the minimum paid gang. Size and hours are
 * the contractor's own figures: nothing is defaulted, and a crew without them
 * cannot be checked.
 */
const CrewSchema = z.object({
    id: crewId,
    name: z.string().trim().min(1).max(80),
    shift: shiftKey,
    operatives: z.number().int().min(1).max(1000).nullable(),
    /** Productive hours each operative works on one shift of this crew. Never taken from the daily working pattern. */
    productiveHoursPerShift: z.number().gt(0).max(24).nullable(),
}).strict();

const GangFloorSchema = z.object({
    shift: shiftKey,
    minimumPaidGang: z.number().int().min(0).max(1000),
    operativeDayRatePence: pence,
}).strict();

const SupervisionSchema = z.object({
    shift: shiftKey,
    ratePerShiftPence: pence,
}).strict();

const HireSchema = z.object({
    id: z.string().regex(/^[a-z0-9-]{1,40}$/),
    description: z.string().trim().min(1).max(200),
    unit: z.enum(HIRE_UNITS),
    ratePence: pence,
    /** Required for day hire only: which days the supplier charges. */
    chargeableDays: z.enum(CHARGEABLE_DAYS).nullable(),
    /** Required for week, 4-week and month hire. Only whole periods are supported. */
    partPeriodRule: z.literal("whole_period").nullable(),
    minimumPeriods: z.number().int().min(1).max(1000),
    onHire: anchor,
    offHire: anchor,
    offHireRule: z.enum(OFF_HIRE_RULES).nullable(),
    /** Calendar days after the off-hire date the supplier still charges (notice, or until collection). */
    offHireDays: z.number().int().min(0).max(365),
    deliveryPence: pence,
    collectionPence: pence,
}).strict();

export const MAX_PROGRAMME_CREWS = 20;

/** D121 settings, as saved in notes of lines applied before D122. Read and upgraded, never written. */
const ProgrammeCostInputsSchemaV1 = z.object({
    version: z.literal(1),
    stages: z.array(StageInputSchemaV1).max(MAX_STAGES),
    gangFloors: z.array(GangFloorSchema).max(2),
    supervision: z.array(SupervisionSchema).max(2),
    hires: z.array(HireSchema).max(MAX_PROGRAMME_COST_HIRES),
}).strict();

export const ProgrammeCostInputsSchema = z.object({
    version: z.literal(2),
    stages: z.array(StageInputSchema).max(MAX_STAGES),
    gangFloors: z.array(GangFloorSchema).max(2),
    supervision: z.array(SupervisionSchema).max(2),
    hires: z.array(HireSchema).max(MAX_PROGRAMME_COST_HIRES),
    crews: z.array(CrewSchema).max(MAX_PROGRAMME_CREWS),
}).strict();

export const NO_STAGE_CREW = Object.freeze({ day: null, night: null }) as { day: string | null; night: string | null };

/** Old (v1) settings as v2: no crews, no stage crews. Line content, and so the signature, is unchanged. */
function upgradeInputs(raw: unknown): unknown {
    const v1 = ProgrammeCostInputsSchemaV1.safeParse(raw);
    if (!v1.success) return raw;
    return { ...v1.data, version: 2, stages: v1.data.stages.map((stage) => ({ ...stage, crewByShift: { ...NO_STAGE_CREW } })), crews: [] };
}

export type StageShiftInput = z.infer<typeof StageInputSchema>;
export type CrewInput = z.infer<typeof CrewSchema>;
export type GangFloorInput = z.infer<typeof GangFloorSchema>;
export type SupervisionInput = z.infer<typeof SupervisionSchema>;
export type HireAnchor = z.infer<typeof anchor>;
export type HireInput = z.infer<typeof HireSchema>;
export type ProgrammeCostInputs = z.infer<typeof ProgrammeCostInputsSchema>;

export const EMPTY_PROGRAMME_COST_INPUTS: ProgrammeCostInputs = Object.freeze({
    version: 2, stages: [], gangFloors: [], supervision: [], hires: [], crews: [],
}) as ProgrammeCostInputs;

export function parseProgrammeCostInputs(raw: unknown): { ok: true; inputs: ProgrammeCostInputs } | { ok: false; errors: string[] } {
    const parsed = ProgrammeCostInputsSchema.safeParse(upgradeInputs(raw));
    if (!parsed.success) {
        return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "settings"}: ${issue.message}`) };
    }
    const inputs = parsed.data;
    const errors: string[] = [];
    for (const [label, list] of [["Minimum paid gang", inputs.gangFloors], ["Supervision", inputs.supervision]] as const) {
        const shifts = list.map((entry) => entry.shift);
        if (new Set(shifts).size !== shifts.length) errors.push(`${label}: each shift can only be set once.`);
    }
    const ids = inputs.hires.map((hire) => hire.id);
    if (new Set(ids).size !== ids.length) errors.push("Plant hire: two hires share the same id.");
    const crewIds = inputs.crews.map((crew) => crew.id);
    if (new Set(crewIds).size !== crewIds.length) errors.push("Planned crews: two crews share the same id.");
    return errors.length ? { ok: false, errors } : { ok: true, inputs };
}

// ── The programme, as working shift-days ─────────────────────────────────────

export interface ProgrammeCostSource {
    start_date?: string | null;
    programme_phases?: unknown;
    programme_working_pattern?: unknown;
    region?: string | null;
}

export interface ProgrammeCostStage {
    index: number;
    name: string;
    startDate: string;
    endDate: string;
    /** Every working date of the stage under the job's calendar, in order. */
    workingDates: string[];
    /** Labour hours saved on the stage (from the priced estimate when the planner made it). */
    manhours: number;
}

export type ProgrammeStagesResult =
    | { ok: true; calendar: ProgrammeCalendar; stages: ProgrammeCostStage[]; hoursPerShift: number }
    | { ok: false; reason: string };

const DAY_MS = 86_400_000;

function isoFromMs(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
}

function addCalendarDays(iso: string, days: number): string | null {
    const ms = parseIsoDate(iso);
    return ms === null ? null : isoFromMs(ms + days * DAY_MS);
}

function calendarDaysInclusive(fromIso: string, toIso: string): number {
    return Math.round((parseIsoDate(toIso)! - parseIsoDate(fromIso)!) / DAY_MS) + 1;
}

/**
 * The saved programme as dated stages with their working dates. Refuses,
 * with a reason the contractor can act on, rather than guessing dates.
 */
export function programmeStagesForCosts(source: ProgrammeCostSource): ProgrammeStagesResult {
    const inclusion = readProgrammeInclusion(source.programme_phases);
    if (inclusion.intent === "invalid") return { ok: false, reason: "The saved programme could not be read. Open the Programme tab and save it again." };
    const phases = inclusion.phases;
    if (phases.length === 0) return { ok: false, reason: "There is no saved programme yet. Save a programme first." };
    if (phases.length > MAX_STAGES) return { ok: false, reason: `The programme has more than ${MAX_STAGES} stages.` };
    if (hasRelativeProgramme(phases)) return { ok: false, reason: "The programme has no start date, so shift days and hire dates cannot be worked out. Add a start date on the Programme tab." };
    if (parseIsoDate(source.start_date) === null) return { ok: false, reason: "The programme has no start date. Add one on the Programme tab." };
    const calendar = programmeCalendarForProject(source, source.programme_working_pattern);
    if (!calendar) return { ok: false, reason: "The job's working pattern could not be read. Check it on the Programme tab." };
    const plan = computeProgrammePlan(source.start_date, phases, calendar, calendar.bankHolidayDivision);
    if (!plan || !planCoversEveryPhase(plan, phases)) {
        return { ok: false, reason: "At least one programme stage has no dates or length. Give every stage a length on the Programme tab." };
    }
    const stages: ProgrammeCostStage[] = [];
    for (let index = 0; index < plan.stages.length; index += 1) {
        const stage = plan.stages[index];
        const days = calendarDaysInclusive(stage.start_date, stage.end_date);
        if (days > MAX_WINDOW_DAYS) return { ok: false, reason: `"${stage.name}" is longer than ten years.` };
        const workingDates: string[] = [];
        const startMs = parseIsoDate(stage.start_date)!;
        for (let day = 0; day < days; day += 1) {
            const iso = isoFromMs(startMs + day * DAY_MS);
            if (isJobWorkingDay(iso, calendar)) workingDates.push(iso);
        }
        const raw = (phases[index] ?? {}) as { manhours?: unknown };
        const manhours = typeof raw.manhours === "number" && Number.isFinite(raw.manhours) && raw.manhours > 0 ? raw.manhours : 0;
        stages.push({ index, name: stage.name, startDate: stage.start_date, endDate: stage.end_date, workingDates, manhours });
    }
    const hoursPerShift = jobProductiveMinutesPerDay(calendar.pattern) / 60;
    if (!(hoursPerShift > 0)) return { ok: false, reason: "The job's working pattern has no working hours." };
    return { ok: true, calendar, stages, hoursPerShift };
}

/** Stage settings lined up with the current stages; a renamed or moved stage starts again from the default. */
export function alignStageInputs(stages: readonly Pick<ProgrammeCostStage, "name">[], saved: readonly (Omit<StageShiftInput, "crewByShift"> & Partial<Pick<StageShiftInput, "crewByShift">>)[]): StageShiftInput[] {
    return stages.map((stage, index) => {
        const match = saved[index];
        return match && match.name === stage.name
            ? { ...match, shifts: [...match.shifts], crewByShift: { ...(match.crewByShift ?? NO_STAGE_CREW) } }
            : { name: stage.name, shifts: ["day"], costedOperatives: null, crewByShift: { ...NO_STAGE_CREW } };
    });
}

/** Operatives the stage's priced labour already pays for on each of its working shift-days. */
export function derivedCostedOperatives(stage: Pick<ProgrammeCostStage, "manhours" | "workingDates">, shiftCount: number, hoursPerShift: number): number {
    const shiftDays = stage.workingDates.length * shiftCount;
    if (shiftDays === 0 || !(hoursPerShift > 0)) return 0;
    return stage.manhours / (shiftDays * hoursPerShift);
}

export interface ShiftWindow {
    date: string;
    shift: ShiftKey;
    /** Stage indexes working this shift on this date. */
    stages: number[];
    /** Operatives already costed by measured work in this window. */
    costedOperatives: number;
}

/** Unique working date × shift windows, each with every stage working it and the labour it already pays for. */
export function shiftWindows(stages: readonly ProgrammeCostStage[], stageInputs: readonly Pick<StageShiftInput, "name" | "shifts" | "costedOperatives">[], hoursPerShift: number): ShiftWindow[] {
    const windows = new Map<string, ShiftWindow>();
    for (const stage of stages) {
        const input = stageInputs[stage.index];
        if (!input || input.shifts.length === 0) continue;
        const costed = input.costedOperatives ?? derivedCostedOperatives(stage, input.shifts.length, hoursPerShift);
        for (const date of stage.workingDates) {
            for (const shift of input.shifts) {
                const key = `${date}|${shift}`;
                const window = windows.get(key) ?? { date, shift, stages: [], costedOperatives: 0 };
                window.stages.push(stage.index);
                window.costedOperatives += costed;
                windows.set(key, window);
            }
        }
    }
    return [...windows.values()].sort((a, b) => (a.date === b.date ? SHIFT_KEYS.indexOf(a.shift) - SHIFT_KEYS.indexOf(b.shift) : a.date < b.date ? -1 : 1));
}

// ── 1. Minimum paid gang ─────────────────────────────────────────────────────

/** Rounds away binary noise (e.g. 3 − 2.9 = 0.10000000000000009) before a figure is priced. */
function clean(value: number): number {
    return Math.round(value * 1e9) / 1e9;
}

export interface GangFloorWindow {
    date: string;
    shift: ShiftKey;
    costedOperatives: number;
    additionalOperatives: number;
    upliftPence: number;
}

export interface GangFloorResult {
    shift: ShiftKey;
    minimumPaidGang: number;
    operativeDayRatePence: number;
    /** Every window of this shift, charged or not. */
    windows: GangFloorWindow[];
    chargedWindowCount: number;
    additionalOperativeDays: number;
    totalPence: number;
}

export function gangFloorUplift(windows: readonly ShiftWindow[], floor: GangFloorInput): GangFloorResult {
    const rows = windows
        .filter((window) => window.shift === floor.shift)
        .map((window) => {
            const additional = clean(Math.max(0, floor.minimumPaidGang - window.costedOperatives));
            return {
                date: window.date,
                shift: window.shift,
                costedOperatives: clean(window.costedOperatives),
                additionalOperatives: additional,
                upliftPence: Math.round(additional * floor.operativeDayRatePence),
            };
        });
    return {
        shift: floor.shift,
        minimumPaidGang: floor.minimumPaidGang,
        operativeDayRatePence: floor.operativeDayRatePence,
        windows: rows,
        chargedWindowCount: rows.filter((row) => row.upliftPence > 0).length,
        additionalOperativeDays: clean(rows.reduce((sum, row) => sum + row.additionalOperatives, 0)),
        totalPence: rows.reduce((sum, row) => sum + row.upliftPence, 0),
    };
}

// ── 2. Supervision ───────────────────────────────────────────────────────────

export interface SupervisionResult {
    shift: ShiftKey;
    ratePerShiftPence: number;
    /** Unique working date × shift windows: overlapping stages count once. */
    shiftCount: number;
    totalPence: number;
}

export function supervisionUnion(windows: readonly ShiftWindow[], supervision: SupervisionInput): SupervisionResult {
    const shiftCount = windows.filter((window) => window.shift === supervision.shift).length;
    return { shift: supervision.shift, ratePerShiftPence: supervision.ratePerShiftPence, shiftCount, totalPence: shiftCount * supervision.ratePerShiftPence };
}

// ── 3. Supplier hire and off-hire ────────────────────────────────────────────

export interface HireResult {
    id: string;
    description: string;
    unit: HireUnit;
    onHireDate: string;
    offHireDate: string;
    /** Last date the supplier charges for. */
    billingEndDate: string;
    calendarDays: number;
    /** Days the supplier charges for, for day hire. */
    chargeableDayCount: number | null;
    /** Periods from the dates, before the minimum hire. */
    periodsFromDates: number;
    /** Periods charged, after the minimum hire. */
    periods: number;
    minimumApplied: boolean;
    ratePence: number;
    hirePence: number;
    deliveryPence: number;
    collectionPence: number;
    totalPence: number;
}

/** The date an anchor gives on the saved programme, or null when its stage is gone, renamed or moved. */
export function anchorDate(anchorValue: HireAnchor, stages: readonly Pick<ProgrammeCostStage, "name" | "startDate" | "endDate">[]): string | null {
    if (anchorValue.kind === "date") return parseIsoDate(anchorValue.date) === null ? null : anchorValue.date;
    const stage = stages[anchorValue.stage];
    if (!stage) return null;
    if (anchorValue.stageName !== undefined && anchorValue.stageName !== stage.name) return null;
    return anchorValue.kind === "stage_start" ? stage.startDate : stage.endDate;
}

function isWeekday(iso: string): boolean {
    const day = new Date(parseIsoDate(iso)!).getUTCDay();
    return day >= 1 && day <= 5;
}

/** Whole calendar months from the on-hire date needed to cover the billing end, or null when a month end makes it ambiguous. */
function wholeMonthsCovering(onHire: string, billingEnd: string): number | null {
    const [year, month, day] = onHire.split("-").map(Number);
    if (day > 28) return null;
    const endMs = parseIsoDate(billingEnd)!;
    for (let months = 1; months <= 1200; months += 1) {
        // The period that starts on the same day-of-month k months later is not charged.
        const nextStart = Date.UTC(year, month - 1 + months, day);
        if (endMs < nextStart) return months;
    }
    return null;
}

export function hireCost(
    hire: HireInput,
    stages: readonly ProgrammeCostStage[],
    calendar: Pick<ProgrammeCalendar, "bankHolidayDivision">,
): { ok: true; result: HireResult } | { ok: false; error: string } {
    const label = `"${hire.description}"`;
    const onHire = anchorDate(hire.onHire, stages);
    const offHire = anchorDate(hire.offHire, stages);
    if (!onHire) return { ok: false, error: `${label}: the on-hire date points at a stage that is no longer in the programme, or was renamed or moved. Choose the on-hire stage again.` };
    if (!offHire) return { ok: false, error: `${label}: the off-hire date points at a stage that is no longer in the programme, or was renamed or moved. Choose the off-hire stage again.` };
    if (!hire.offHireRule) return { ok: false, error: `${label}: say how the supplier stops charging (off-hire call plus notice, or collection).` };
    const billingEnd = addCalendarDays(offHire, hire.offHireDays);
    if (!billingEnd || billingEnd < onHire) return { ok: false, error: `${label}: the off-hire date is before the on-hire date.` };
    const calendarDays = calendarDaysInclusive(onHire, billingEnd);
    if (calendarDays > MAX_WINDOW_DAYS) return { ok: false, error: `${label}: the hire is longer than ten years.` };

    let periodsFromDates: number;
    let chargeableDayCount: number | null = null;
    switch (hire.unit) {
        case "day": {
            if (!hire.chargeableDays) return { ok: false, error: `${label}: say which days the supplier charges for day hire.` };
            if (hire.partPeriodRule) return { ok: false, error: `${label}: a part-period rule does not apply to day hire.` };
            let count = 0;
            const startMs = parseIsoDate(onHire)!;
            for (let index = 0; index < calendarDays; index += 1) {
                const iso = isoFromMs(startMs + index * DAY_MS);
                if (hire.chargeableDays === "calendar"
                    || (isWeekday(iso) && (hire.chargeableDays === "mon_fri" || !isUkBankHoliday(iso, calendar.bankHolidayDivision)))) count += 1;
            }
            chargeableDayCount = count;
            periodsFromDates = count;
            break;
        }
        case "week":
        case "four_week":
        case "month": {
            if (hire.partPeriodRule !== "whole_period") return { ok: false, error: `${label}: say how the supplier charges a part ${hire.unit === "month" ? "month" : "period"}. Only "whole periods" is supported.` };
            if (hire.chargeableDays && hire.chargeableDays !== "calendar") return { ok: false, error: `${label}: weekly and monthly hire is worked out on calendar days; working-day rules only apply to day hire.` };
            if (hire.unit === "month") {
                const months = wholeMonthsCovering(onHire, billingEnd);
                if (months === null) return { ok: false, error: `${label}: a monthly hire starting on the 29th, 30th or 31st is ambiguous. Use 4-week periods or a different on-hire date.` };
                periodsFromDates = months;
            } else {
                periodsFromDates = Math.ceil(calendarDays / (hire.unit === "week" ? 7 : 28));
            }
            break;
        }
        case "per_hire": {
            if (hire.minimumPeriods !== 1) return { ok: false, error: `${label}: a per-hire charge cannot have a minimum of more than one hire.` };
            periodsFromDates = 1;
            break;
        }
    }

    const periods = Math.max(periodsFromDates, hire.minimumPeriods);
    const hirePence = periods * hire.ratePence;
    return {
        ok: true,
        result: {
            id: hire.id,
            description: hire.description,
            unit: hire.unit,
            onHireDate: onHire,
            offHireDate: offHire,
            billingEndDate: billingEnd,
            calendarDays,
            chargeableDayCount,
            periodsFromDates,
            periods,
            minimumApplied: periods > periodsFromDates,
            ratePence: hire.ratePence,
            hirePence,
            deliveryPence: hire.deliveryPence,
            collectionPence: hire.collectionPence,
            totalPence: hirePence + hire.deliveryPence + hire.collectionPence,
        },
    };
}

// ── Lines for the estimate ───────────────────────────────────────────────────

export interface ProgrammeCostLine {
    /** Stable identity of the cost this line carries, e.g. "gang:day" or "hire:abc". */
    key: string;
    /** Client-safe wording: no rates, margins or supplier terms. */
    description: string;
    quantity: number;
    unit: string;
    unitRatePence: number;
    totalPence: number;
}

const SHIFT_LABEL: Record<ShiftKey, string> = { day: "day shifts", night: "night shifts" };
const HIRE_UNIT_LABEL: Record<HireUnit, string> = { day: "day", week: "week", four_week: "4 weeks", month: "month", per_hire: "hire" };

export function hireUnitLabel(unit: HireUnit): string {
    return HIRE_UNIT_LABEL[unit];
}

export interface ProgrammeCostResult {
    windows: ShiftWindow[];
    gangFloors: GangFloorResult[];
    supervision: SupervisionResult[];
    hires: HireResult[];
    lines: ProgrammeCostLine[];
    totalPence: number;
    /** Changes whenever the lines it would write change. */
    signature: string;
}

export type ProgrammeCostOutcome =
    | { ok: true; inputs: ProgrammeCostInputs; stages: ProgrammeCostStage[]; hoursPerShift: number; result: ProgrammeCostResult }
    | { ok: false; errors: string[] };

/** FNV-1a, 32-bit: a stable short fingerprint, not a security measure. */
function fingerprint(text: string): string {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}

/** Fingerprint of a set of lines' content, in canonical key order so the order lines are stored in does not matter. */
export function programmeCostSignature(lines: readonly ProgrammeCostLine[]): string {
    const ordered = [...lines].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    return fingerprint(JSON.stringify({ v: 1, lines: ordered.map((line) => [line.key, line.description, line.quantity, line.unit, line.unitRatePence, line.totalPence]) }));
}

/** Everything in one pass: the programme, the three costs and the lines they would write. */
export function computeProgrammeCosts(source: ProgrammeCostSource, rawInputs: unknown): ProgrammeCostOutcome {
    const parsed = parseProgrammeCostInputs(rawInputs);
    if (!parsed.ok) return { ok: false, errors: parsed.errors };
    const inputs = parsed.inputs;
    const programme = programmeStagesForCosts(source);
    if (!programme.ok) return { ok: false, errors: [programme.reason] };
    const { stages, calendar, hoursPerShift } = programme;

    if (inputs.stages.length !== stages.length || inputs.stages.some((input, index) => input.name !== stages[index].name)) {
        return { ok: false, errors: ["The programme stages have changed since these settings were made. Check each stage's shifts, then review the costs again."] };
    }

    const windows = shiftWindows(stages, inputs.stages, hoursPerShift);
    const gangFloors = inputs.gangFloors.map((floor) => gangFloorUplift(windows, floor));
    const supervision = inputs.supervision.map((entry) => supervisionUnion(windows, entry));
    const errors: string[] = [];
    const hires: HireResult[] = [];
    for (const hire of inputs.hires) {
        const priced = hireCost(hire, stages, calendar);
        if (priced.ok) hires.push(priced.result);
        else errors.push(priced.error);
    }
    if (errors.length) return { ok: false, errors };

    const lines: ProgrammeCostLine[] = [];
    for (const shift of SHIFT_KEYS) {
        const floor = gangFloors.find((entry) => entry.shift === shift);
        if (floor && floor.totalPence > 0) {
            lines.push({ key: `gang:${shift}`, description: `Minimum labour attendance – ${SHIFT_LABEL[shift]}`, quantity: 1, unit: "sum", unitRatePence: floor.totalPence, totalPence: floor.totalPence });
        }
    }
    for (const shift of SHIFT_KEYS) {
        const entry = supervision.find((item) => item.shift === shift);
        if (entry && entry.totalPence > 0) {
            lines.push({ key: `supervision:${shift}`, description: `Site supervision – ${SHIFT_LABEL[shift]}`, quantity: entry.shiftCount, unit: "shift", unitRatePence: entry.ratePerShiftPence, totalPence: entry.totalPence });
        }
    }
    for (const hire of hires) {
        if (hire.hirePence > 0) {
            lines.push({ key: `hire:${hire.id}`, description: `Plant hire – ${hire.description}`, quantity: hire.periods, unit: HIRE_UNIT_LABEL[hire.unit], unitRatePence: hire.ratePence, totalPence: hire.hirePence });
        }
        const transport = hire.deliveryPence + hire.collectionPence;
        if (transport > 0) {
            lines.push({ key: `hire:${hire.id}:transport`, description: `Delivery and collection – ${hire.description}`, quantity: 1, unit: "sum", unitRatePence: transport, totalPence: transport });
        }
    }

    return {
        ok: true,
        inputs,
        stages,
        hoursPerShift,
        result: {
            windows,
            gangFloors,
            supervision,
            hires,
            lines,
            totalPence: lines.reduce((sum, line) => sum + line.totalPence, 0),
            signature: programmeCostSignature(lines),
        },
    };
}

// ── What is already on the estimate ──────────────────────────────────────────

const NOTE_TAG = "constructaProgrammeCost";

/** The planned hire dates a hire line was applied with (D122). Planned only: not a supplier booking. */
export interface AppliedHireDates {
    onHire: string;
    offHire: string;
    chargedTo: string;
}

interface LineNote {
    [NOTE_TAG]: 1;
    key: string;
    sig: string;
    inputs?: ProgrammeCostInputs;
    hire?: AppliedHireDates;
}

/** The internal note an applied line carries. Notes are never shown to the client. */
export function programmeCostLineNote(line: ProgrammeCostLine, signature: string, inputs?: ProgrammeCostInputs, hire?: AppliedHireDates): string {
    const note: LineNote = { [NOTE_TAG]: 1, key: line.key, sig: signature, ...(inputs ? { inputs } : {}), ...(hire ? { hire } : {}) };
    return JSON.stringify(note);
}

/** The hire a line key belongs to: "hire:abc" and "hire:abc:transport" both give "abc". */
export function hireIdFromLineKey(key: string): string | null {
    const match = /^hire:([a-z0-9-]{1,40})(?::transport)?$/.exec(key);
    return match ? match[1] : null;
}

/** Planned dates for each hire result, as recorded in the notes of the lines it writes. */
export function hireDatesForNote(hire: Pick<HireResult, "onHireDate" | "offHireDate" | "billingEndDate">): AppliedHireDates {
    return { onHire: hire.onHireDate, offHire: hire.offHireDate, chargedTo: hire.billingEndDate };
}

export interface AppliedHireRecord {
    /** Dates recorded when the line was applied; null for lines applied before D122 recorded them. */
    dates: AppliedHireDates | null;
    /** Periods on the saved hire line as it is now, when there is one. */
    savedPeriods: number | null;
}

function isIsoDate(value: unknown): value is string {
    return typeof value === "string" && parseIsoDate(value) !== null;
}

/** What each applied hire was applied with, read from the estimate's tagged lines. */
export function readAppliedHires(lines: readonly AppliedLineInput[]): Map<string, AppliedHireRecord> {
    const records = new Map<string, AppliedHireRecord>();
    for (const line of lines) {
        const note = readLineNote(line.notes);
        const id = note ? hireIdFromLineKey(note.key) : null;
        if (!note || !id) continue;
        const record = records.get(id) ?? { dates: null, savedPeriods: null };
        const dates = note.hire;
        if (!record.dates && dates && isIsoDate(dates.onHire) && isIsoDate(dates.offHire) && isIsoDate(dates.chargedTo)) {
            record.dates = { onHire: dates.onHire, offHire: dates.offHire, chargedTo: dates.chargedTo };
        }
        if (note.key === `hire:${id}`) {
            const quantity = savedNumber(line.quantity);
            record.savedPeriods = Number.isFinite(quantity) ? quantity : null;
        }
        records.set(id, record);
    }
    return records;
}

function readLineNote(notes: unknown): LineNote | null {
    if (typeof notes !== "string" || !notes.startsWith(`{"${NOTE_TAG}":1`)) return null;
    try {
        const parsed = JSON.parse(notes) as Partial<LineNote>;
        return parsed && parsed[NOTE_TAG] === 1 && typeof parsed.key === "string" && typeof parsed.sig === "string" ? (parsed as LineNote) : null;
    } catch {
        return null;
    }
}

export interface AppliedLineInput {
    id: string;
    notes?: string | null;
    trade_section?: string | null;
    description?: string | null;
    quantity?: number | string | null;
    unit?: string | null;
    unit_rate?: number | string | null;
    line_total?: number | string | null;
}

export interface AppliedProgrammeCosts {
    lineIds: string[];
    /**
     * Fingerprint of what is actually saved on those lines now (description,
     * quantity, unit, rate, total), worked out from the rows themselves. The
     * signature stored in a note is never taken as proof of the amounts.
     * Null when none is applied or the set is inconsistent.
     */
    signature: string | null;
    /** The signature the lines were applied with. */
    appliedSignature: string | null;
    /** True when a line was edited or deleted after it was applied. */
    edited: boolean;
    /** True when the tagged lines are one set (one applied signature, no repeated cost, all in Preliminaries). */
    consistent: boolean;
    inputs: ProgrammeCostInputs | null;
}

function savedNumber(value: unknown): number {
    const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isFinite(number) ? number : NaN;
}

/** A saved row read back as the cost line it now is. */
function savedCostLine(line: AppliedLineInput, key: string): ProgrammeCostLine {
    return {
        key,
        description: (line.description ?? "").trim(),
        quantity: savedNumber(line.quantity),
        unit: (line.unit ?? "").trim(),
        unitRatePence: Math.round(savedNumber(line.unit_rate) * 100),
        totalPence: Math.round(savedNumber(line.line_total) * 100),
    };
}

export function readAppliedProgrammeCosts(lines: readonly AppliedLineInput[]): AppliedProgrammeCosts {
    const tagged = lines.flatMap((line) => {
        const note = readLineNote(line.notes);
        return note ? [{ id: line.id, note, section: line.trade_section, line }] : [];
    });
    const signatures = new Set(tagged.map((entry) => entry.note.sig));
    const keys = tagged.map((entry) => entry.note.key);
    const consistent = signatures.size <= 1 && new Set(keys).size === keys.length && tagged.every((entry) => entry.section === PROGRAMME_COST_SECTION);
    let inputs: ProgrammeCostInputs | null = null;
    for (const entry of tagged) {
        const parsed = entry.note.inputs ? parseProgrammeCostInputs(entry.note.inputs) : null;
        if (parsed?.ok) { inputs = parsed.inputs; break; }
    }
    const appliedSignature = consistent && signatures.size === 1 ? [...signatures][0] : null;
    const actual = appliedSignature ? programmeCostSignature(tagged.map((entry) => savedCostLine(entry.line, entry.note.key))) : null;
    return {
        lineIds: tagged.map((entry) => entry.id),
        signature: actual,
        appliedSignature,
        edited: actual !== null && actual !== appliedSignature,
        consistent,
        inputs,
    };
}

export type ProgrammeCostStatus = "not_applied" | "up_to_date" | "review" | "inconsistent";

/**
 * Compares the lines actually saved on the estimate with the lines the
 * programme and the applied settings give now. "review" means they differ:
 * the programme changed, or an applied line was edited or deleted. The estimate keeps its lines until the
 * contractor applies the change: nothing is re-priced silently.
 */
export function programmeCostStatus(applied: AppliedProgrammeCosts, currentSignature: string | null): ProgrammeCostStatus {
    if (!applied.consistent) return "inconsistent";
    if (applied.lineIds.length === 0) return "not_applied";
    return applied.signature !== null && applied.signature === currentSignature ? "up_to_date" : "review";
}

// ── Applying: the exact price change, for the contractor to acknowledge ─────

export interface ApplicationLine extends EstimateLineInput, AppliedLineInput {
    description?: string | null;
}

export interface ProgrammeCostApplication {
    removeLineIds: string[];
    beforePence: number;
    afterPence: number;
    changePence: number;
    /** The preliminaries percentage stops (or starts) applying because priced Preliminaries lines appear (or go). */
    prelimsBasisChange: "pct_to_lines" | "lines_to_pct" | null;
    /** Preliminaries the percentage gave before, in pence, when it is about to stop applying. */
    prelimsPctPenceDropped: number;
    /** Other priced Preliminaries lines that may already pay for the same thing. */
    possibleDuplicates: string[];
}

const DUPLICATE_HINT = /supervis|foreman|hire|attendance|gang|labour/i;

function asMoneyLines(lines: readonly ProgrammeCostLine[]): EstimateLineInput[] {
    return lines.map((line) => ({ trade_section: PROGRAMME_COST_SECTION, line_type: "general", quantity: line.quantity, unit_rate: line.unitRatePence / 100, line_total: line.quantity * (line.unitRatePence / 100) }));
}

function toPence(pounds: number): number {
    return Math.round(pounds * 100);
}

/**
 * The change these lines make, worked out by the existing contract-sum
 * engine before and after. Lines this feature already applied are listed in
 * `removeLineIds` and left out of the "after" figure, so a second set is
 * never counted on top of the first. The first slice's apply action refuses
 * whenever that list is not empty: it only ever inserts, never deletes.
 */
export function planProgrammeCostApplication(
    estimate: EstimateInput,
    lines: readonly ApplicationLine[],
    proposed: readonly ProgrammeCostLine[],
): ProgrammeCostApplication {
    const applied = readAppliedProgrammeCosts(lines);
    const removed = new Set(applied.lineIds);
    const kept = lines.filter((line) => !removed.has(line.id));
    const after = [...kept, ...asMoneyLines(proposed)];
    const before = computeContractSum(estimate, [...lines]);
    const next = computeContractSum(estimate, after);
    const hadLines = lines.some(isPricedPreliminariesLine);
    const hasLines = after.some(isPricedPreliminariesLine);
    const pctApplies = Number(estimate.prelims_pct ?? 0) > 0;
    const prelimsBasisChange = !pctApplies || hadLines === hasLines ? null : hasLines ? "pct_to_lines" : "lines_to_pct";
    const beforePence = toPence(before.contractSum);
    const afterPence = toPence(next.contractSum);
    return {
        removeLineIds: applied.lineIds,
        beforePence,
        afterPence,
        changePence: afterPence - beforePence,
        prelimsBasisChange,
        prelimsPctPenceDropped: prelimsBasisChange === "pct_to_lines" ? toPence(before.prelimsTotal) : 0,
        possibleDuplicates: kept
            .filter((line) => isPricedPreliminariesLine(line) && DUPLICATE_HINT.test(line.description ?? ""))
            .map((line) => (line.description ?? "").trim())
            .filter(Boolean),
    };
}

/**
 * The acknowledgement the contractor gives is tied to the exact figures they
 * saw. A different programme, settings or estimate gives different figures
 * and the apply is refused.
 */
export interface ProgrammeCostAcknowledgement {
    signature: string;
    beforePence: number;
    afterPence: number;
}

export function acknowledgementMatches(ack: ProgrammeCostAcknowledgement, signature: string, application: ProgrammeCostApplication): boolean {
    return ack.signature === signature && ack.beforePence === application.beforePence && ack.afterPence === application.afterPence;
}

export function poundsFromPence(value: number): number {
    return Math.round(value) / 100;
}
