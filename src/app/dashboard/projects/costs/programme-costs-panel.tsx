"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import type { WorkspaceStyles } from "@/lib/workspace-styles";
import { formatGBP } from "@/lib/simple-estimate";
import { formatPlanDate } from "@/lib/programme-plan";
import {
    CHARGEABLE_DAYS,
    HIRE_UNITS,
    OFF_HIRE_RULES,
    SHIFT_KEYS,
    alignStageInputs,
    computeProgrammeCosts,
    derivedCostedOperatives,
    hireClientDescription,
    hireTransportClientDescription,
    hireUnitLabel,
    parseProgrammeCostInputs,
    planProgrammeCostApplication,
    poundsFromPence,
    programmeCostStatus,
    programmeStagesForCosts,
    readAppliedProgrammeCosts,
    type ChargeableDays,
    type HireInput,
    type HireUnit,
    type OffHireRule,
    type ProgrammeCostInputs,
    type ProgrammeCostSource,
    type ProgrammeCostStage,
    type ShiftKey,
} from "@/lib/programme-costs";
import { applyProgrammeCostsAction, type ApplyProgrammeCostsRequest, type ApplyProgrammeCostsResult } from "./programme-costs-actions";
import type { Estimate, EstimateLine } from "./types";

// ── The contractor's draft, as typed ─────────────────────────────────────────

interface StageDraft { name: string; day: boolean; night: boolean; costed: string }
interface HireDraft {
    id: string; description: string; unit: HireUnit; rate: string;
    chargeableDays: ChargeableDays | ""; partPeriodRule: "whole_period" | ""; minimumPeriods: string;
    onKind: "stage_start" | "date"; onStage: string; onDate: string;
    offKind: "stage_finish" | "date"; offStage: string; offDate: string;
    offHireRule: OffHireRule | ""; offHireDays: string; delivery: string; collection: string;
}
export interface ProgrammeCostsDraft {
    version: 1;
    stages: StageDraft[];
    gang: Record<ShiftKey, { min: string; rate: string }>;
    supervision: Record<ShiftKey, string>;
    hires: HireDraft[];
}

const SHIFT_NAME: Record<ShiftKey, string> = { day: "Day", night: "Night" };
const CHARGEABLE_LABEL: Record<ChargeableDays, string> = {
    calendar: "Every calendar day",
    mon_fri: "Monday to Friday (bank holidays charged)",
    mon_fri_no_bank_holidays: "Monday to Friday, not bank holidays",
};
const OFF_HIRE_LABEL: Record<OffHireRule, string> = {
    call_date_plus_notice: "Off-hire call date, plus notice days",
    collection_date: "Collection date (days after off-hire until collected)",
};

const draftKey = (projectId: string) => `constructa:programme-costs-draft:v1:${projectId}`;
const penceText = (value: number) => (value ? poundsFromPence(value).toFixed(2) : "");

function emptyDraft(): ProgrammeCostsDraft {
    return { version: 1, stages: [], gang: { day: { min: "", rate: "" }, night: { min: "", rate: "" } }, supervision: { day: "", night: "" }, hires: [] };
}

function newHire(): HireDraft {
    const id = `h-${Math.random().toString(36).slice(2, 10)}`;
    return {
        id, description: "", unit: "week", rate: "", chargeableDays: "", partPeriodRule: "", minimumPeriods: "1",
        onKind: "stage_start", onStage: "0", onDate: "", offKind: "stage_finish", offStage: "0", offDate: "",
        offHireRule: "", offHireDays: "0", delivery: "", collection: "",
    };
}

export function draftFromInputs(inputs: ProgrammeCostInputs): ProgrammeCostsDraft {
    const draft = emptyDraft();
    draft.stages = inputs.stages.map((stage) => ({ name: stage.name, day: stage.shifts.includes("day"), night: stage.shifts.includes("night"), costed: stage.costedOperatives === null ? "" : String(stage.costedOperatives) }));
    for (const floor of inputs.gangFloors) draft.gang[floor.shift] = { min: String(floor.minimumPaidGang), rate: penceText(floor.operativeDayRatePence) };
    for (const entry of inputs.supervision) draft.supervision[entry.shift] = penceText(entry.ratePerShiftPence);
    draft.hires = inputs.hires.map((hire) => ({
        id: hire.id, description: hire.description, unit: hire.unit, rate: penceText(hire.ratePence),
        chargeableDays: hire.chargeableDays ?? "", partPeriodRule: hire.partPeriodRule ?? "", minimumPeriods: String(hire.minimumPeriods),
        onKind: hire.onHire.kind === "date" ? "date" : "stage_start", onStage: hire.onHire.kind === "date" ? "0" : String(hire.onHire.stage), onDate: hire.onHire.kind === "date" ? hire.onHire.date : "",
        offKind: hire.offHire.kind === "date" ? "date" : "stage_finish", offStage: hire.offHire.kind === "date" ? "0" : String(hire.offHire.stage), offDate: hire.offHire.kind === "date" ? hire.offHire.date : "",
        offHireRule: hire.offHireRule ?? "", offHireDays: String(hire.offHireDays), delivery: penceText(hire.deliveryPence), collection: penceText(hire.collectionPence),
    }));
    return draft;
}

