/**
 * Constructa — SCL Delay Analysis Protocol engine.
 *
 * Four methodologies per the Society of Construction Law's
 * Delay and Disruption Protocol (2nd Edition, February 2017):
 *
 *   1. As-Planned vs As-Built
 *   2. Time Impact Analysis
 *   3. Collapsed As-Built
 *   4. Windows Analysis
 *
 * All functions are pure — no DB calls, no auth. They operate
 * on programme phase arrays and contract event arrays, both of
 * which the caller fetches from Supabase and passes in.
 */

// ── Input types ──────��─────────────────────────────────────────────────────

export interface DelayPhase {
    name: string;
    calculatedDays: number;
    manualDays?: number | null;
    startOffset: number;                // days from project start (baseline)
    actual_start_date?: string | null;  // ISO date YYYY-MM-DD
    actual_finish_date?: string | null;
    revised_planned_finish?: string | null;
    delay_reason?: string | null;
    delay_category?: string | null;
    pct_complete?: number | null;
}

export interface DelayEvent {
    id: string;
    title: string;
    reference?: string | null;
    date_raised: string;       // ISO date
    event_type: string;
    status: string;
    assessed_time?: number | null;   // days assessed by PM
    agreed_time?: number | null;     // days agreed by parties
}

// ── Result types ───────────────────────────────────────────────────────────

export interface PhaseDelayRow {
    phaseName: string;
    plannedStart: string;
    plannedFinish: string;
    actualStart: string | null;
    actualFinish: string | null;
    baselineDuration: number;
    actualDuration: number | null;
    delayDays: number;
    delayReason: string | null;
    delayCategory: string | null;
}

export interface AsPlannedVsAsBuiltResult {
    methodology: "as_planned_vs_as_built";
    totalPlannedDuration: number;
    totalActualDuration: number;
    totalProjectDelay: number;
    phases: PhaseDelayRow[];
    delaySummaryByCategory: Record<string, number>;
}

export interface TimeImpactRow {
    eventId: string;
    eventTitle: string;
    eventRef: string | null;
    dateRaised: string;
    timeClaimed: number;
    preEventCompletion: string;
    postEventCompletion: string;
    impactDays: number;
}

export interface TimeImpactResult {
    methodology: "time_impact";
    events: TimeImpactRow[];
    cumulativeImpact: number;
    baselineCompletion: string;
    adjustedCompletion: string;
}

export interface CollapsedStep {
    eventRemoved: string;
    eventTitle: string;
    resultingCompletion: string;
    daysRecovered: number;
}

export interface CollapsedAsBuiltResult {
    methodology: "collapsed_as_built";
    asBuiltCompletion: string;
    steps: CollapsedStep[];
    totalRecoverableDays: number;
    collapsedCompletion: string;
}

export interface WindowRow {
    windowNumber: number;
    startDate: string;
    endDate: string;
    plannedProgress: number;
    actualProgress: number;
    delayAccrued: number;
    dominantCause: string | null;
    events: string[];
}

export interface WindowsAnalysisResult {
    methodology: "windows";
    windowSizeDays: number;
    windows: WindowRow[];
    totalDelay: number;
}

// ── Date helpers ───────────────────────────────────────────────────────────

function addDays(iso: string, days: number): string {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
    return Math.round(
        (new Date(a + "T00:00:00").getTime() - new Date(b + "T00:00:00").getTime()) / 86400000,
    );
}

function phaseDuration(p: DelayPhase): number {
    return p.manualDays ?? p.calculatedDays ?? 7;
}

function plannedFinish(p: DelayPhase, projectStart: string): string {
    return addDays(projectStart, p.startOffset + phaseDuration(p));
}

function plannedStart(p: DelayPhase, projectStart: string): string {
    return addDays(projectStart, p.startOffset);
}

function projectPlannedEnd(phases: DelayPhase[], projectStart: string): string {
    let maxEnd = projectStart;
    for (const p of phases) {
        const end = plannedFinish(p, projectStart);
        if (end > maxEnd) maxEnd = end;
    }
    return maxEnd;
}

function projectActualEnd(phases: DelayPhase[], projectStart: string): string {
    let maxEnd = projectPlannedEnd(phases, projectStart);
    for (const p of phases) {
        if (p.actual_finish_date && p.actual_finish_date > maxEnd) {
            maxEnd = p.actual_finish_date;
        }
    }
    return maxEnd;
}

