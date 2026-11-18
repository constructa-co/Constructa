import { plainDeepEqual } from "@/lib/plain-deep-equal";

/** Operational tracking fields stay on the saved proposal programme, not the planner draft. */
const TRACKING_FIELDS = new Set([
    "pct_complete", "actual_start_date", "actual_finish_date", "revised_planned_finish",
    "delay_reason", "delay_category", "delay_notes",
]);

/** Identity stable when stages are reordered — offsets and dependencies are excluded. */
export function programmePhaseIdentityKey(phase: unknown): string {
    if (!phase || typeof phase !== "object" || Array.isArray(phase)) return "";
    const p = phase as Record<string, unknown>;
    return JSON.stringify({
        name: p.name,
        calculatedDays: p.calculatedDays,
        manualDays: p.manualDays,
        manhours: p.manhours,
        ...(p.color !== undefined ? { color: p.color } : {}),
        ...(p.needsReview !== undefined ? { needsReview: p.needsReview } : {}),
    });
}

function trackingFieldsOf(phase: unknown): Record<string, unknown> {
    if (!phase || typeof phase !== "object" || Array.isArray(phase)) return {};
    return Object.fromEntries(
        Object.entries(phase as Record<string, unknown>).filter(([key]) => TRACKING_FIELDS.has(key)),
    );
}

function trackingByIdentity(phases: unknown[]): Map<string, Record<string, unknown>> {
    const map = new Map<string, Record<string, unknown>>();
    for (const phase of phases) {
        const key = programmePhaseIdentityKey(phase);
        if (!key) continue;
        map.set(key, trackingFieldsOf(phase));
    }
    return map;
}

function trackingRecordHasData(tracking: Record<string, unknown>): boolean {
    return Object.values(tracking).some(value => value !== undefined && value !== null && value !== "");
}

export const PROGRAMME_TRACKING_ASSOCIATION_ERROR =
    "Live tracking could not be matched to a saved programme stage. Each stage needs a unique name, duration and hours while tracking is in use.";

export function programmePhaseIdentityCollisions(phases: unknown[]): boolean {
    const seen = new Set<string>();
    for (const phase of phases) {
        const key = programmePhaseIdentityKey(phase);
        if (!key) continue;
        if (seen.has(key)) return true;
        seen.add(key);
    }
    return false;
}

/** Duplicate identity keys only block tracking when at least one colliding stage carries tracking data. */
export function programmeIdentityCollisionsInvolvingTracking(phases: unknown[]): boolean {
    const byKey = new Map<string, unknown[]>();
    for (const phase of phases) {
        const key = programmePhaseIdentityKey(phase);
        if (!key) continue;
        const bucket = byKey.get(key) ?? [];
        bucket.push(phase);
        byKey.set(key, bucket);
    }
    for (const group of byKey.values()) {
        if (group.length < 2) continue;
        const anyTracking = group.some(phase => trackingRecordHasData(trackingFieldsOf(phase)));
        if (anyTracking) return true;
    }
    return false;
}

/** Refuse when tracking cannot be mapped uniquely between published and on-screen stages. */
export function programmeTrackingAssociationError(published: unknown[], observed: unknown[]): string | null {
    if (
        programmeIdentityCollisionsInvolvingTracking(published)
        || programmeIdentityCollisionsInvolvingTracking(observed)
    ) {
        return PROGRAMME_TRACKING_ASSOCIATION_ERROR;
    }
    const pub = trackingByIdentity(published);
    const obs = trackingByIdentity(observed);
    for (const [key, tracking] of pub) {
        if (trackingRecordHasData(tracking) && !obs.has(key)) {
            return PROGRAMME_TRACKING_ASSOCIATION_ERROR;
        }
    }
    const keys = new Set([...pub.keys(), ...obs.keys()]);
    for (const key of keys) {
        const before = pub.get(key) ?? {};
        const after = obs.get(key) ?? {};
        if (!plainDeepEqual(before, after) && !pub.has(key)) {
            return PROGRAMME_TRACKING_ASSOCIATION_ERROR;
        }
    }
    return null;
}

export function phasesWithoutTrackingFields(phases: unknown[]): unknown[] {
    return phases.map(stripProgrammeTrackingFields);
}

/** Apply published operational tracking onto draft planning stages, matched by stable identity. */
export function overlayPublishedTrackingOnDraftPhases(published: unknown[], draft: unknown[]): unknown[] {
    const tracking = trackingByIdentity(published);
    return draft.map(phase => {
        const key = programmePhaseIdentityKey(phase);
        const patch = tracking.get(key);
        if (!patch || !Object.keys(patch).length) return phase;
        if (!phase || typeof phase !== "object" || Array.isArray(phase)) return phase;
        return { ...phase, ...patch };
    });
}

/** Write tracking edits to the published programme without adopting unpublished planning from the UI. */
export function mergeTrackingOntoPublishedPlanning(published: unknown[], observed: unknown[]): unknown[] {
    const tracking = trackingByIdentity(observed);
    return published.map(phase => {
        const key = programmePhaseIdentityKey(phase);
        const patch = tracking.get(key);
        if (!patch) return phase;
        if (!phase || typeof phase !== "object" || Array.isArray(phase)) return phase;
        return { ...phase, ...patch };
    });
}