function parsePounds(text: string, label: string, errors: string[]): number {
    const value = text.trim().replace(/^£/, "").replace(/,/g, "");
    if (!value) return 0;
    if (!/^\d+(\.\d{1,2})?$/.test(value)) { errors.push(`${label}: enter an amount in pounds, e.g. 250 or 250.50.`); return 0; }
    return Math.round(Number(value) * 100);
}

function parseWhole(text: string, label: string, errors: string[], min = 0): number {
    const value = text.trim();
    if (!/^\d+$/.test(value) || Number(value) < min) { errors.push(`${label}: enter a whole number${min ? ` of at least ${min}` : ""}.`); return min; }
    return Number(value);
}

/** The draft as validated inputs, or the reasons it cannot be priced yet. */
export function inputsFromDraft(draft: ProgrammeCostsDraft, stages: readonly Pick<ProgrammeCostStage, "name">[]): { ok: true; inputs: ProgrammeCostInputs } | { ok: false; errors: string[] } {
    const errors: string[] = [];
    const stageInputs = alignStageInputs(stages, draft.stages.map((stage) => ({
        name: stage.name,
        shifts: SHIFT_KEYS.filter((shift) => stage[shift]),
        costedOperatives: stage.costed.trim() === "" ? null : Number(stage.costed),
    })));
    draft.stages.forEach((stage, index) => {
        if (stage.costed.trim() !== "" && !(Number(stage.costed) >= 0)) errors.push(`${stage.name || `Stage ${index + 1}`}: operatives already costed must be a number, or left blank.`);
    });
    const gangFloors = SHIFT_KEYS.flatMap((shift) => {
        const entry = draft.gang[shift];
        if (!entry.min.trim() && !entry.rate.trim()) return [];
        const minimumPaidGang = parseWhole(entry.min, `Minimum paid gang (${SHIFT_NAME[shift].toLowerCase()})`, errors);
        const operativeDayRatePence = parsePounds(entry.rate, `Operative rate (${SHIFT_NAME[shift].toLowerCase()})`, errors);
        if (minimumPaidGang > 0 && operativeDayRatePence === 0) errors.push(`Minimum paid gang (${SHIFT_NAME[shift].toLowerCase()}): enter the rate per operative per shift.`);
        return [{ shift, minimumPaidGang, operativeDayRatePence }];
    });
    const supervision = SHIFT_KEYS.flatMap((shift) => {
        const text = draft.supervision[shift];
        return text.trim() ? [{ shift, ratePerShiftPence: parsePounds(text, `Supervision (${SHIFT_NAME[shift].toLowerCase()})`, errors) }] : [];
    });
    const hires: HireInput[] = draft.hires.map((hire, index) => {
        const label = hire.description.trim() || `Hire ${index + 1}`;
        if (!hire.description.trim()) errors.push(`Hire ${index + 1}: describe the item.`);
        const ratePence = parsePounds(hire.rate, `${label} rate`, errors);
        if (ratePence === 0) errors.push(`${label}: enter the supplier's rate.`);
        return {
            id: hire.id,
            description: hire.description.trim() || label,
            unit: hire.unit,
            ratePence,
            chargeableDays: hire.unit === "day" ? (hire.chargeableDays || null) : null,
            partPeriodRule: hire.unit === "week" || hire.unit === "four_week" || hire.unit === "month" ? (hire.partPeriodRule || null) : null,
            minimumPeriods: parseWhole(hire.minimumPeriods, `${label} minimum hire`, errors, 1),
            onHire: hire.onKind === "date" ? { kind: "date", date: hire.onDate } : { kind: "stage_start", stage: Number(hire.onStage) },
            offHire: hire.offKind === "date" ? { kind: "date", date: hire.offDate } : { kind: "stage_finish", stage: Number(hire.offStage) },
            offHireRule: hire.offHireRule || null,
            offHireDays: parseWhole(hire.offHireDays, `${label} days after off-hire`, errors),
            deliveryPence: parsePounds(hire.delivery, `${label} delivery`, errors),
            collectionPence: parsePounds(hire.collection, `${label} collection`, errors),
        };
    });
    if (errors.length) return { ok: false, errors };
    return parseProgrammeCostInputs({ version: 1, stages: stageInputs, gangFloors, supervision, hires });
}