// ── Methodology 1: As-Planned vs As-Built ──────────────────────────────────

export function analyseAsPlannedVsAsBuilt(
    phases: DelayPhase[],
    projectStart: string,
): AsPlannedVsAsBuiltResult {
    const rows: PhaseDelayRow[] = phases.map(p => {
        const pStart = plannedStart(p, projectStart);
        const pFinish = plannedFinish(p, projectStart);
        const baseDur = phaseDuration(p);
        const aStart = p.actual_start_date ?? null;
        const aFinish = p.actual_finish_date ?? (p.revised_planned_finish ?? null);
        const actDur = aStart && aFinish ? diffDays(aFinish, aStart) : null;
        const delay = aFinish ? diffDays(aFinish, pFinish) : 0;

        return {
            phaseName: p.name,
            plannedStart: pStart,
            plannedFinish: pFinish,
            actualStart: aStart,
            actualFinish: aFinish,
            baselineDuration: baseDur,
            actualDuration: actDur,
            delayDays: Math.max(0, delay),
            delayReason: p.delay_reason ?? null,
            delayCategory: p.delay_category ?? null,
        };
    });

    const categorySums: Record<string, number> = {};
    for (const r of rows) {
        if (r.delayDays > 0) {
            const cat = r.delayCategory || r.delayReason || "Unattributed";
            categorySums[cat] = (categorySums[cat] || 0) + r.delayDays;
        }
    }

    const plannedEnd = projectPlannedEnd(phases, projectStart);
    const actualEnd = projectActualEnd(phases, projectStart);
    const totalPlanned = diffDays(plannedEnd, projectStart);
    const totalActual = diffDays(actualEnd, projectStart);

    return {
        methodology: "as_planned_vs_as_built",
        totalPlannedDuration: totalPlanned,
        totalActualDuration: totalActual,
        totalProjectDelay: Math.max(0, totalActual - totalPlanned),
        phases: rows,
        delaySummaryByCategory: categorySums,
    };
}

// ── Methodology 2: Time Impact Analysis ───────��────────────────────────────

export function analyseTimeImpact(
    phases: DelayPhase[],
    events: DelayEvent[],
    projectStart: string,
): TimeImpactResult {
    const baselineEnd = projectPlannedEnd(phases, projectStart);

    // Sort events chronologically
    const sorted = [...events]
        .filter(e => (e.assessed_time ?? e.agreed_time ?? 0) > 0)
        .sort((a, b) => a.date_raised.localeCompare(b.date_raised));

    let cumulativeShift = 0;
    const rows: TimeImpactRow[] = sorted.map(ev => {
        const timeClaimed = ev.agreed_time ?? ev.assessed_time ?? 0;
        const preCompletion = addDays(baselineEnd, cumulativeShift);
        cumulativeShift += timeClaimed;
        const postCompletion = addDays(baselineEnd, cumulativeShift);

        return {
            eventId: ev.id,
            eventTitle: ev.title,
            eventRef: ev.reference ?? null,
            dateRaised: ev.date_raised,
            timeClaimed,
            preEventCompletion: preCompletion,
            postEventCompletion: postCompletion,
            impactDays: timeClaimed,
        };
    });

    return {
        methodology: "time_impact",
        events: rows,
        cumulativeImpact: cumulativeShift,
        baselineCompletion: baselineEnd,
        adjustedCompletion: addDays(baselineEnd, cumulativeShift),
    };
}

// ── Methodology 3: Collapsed As-Built ────────��─────────────────────────────

export function analyseCollapsedAsBuilt(
    phases: DelayPhase[],
    events: DelayEvent[],
    projectStart: string,
): CollapsedAsBuiltResult {
    const asBuiltEnd = projectActualEnd(phases, projectStart);

    // Work backwards — remove each event's impact and see what completion
    // would have been without it.
    const sorted = [...events]
        .filter(e => (e.assessed_time ?? e.agreed_time ?? 0) > 0)
        .sort((a, b) => b.date_raised.localeCompare(a.date_raised)); // reverse chronological

    let currentEnd = asBuiltEnd;
    const steps: CollapsedStep[] = sorted.map(ev => {
        const timeClaimed = ev.agreed_time ?? ev.assessed_time ?? 0;
        const newEnd = addDays(currentEnd, -timeClaimed);
        const daysRecovered = timeClaimed;
        const step: CollapsedStep = {
            eventRemoved: ev.id,
            eventTitle: `${ev.reference ?? ""} ${ev.title}`.trim(),
            resultingCompletion: newEnd,
            daysRecovered,
        };
        currentEnd = newEnd;
        return step;
    });

    const totalRecoverable = steps.reduce((s, step) => s + step.daysRecovered, 0);

    return {
        methodology: "collapsed_as_built",
        asBuiltCompletion: asBuiltEnd,
        steps,
        totalRecoverableDays: totalRecoverable,
        collapsedCompletion: currentEnd,
    };
}