export function programmeTrackingFieldsChanged(
    before: unknown[], after: unknown[], _startBefore?: string, _startAfter?: string,
): boolean {
    const left = trackingByIdentity(before);
    const right = trackingByIdentity(after);
    const keys = new Set([...left.keys(), ...right.keys()]);
    for (const key of keys) {
        if (!plainDeepEqual(left.get(key) ?? {}, right.get(key) ?? {})) return true;
    }
    return false;
}

export function stripProgrammeTrackingFields(phase: unknown): unknown {
    if (!phase || typeof phase !== "object" || Array.isArray(phase)) return phase;
    return Object.fromEntries(Object.entries(phase).filter(([key]) => !TRACKING_FIELDS.has(key)));
}

export function programmePlanningSnapshot(phases: unknown[], startDate: string): string {
    return JSON.stringify({ phases: phases.map(stripProgrammeTrackingFields), startDate });
}

export function programmePlanningChanged(before: unknown[], after: unknown[], startBefore: string, startAfter: string): boolean {
    if (startBefore !== startAfter) return true;
    return !plainDeepEqual(before.map(stripProgrammeTrackingFields), after.map(stripProgrammeTrackingFields));
}

export function programmeTrackingOnlyChanged(before: unknown[], after: unknown[], startBefore: string, startAfter: string): boolean {
    if (startBefore !== startAfter) return false;
    return programmeTrackingFieldsChanged(before, after, startBefore, startAfter)
        && !programmePlanningChanged(before, after, startBefore, startAfter);
}

export type ProgrammePlannerDraftRecord = {
    phases: unknown[];
    start_date: string;
    saved_at: string;
    /** Authenticated owner scope — local fallback only; rejects cross-account tab reuse. */
    storage_scope?: string;
};

export function parseProgrammePlannerDraft(value: unknown): ProgrammePlannerDraftRecord | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (!Array.isArray(record.phases) || typeof record.start_date !== "string") return null;
    return {
        phases: record.phases,
        start_date: record.start_date,
        saved_at: typeof record.saved_at === "string" ? record.saved_at : "",
        ...(typeof record.storage_scope === "string" ? { storage_scope: record.storage_scope } : {}),
    };
}

export const PROGRAMME_PLANNER_DRAFT_UNAVAILABLE =
    "Planner draft storage is not available on the server yet. Changes stay in this browser until you save to the proposal.";

const LOCAL_DRAFT_PREFIX = "constructa.programme-planner-draft.";

export function localPlannerDraftKey(projectId: string, storageScope?: string): string {
    return storageScope
        ? `${LOCAL_DRAFT_PREFIX}${storageScope}.${projectId}`
        : `${LOCAL_DRAFT_PREFIX}${projectId}`;
}

function acceptLocalPlannerDraft(
    record: ProgrammePlannerDraftRecord | null,
    storageScope?: string,
): ProgrammePlannerDraftRecord | null {
    if (!record) return null;
    if (storageScope && record.storage_scope !== storageScope) return null;
    return record;
}

export function readLocalPlannerDraft(projectId: string, storageScope?: string): ProgrammePlannerDraftRecord | null {
    if (typeof sessionStorage === "undefined") return null;
    const keys = storageScope
        ? [localPlannerDraftKey(projectId, storageScope), localPlannerDraftKey(projectId)]
        : [localPlannerDraftKey(projectId)];
    for (const key of keys) {
        try {
            const raw = sessionStorage.getItem(key);
            if (!raw) continue;
            const record = acceptLocalPlannerDraft(parseProgrammePlannerDraft(JSON.parse(raw)), storageScope);
            if (record) return record;
        } catch {
            continue;
        }
    }
    return null;
}

/** Returns false when sessionStorage is missing or the write was rejected (quota, privacy mode). */
export function writeLocalPlannerDraft(
    projectId: string,
    phases: unknown[],
    startDate: string,
    storageScope?: string,
): boolean {
    if (typeof sessionStorage === "undefined") return false;
    const payload: ProgrammePlannerDraftRecord = {
        phases,
        start_date: startDate,
        saved_at: new Date().toISOString(),
        ...(storageScope ? { storage_scope: storageScope } : {}),
    };
    const key = localPlannerDraftKey(projectId, storageScope);
    try {
        sessionStorage.setItem(key, JSON.stringify(payload));
        if (storageScope) sessionStorage.removeItem(localPlannerDraftKey(projectId));
        return true;
    } catch {
        return false;
    }
}

export function clearLocalPlannerDraft(projectId: string, storageScope?: string): void {
    if (typeof sessionStorage === "undefined") return;
    try {
        sessionStorage.removeItem(localPlannerDraftKey(projectId, storageScope));
        sessionStorage.removeItem(localPlannerDraftKey(projectId));
    } catch {
        // Best-effort clear when storage is blocked.
    }
}