function alignStageDrafts(stages: readonly ProgrammeCostStage[], drafts: readonly StageDraft[]): StageDraft[] {
    return stages.map((stage, index) => {
        const match = drafts[index];
        return match && match.name === stage.name ? match : { name: stage.name, day: true, night: false, costed: "" };
    });
}

function readStoredDraft(projectId: string): ProgrammeCostsDraft | null {
    try {
        const raw = window.localStorage.getItem(draftKey(projectId));
        const parsed = raw ? (JSON.parse(raw) as ProgrammeCostsDraft) : null;
        return parsed && parsed.version === 1 && Array.isArray(parsed.stages) && Array.isArray(parsed.hires) && parsed.gang && parsed.supervision ? parsed : null;
    } catch {
        return null;
    }
}

function storeDraft(projectId: string, draft: ProgrammeCostsDraft) {
    try { window.localStorage.setItem(draftKey(projectId), JSON.stringify(draft)); } catch { /* a convenience only */ }
}

// ── The panel ────────────────────────────────────────────────────────────────

export interface ProgrammeCostsPanelProps {
    projectId: string;
    estimate: Estimate | null;
    lines: EstimateLine[];
    programme: ProgrammeCostSource | null;
    s: WorkspaceStyles;
    /** Set while other estimate work is open, or when the job can no longer be edited. */
    blockedReason?: string | null;
    onApplied: (result: { lines: EstimateLine[] }) => void;
    apply?: (request: ApplyProgrammeCostsRequest) => Promise<ApplyProgrammeCostsResult>;
    defaultOpen?: boolean;
    /** Starting settings when none are applied and none are drafted in this browser (tests and previews). */
    initialInputs?: ProgrammeCostInputs;
}