// ── Methodology 4: Windows Analysis ────────────────────────────────────────

export function analyseWindows(
    phases: DelayPhase[],
    events: DelayEvent[],
    projectStart: string,
    windowSizeDays = 28,
): WindowsAnalysisResult {
    const plannedEnd = projectPlannedEnd(phases, projectStart);
    const actualEnd = projectActualEnd(phases, projectStart);
    const projectEnd = actualEnd > plannedEnd ? actualEnd : plannedEnd;
    const totalSpan = diffDays(projectEnd, projectStart);
    const numWindows = Math.max(1, Math.ceil(totalSpan / windowSizeDays));

    const windows: WindowRow[] = [];

    for (let w = 0; w < numWindows; w++) {
        const wStart = addDays(projectStart, w * windowSizeDays);
        const wEnd = addDays(projectStart, Math.min((w + 1) * windowSizeDays, totalSpan));
        const wStartMs = new Date(wStart + "T00:00:00").getTime();
        const wEndMs = new Date(wEnd + "T00:00:00").getTime();
        const wDays = diffDays(wEnd, wStart);

        // Calculate planned progress in this window
        let plannedProgress = 0;
        let actualProgress = 0;
        for (const p of phases) {
            const pS = new Date(plannedStart(p, projectStart) + "T00:00:00").getTime();
            const pF = new Date(plannedFinish(p, projectStart) + "T00:00:00").getTime();
            const dur = phaseDuration(p);

            // Overlap of planned phase with window
            const overlapStart = Math.max(pS, wStartMs);
            const overlapEnd = Math.min(pF, wEndMs);
            if (overlapEnd > overlapStart) {
                const overlapDays = Math.round((overlapEnd - overlapStart) / 86400000);
                plannedProgress += overlapDays;
            }

            // Overlap of actual phase with window
            if (p.actual_start_date && p.actual_finish_date) {
                const aS = new Date(p.actual_start_date + "T00:00:00").getTime();
                const aF = new Date(p.actual_finish_date + "T00:00:00").getTime();
                const aOverlapStart = Math.max(aS, wStartMs);
                const aOverlapEnd = Math.min(aF, wEndMs);
                if (aOverlapEnd > aOverlapStart) {
                    actualProgress += Math.round((aOverlapEnd - aOverlapStart) / 86400000);
                }
            }
        }

        // Events in this window
        const windowEvents = events.filter(e => {
            const eMs = new Date(e.date_raised + "T00:00:00").getTime();
            return eMs >= wStartMs && eMs < wEndMs;
        });

        // Dominant cause — find the most common delay_category among phases
        // active in this window
        const causes: Record<string, number> = {};
        for (const p of phases) {
            if (p.delay_category && p.actual_finish_date) {
                const pF = new Date(plannedFinish(p, projectStart) + "T00:00:00").getTime();
                const aF = new Date(p.actual_finish_date + "T00:00:00").getTime();
                if (aF > pF && pF >= wStartMs && pF < wEndMs) {
                    causes[p.delay_category] = (causes[p.delay_category] || 0) + 1;
                }
            }
        }
        const dominantCause = Object.entries(causes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        const delayAccrued = Math.max(0, plannedProgress - actualProgress);

        windows.push({
            windowNumber: w + 1,
            startDate: wStart,
            endDate: wEnd,
            plannedProgress,
            actualProgress,
            delayAccrued,
            dominantCause,
            events: windowEvents.map(e => `${e.reference ?? ""} ${e.title}`.trim()),
        });
    }

    return {
        methodology: "windows",
        windowSizeDays,
        windows,
        totalDelay: windows.reduce((s, w) => s + w.delayAccrued, 0),
    };
}
