import { MAX_STAGE_NAME_LENGTH, type ProgrammeState, type ProgrammeStore } from "./simple-programme";

function record(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** Only explicit saved activity names from the loaded job's selected estimate. */
export function programmeEstimateActivities(projectId: string, value: unknown): { revision: string; names: string[] } {
    const estimate = record(value);
    if (!projectId || !estimate || estimate.project_id !== projectId || typeof estimate.id !== "string" || !estimate.id || !Array.isArray(estimate.estimate_lines)) {
        return { revision: "unavailable", names: [] };
    }
    const names = new Set<string>();
    const rows: unknown[] = [];
    for (const entry of estimate.estimate_lines) {
        const line = record(entry);
        if (!line || typeof line.id !== "string" || !line.id || line.estimate_id !== estimate.id || typeof line.trade_section !== "string") continue;
        rows.push([line.id, line.estimate_id, line.trade_section]);
        if (line.trade_section.trim()) names.add(line.trade_section);
    }
    return { revision: JSON.stringify([projectId, estimate.id, rows]), names: [...names] };
}

/** A reviewed copy changes one empty draft name, never dates, duration or persistence. */
export function copyProgrammeActivityName(
    store: ProgrammeStore, reviewed: ProgrammeState, stageKey: string, name: string, names: readonly string[],
): boolean {
    const current = store.getState();
    if (current !== reviewed || current.save.status !== "idle" || !names.includes(name) || !name.trim() || name.length > MAX_STAGE_NAME_LENGTH) return false;
    const stage = current.draft.stages.find(stage => stage.key === stageKey);
    if (!stage || stage.name !== "") return false;
    store.dispatch({ type: "stage/change", key: stageKey, patch: { name } });
    return true;
}