export default function ProgrammeCostsPanel({
    projectId, estimate, lines, programme, s, blockedReason = null, onApplied, apply = applyProgrammeCostsAction, defaultOpen = false, initialInputs,
}: ProgrammeCostsPanelProps) {
    const [open, setOpen] = useState(defaultOpen);
    const stagesResult = useMemo(() => (programme ? programmeStagesForCosts(programme) : null), [programme]);
    const stages = stagesResult?.ok ? stagesResult.stages : [];
    const applied = useMemo(() => readAppliedProgrammeCosts(lines), [lines]);

    const [draft, setDraft] = useState<ProgrammeCostsDraft>(() => {
        const start = applied.inputs ?? initialInputs;
        return start ? draftFromInputs(start) : emptyDraft();
    });
    const inFlight = useRef(false);
    const [ack, setAck] = useState(false);
    const [work, setWork] = useState<{ status: "idle" | "saving" | "failed" | "done"; message: string | null }>({ status: "idle", message: null });
    useEffect(() => {
        const stored = readStoredDraft(projectId);
        if (stored) setDraft(stored);
    }, [projectId]);
    const update = (next: ProgrammeCostsDraft) => { setDraft(next); storeDraft(projectId, next); setAck(false); };

    const stageDrafts = alignStageDrafts(stages, draft.stages);
    const priced = useMemo(() => {
        if (!programme || !stagesResult?.ok) return null;
        const parsed = inputsFromDraft({ ...draft, stages: alignStageDrafts(stagesResult.stages, draft.stages) }, stagesResult.stages);
        return parsed.ok ? computeProgrammeCosts(programme, parsed.inputs) : { ok: false as const, errors: parsed.errors };
    }, [programme, stagesResult, draft]);

    // What the applied lines would be now, from the settings they were applied with.
    const appliedNow = useMemo(() => (programme && applied.inputs ? computeProgrammeCosts(programme, applied.inputs) : null), [programme, applied.inputs]);
    const status = programmeCostStatus(applied, appliedNow?.ok ? appliedNow.result.signature : null);

    const plan = useMemo(() => (estimate && priced?.ok ? planProgrammeCostApplication(estimate, lines, priced.result.lines) : null), [estimate, lines, priced]);

    // First apply only: an applied set is never replaced or deleted here (no atomic replace exists yet).
    const alreadyApplied = applied.lineIds.length > 0;
    const appliedLines = lines.filter((line) => applied.lineIds.includes(line.id));
    const canApply = !!estimate && !!plan && !!priced?.ok && priced.result.lines.length > 0 && !alreadyApplied && !blockedReason && work.status !== "saving";

    async function applyNow() {
        // One request at a time from this screen; a second click is ignored until the first returns.
        if (inFlight.current || !canApply || !estimate || !plan || !priced?.ok || !ack) return;
        inFlight.current = true;
        setWork({ status: "saving", message: null });
        const result = await apply({
            projectId, estimateId: estimate.id, inputs: priced.inputs,
            acknowledgement: { signature: priced.result.signature, beforePence: plan.beforePence, afterPence: plan.afterPence },
        }).catch(() => ({ ok: false as const, error: "The programme costs were not confirmed. Reload the estimate and check its Preliminaries before trying again." }))
            .finally(() => { inFlight.current = false; });
        if (!result.ok) { setWork({ status: "failed", message: result.error }); setAck(false); return; }
        onApplied({ lines: result.lines });
        setAck(false);
        setWork({ status: "done", message: result.warning ?? "Applied. The estimate's Preliminaries now carry these programme costs." });
    }

    const statusText: Record<typeof status, string> = {
        not_applied: "Not on the estimate.",
        up_to_date: "On the estimate and matching the saved programme.",
        review: "The saved programme has changed since these costs were added. The estimate still carries the earlier figures until you review and apply.",
        inconsistent: "The estimate has more than one set of programme cost lines, which may charge the same cost twice. Delete the extra lines from the estimate.",
    };
    const scheduleHref = `/dashboard/projects/schedule?projectId=${encodeURIComponent(projectId)}`;
    const setStage = (index: number, patch: Partial<StageDraft>) => update({ ...draft, stages: stageDrafts.map((stage, i) => (i === index ? { ...stage, ...patch } : stage)) });
    const setHire = (index: number, patch: Partial<HireDraft>) => update({ ...draft, stages: stageDrafts, hires: draft.hires.map((hire, i) => (i === index ? { ...hire, ...patch } : hire)) });
    const field = `${s.input} mt-1`;

    return (
        <section className={`${s.card} p-4 sm:p-6`} aria-labelledby="programme-costs-title" data-programme-costs data-programme-costs-status={status}>
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="programme-costs-body"
                className="w-full min-h-12 flex items-center justify-between gap-3 text-left">
                <span>
                    <span id="programme-costs-title" className={`block text-lg font-bold ${s.heading}`}>Programme costs</span>
                    <span className={`block text-sm ${s.muted}`}>Minimum paid gang, supervision and plant hire from your saved programme</span>
                </span>
                <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            <p className={`mt-2 text-sm ${status === "review" || status === "inconsistent" ? s.errorText : s.muted}`} role={status === "review" ? "status" : undefined} data-programme-costs-status-text>
                {applied.edited
                    ? "A programme cost line on the estimate was edited or deleted after it was applied, so it no longer matches the programme. The estimate keeps the price it has now."
                    : statusText[status]}
            </p>

            {open && (
                <div id="programme-costs-body" className="mt-4 space-y-6">
                    <p className={`text-sm ${s.muted}`}>
                        These never change your programme dates or stage lengths, and nothing is added to your price until you check the change and apply it.
                        Your settings are kept as a draft in this browser; once applied they are also saved with the estimate.
                    </p>

                    {!stagesResult?.ok ? (
                        <div className={`${s.noticeBox} text-sm`}>
                            <p>{stagesResult ? stagesResult.reason : "There is no saved programme yet. Save a programme first."}</p>
                            <Link href={scheduleHref} className="underline">Open the programme</Link>
                        </div>
                    ) : (
                        <>
                            <fieldset className="space-y-3">
                                <legend className={`text-base font-semibold ${s.heading}`}>Stages and shifts</legend>
                                <p className={`text-sm ${s.muted}`}>
                                    Operatives already costed is what your priced labour pays for on each shift worked. Leave it blank to use your priced labour hours.
                                </p>
                                {stages.map((stage, index) => {
                                    const draftStage = stageDrafts[index];
                                    const shiftCount = (draftStage.day ? 1 : 0) + (draftStage.night ? 1 : 0);
                                    const derived = derivedCostedOperatives(stage, Math.max(shiftCount, 1), stagesResult.hoursPerShift);
                                    return (
                                        <div key={`${index}-${stage.name}`} className={`${s.inset} p-3 grid gap-2 sm:grid-cols-[1fr_auto_12rem] sm:items-end`} data-programme-cost-stage>
                                            <div>
                                                <p className={`text-sm font-semibold ${s.heading}`}>{stage.name}</p>
                                                <p className={`text-sm ${s.muted}`}>
                                                    {formatPlanDate(stage.startDate, "short")} – {formatPlanDate(stage.endDate, "short")} · {stage.workingDates.length} working days
                                                </p>
                                            </div>
                                            <div className="flex gap-4">
                                                {SHIFT_KEYS.map((shift) => (
                                                    <label key={shift} className={`flex items-center gap-2 text-sm ${s.body}`}>
                                                        <input type="checkbox" checked={draftStage[shift]} onChange={(e) => setStage(index, { [shift]: e.target.checked })} />
                                                        {SHIFT_NAME[shift]}
                                                    </label>
                                                ))}
                                            </div>
                                            <label className={`text-sm ${s.body}`}>
                                                Operatives already costed
                                                <input inputMode="decimal" autoComplete="off" value={draftStage.costed} placeholder={derived.toFixed(2)}
                                                    onChange={(e) => setStage(index, { costed: e.target.value })} className={field} />
                                            </label>
                                        </div>
                                    );
                                })}
                            </fieldset>

                            <fieldset className="grid gap-3 sm:grid-cols-2">
                                <legend className={`text-base font-semibold ${s.heading}`}>Minimum paid gang</legend>
                                <p className={`sm:col-span-2 text-sm ${s.muted}`}>
                                    The fewest operatives you pay for on any shift worked. Charged once per date and shift, only for the gap above labour already costed. It does not change how long the job takes.
                                </p>
                                {SHIFT_KEYS.map((shift) => (
                                    <div key={shift} className="grid grid-cols-2 gap-2">
                                        <label className={`text-sm ${s.body}`}>{SHIFT_NAME[shift]} minimum gang
                                            <input inputMode="numeric" autoComplete="off" value={draft.gang[shift].min} className={field}
                                                onChange={(e) => update({ ...draft, stages: stageDrafts, gang: { ...draft.gang, [shift]: { ...draft.gang[shift], min: e.target.value } } })} />
                                        </label>
                                        <label className={`text-sm ${s.body}`}>£ per operative per shift
                                            <input inputMode="decimal" autoComplete="off" value={draft.gang[shift].rate} className={field}
                                                onChange={(e) => update({ ...draft, stages: stageDrafts, gang: { ...draft.gang, [shift]: { ...draft.gang[shift], rate: e.target.value } } })} />
                                        </label>
                                    </div>
                                ))}
                            </fieldset>

                            <fieldset className="grid gap-3 sm:grid-cols-2">
                                <legend className={`text-base font-semibold ${s.heading}`}>Supervision</legend>
                                <p className={`sm:col-span-2 text-sm ${s.muted}`}>Charged once for each date and shift any stage works, however many stages overlap.</p>
                                {SHIFT_KEYS.map((shift) => (
                                    <label key={shift} className={`text-sm ${s.body}`}>{SHIFT_NAME[shift]} supervision, £ per shift
                                        <input inputMode="decimal" autoComplete="off" value={draft.supervision[shift]} className={field}
                                            onChange={(e) => update({ ...draft, stages: stageDrafts, supervision: { ...draft.supervision, [shift]: e.target.value } })} />
                                    </label>
                                ))}
                            </fieldset>

                            <fieldset className="space-y-3">
                                <legend className={`text-base font-semibold ${s.heading}`}>Plant and supplier hire</legend>
                                <p className={`text-sm ${s.muted}`}>Use the supplier&apos;s own billing terms. Anything not stated is not guessed: the cost waits until it is.</p>
                                {draft.hires.map((hire, index) => {
                                    const periodic = hire.unit === "week" || hire.unit === "four_week" || hire.unit === "month";
                                    return (
                                        <div key={hire.id} className={`${s.inset} p-3 grid gap-2 sm:grid-cols-3`} data-programme-cost-hire>
                                            <div className="sm:col-span-2">
                                                <label className={`text-sm ${s.body}`} htmlFor={`programme-hire-item-${hire.id}`}>Plant item description (shown to client)</label>
                                                <input id={`programme-hire-item-${hire.id}`} value={hire.description} maxLength={200} aria-describedby={`programme-hire-item-help-${hire.id}`}
                                                    onChange={(e) => setHire(index, { description: e.target.value })} className={field} data-programme-cost-hire-item />
                                                <p id={`programme-hire-item-help-${hire.id}`} className={`mt-1 text-sm ${s.muted}`} data-programme-cost-hire-item-help>
                                                    Shown to the client. Do not enter supplier names, private rates or terms.
                                                </p>
                                                {hire.description.trim() && (
                                                    <p className={`mt-1 text-sm ${s.body}`} data-programme-cost-hire-client-wording>
                                                        The client sees: “{hireClientDescription(hire.description.trim())}”
                                                        {(hire.delivery.trim() || hire.collection.trim()) ? <> and “{hireTransportClientDescription(hire.description.trim())}”</> : null}
                                                    </p>
                                                )}
                                            </div>
                                            <label className={`text-sm ${s.body}`}>Supplier bills per
                                                <select value={hire.unit} onChange={(e) => setHire(index, { unit: e.target.value as HireUnit })} className={field}>
                                                    {HIRE_UNITS.map((unit) => <option key={unit} value={unit}>{hireUnitLabel(unit)}</option>)}
                                                </select>
                                            </label>
                                            <label className={`text-sm ${s.body}`}>£ per {hireUnitLabel(hire.unit)}
                                                <input inputMode="decimal" value={hire.rate} onChange={(e) => setHire(index, { rate: e.target.value })} className={field} />
                                            </label>
                                            {hire.unit === "day" && (
                                                <label className={`text-sm ${s.body}`}>Days charged
                                                    <select value={hire.chargeableDays} onChange={(e) => setHire(index, { chargeableDays: e.target.value as ChargeableDays | "" })} className={field}>
                                                        <option value="">Choose…</option>
                                                        {CHARGEABLE_DAYS.map((value) => <option key={value} value={value}>{CHARGEABLE_LABEL[value]}</option>)}
                                                    </select>
                                                </label>
                                            )}
                                            {periodic && (
                                                <label className={`text-sm ${s.body}`}>Part {hire.unit === "month" ? "month" : "period"}
                                                    <select value={hire.partPeriodRule} onChange={(e) => setHire(index, { partPeriodRule: e.target.value as "whole_period" | "" })} className={field}>
                                                        <option value="">Choose…</option>
                                                        <option value="whole_period">Charged as a whole period</option>
                                                    </select>
                                                </label>
                                            )}
                                            <label className={`text-sm ${s.body}`}>Minimum hire ({hireUnitLabel(hire.unit)}s)
                                                <input inputMode="numeric" value={hire.minimumPeriods} onChange={(e) => setHire(index, { minimumPeriods: e.target.value })} className={field} />
                                            </label>
                                            <label className={`text-sm ${s.body}`}>On hire
                                                <select value={hire.onKind === "date" ? "date" : hire.onStage} className={field}
                                                    onChange={(e) => setHire(index, e.target.value === "date" ? { onKind: "date" } : { onKind: "stage_start", onStage: e.target.value })}>
                                                    {stages.map((stage, i) => <option key={i} value={String(i)}>Start of {stage.name}</option>)}
                                                    <option value="date">A date</option>
                                                </select>
                                                {hire.onKind === "date" && <input type="date" value={hire.onDate} onChange={(e) => setHire(index, { onDate: e.target.value })} className={field} />}
                                            </label>
                                            <label className={`text-sm ${s.body}`}>Off hire
                                                <select value={hire.offKind === "date" ? "date" : hire.offStage} className={field}
                                                    onChange={(e) => setHire(index, e.target.value === "date" ? { offKind: "date" } : { offKind: "stage_finish", offStage: e.target.value })}>
                                                    {stages.map((stage, i) => <option key={i} value={String(i)}>End of {stage.name}</option>)}
                                                    <option value="date">A date</option>
                                                </select>
                                                {hire.offKind === "date" && <input type="date" value={hire.offDate} onChange={(e) => setHire(index, { offDate: e.target.value })} className={field} />}
                                            </label>
                                            <label className={`text-sm ${s.body}`}>Supplier stops charging at
                                                <select value={hire.offHireRule} onChange={(e) => setHire(index, { offHireRule: e.target.value as OffHireRule | "" })} className={field}>
                                                    <option value="">Choose…</option>
                                                    {OFF_HIRE_RULES.map((rule) => <option key={rule} value={rule}>{OFF_HIRE_LABEL[rule]}</option>)}
                                                </select>
                                            </label>
                                            <label className={`text-sm ${s.body}`}>Days charged after off-hire
                                                <input inputMode="numeric" value={hire.offHireDays} onChange={(e) => setHire(index, { offHireDays: e.target.value })} className={field} />
                                            </label>
                                            <label className={`text-sm ${s.body}`}>£ delivery
                                                <input inputMode="decimal" value={hire.delivery} onChange={(e) => setHire(index, { delivery: e.target.value })} className={field} />
                                            </label>
                                            <label className={`text-sm ${s.body}`}>£ collection
                                                <input inputMode="decimal" value={hire.collection} onChange={(e) => setHire(index, { collection: e.target.value })} className={field} />
                                            </label>
                                            <div className="sm:col-span-3">
                                                <button type="button" className={s.quietButton} onClick={() => update({ ...draft, stages: stageDrafts, hires: draft.hires.filter((_, i) => i !== index) })}>
                                                    <Trash2 className="w-4 h-4" aria-hidden="true" /> Remove this hire
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                <button type="button" className={s.secondaryButton} onClick={() => update({ ...draft, stages: stageDrafts, hires: [...draft.hires, newHire()] })}>
                                    <Plus className="w-4 h-4" aria-hidden="true" /> Add a hire
                                </button>
                            </fieldset>

                            <ProgrammeCostsReview priced={priced} plan={alreadyApplied ? null : plan} s={s} />

                            {alreadyApplied && priced?.ok && (
                                <div className={`${s.noticeBox} space-y-2 text-sm`} data-programme-costs-first-apply-only>
                                    <p>
                                        {applied.signature === priced.result.signature
                                            ? "These programme costs are on the estimate."
                                            : "The figures above differ from the programme cost lines on the estimate. The estimate keeps its lines until you change them."}
                                    </p>
                                    <p>
                                        This version adds programme costs once and does not replace them. To use new figures, delete these lines from the estimate, then apply again here:
                                    </p>
                                    <ul className="list-disc pl-5">{appliedLines.map((line) => <li key={line.id}>{line.description} ({formatGBP(Number(line.line_total) || 0)})</li>)}</ul>
                                </div>
                            )}

                            {estimate && priced?.ok && plan && !alreadyApplied && priced.result.lines.length > 0 && (
                                <div className="space-y-3" data-programme-costs-apply>
                                    {blockedReason && <p className={`text-sm ${s.muted}`}>{blockedReason}</p>}
                                    <label className={`flex items-start gap-2 text-sm ${s.body}`}>
                                        <input type="checkbox" checked={ack} disabled={!canApply} onChange={(e) => setAck(e.target.checked)} data-programme-costs-ack />
                                        <span>I have checked this change: the total before VAT goes from {formatGBP(poundsFromPence(plan.beforePence))} to {formatGBP(poundsFromPence(plan.afterPence))}.</span>
                                    </label>
                                    <button type="button" className={`${s.primaryButton} w-full sm:w-auto`} disabled={!canApply || !ack} onClick={() => void applyNow()}>
                                        {work.status === "saving" ? <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Applying…</> : "Apply programme costs to the estimate"}
                                    </button>
                                </div>
                            )}
                            {!estimate && <p className={`text-sm ${s.muted}`}>Add a price line first. Programme costs are added to an estimate.</p>}
                            {work.message && (
                                <p role={work.status === "failed" ? "alert" : "status"} className={`text-sm ${work.status === "failed" ? s.errorText : s.muted}`}>{work.message}</p>
                            )}
                        </>
                    )}
                </div>
            )}
        </section>
    );
}

function ProgrammeCostsReview({ priced, plan, s }: {
    priced: ReturnType<typeof computeProgrammeCosts> | { ok: false; errors: string[] } | null;
    plan: ReturnType<typeof planProgrammeCostApplication> | null;
    s: WorkspaceStyles;
}) {
    if (!priced) return null;
    if (!priced.ok) {
        return (
            <div role="alert" className={`${s.errorBox} flex items-start gap-3 text-sm`} data-programme-costs-errors>
                <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <ul className="space-y-1">{priced.errors.map((error) => <li key={error}>{error}</li>)}</ul>
            </div>
        );
    }
    const { result } = priced;
    return (
        <div className="space-y-3" data-programme-costs-review>
            <h3 className={`text-base font-semibold ${s.heading}`}>Preliminaries these settings give</h3>
            {result.lines.length > 0 && (
                <p className={`text-sm ${s.muted}`} data-programme-costs-client-wording-note>
                    Each description below is exactly what the client sees on the proposal and the client BoQ. Rates and settings stay internal.
                </p>
            )}
            {result.lines.length === 0 ? (
                <p className={`text-sm ${s.muted}`}>No programme costs: nothing is charged with these settings.</p>
            ) : (
                <dl className="space-y-1">
                    {result.lines.map((line) => (
                        <div key={line.key} className="flex items-baseline justify-between gap-3" data-programme-cost-line={line.key}>
                            <dt className={`text-sm ${s.body}`}>{line.description} <span className={s.muted}>({line.quantity} × {formatGBP(poundsFromPence(line.unitRatePence))} {line.unit})</span></dt>
                            <dd className={`text-sm font-semibold ${s.heading}`}>{formatGBP(poundsFromPence(line.totalPence))}</dd>
                        </div>
                    ))}
                </dl>
            )}
            {result.gangFloors.some((floor) => floor.totalPence > 0) && (
                <details className="text-sm">
                    <summary className={`cursor-pointer ${s.body}`}>Minimum paid gang, date by date</summary>
                    <table className="mt-2 w-full text-left text-sm">
                        <thead><tr className={s.muted}><th>Date</th><th>Shift</th><th>Already costed</th><th>Added</th><th className="text-right">Cost</th></tr></thead>
                        <tbody>
                            {result.gangFloors.flatMap((floor) => floor.windows.filter((window) => window.upliftPence > 0).map((window) => (
                                <tr key={`${window.date}-${window.shift}`} className={s.body}>
                                    <td>{formatPlanDate(window.date, "short")}</td><td>{SHIFT_NAME[window.shift]}</td>
                                    <td>{window.costedOperatives.toFixed(2)}</td><td>{window.additionalOperatives.toFixed(2)}</td>
                                    <td className="text-right">{formatGBP(poundsFromPence(window.upliftPence))}</td>
                                </tr>
                            )))}
                        </tbody>
                    </table>
                </details>
            )}
            {result.hires.map((hire) => (
                <p key={hire.id} className={`text-sm ${s.muted}`} data-programme-cost-hire-basis>
                    {hire.description}: on hire {formatPlanDate(hire.onHireDate, "short")}, charged to {formatPlanDate(hire.billingEndDate, "short")}
                    {hire.chargeableDayCount !== null ? ` (${hire.chargeableDayCount} chargeable days)` : ` (${hire.calendarDays} calendar days)`}
                    {" "}= {hire.periodsFromDates} × {hireUnitLabel(hire.unit)}{hire.minimumApplied ? `, minimum hire of ${hire.periods} applied` : ""}.
                </p>
            ))}
            {plan && (
                <div className={`${s.inset} p-3 space-y-1 text-sm`} data-programme-costs-change>
                    <p className={s.body}>Total before VAT now: <strong>{formatGBP(poundsFromPence(plan.beforePence))}</strong></p>
                    <p className={s.body}>After applying: <strong>{formatGBP(poundsFromPence(plan.afterPence))}</strong> ({plan.changePence >= 0 ? "+" : "−"}{formatGBP(poundsFromPence(Math.abs(plan.changePence)))})</p>
                    <p className={s.muted}>Adds Preliminaries lines. Your other lines are kept.</p>
                    {plan.prelimsBasisChange === "pct_to_lines" && (
                        <p className={s.errorText} data-programme-costs-prelims-switch>
                            Your preliminaries percentage ({formatGBP(poundsFromPence(plan.prelimsPctPenceDropped))} now) stops applying once Preliminaries are priced as lines. Add any other preliminaries as lines too.
                        </p>
                    )}
                    {plan.prelimsBasisChange === "lines_to_pct" && (
                        <p className={s.errorText} data-programme-costs-prelims-switch>No Preliminaries lines would be left, so your preliminaries percentage applies again.</p>
                    )}
                    {plan.possibleDuplicates.length > 0 && (
                        <p className={s.errorText} data-programme-costs-duplicates>
                            Check these Preliminaries lines do not already pay for the same thing: {plan.possibleDuplicates.join(", ")}.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
