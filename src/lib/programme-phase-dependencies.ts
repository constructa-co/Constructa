import { plannerCalendarDays } from "./planner-phases";

/** Minimal programme stage shape for dependency checks and drag reconciliation. */
export interface ProgrammePhaseLink {
    startOffset: number;
    calculatedDays: number;
    manualDays: number | null;
    dependsOn?: number[];
}

export const PROGRAMME_CIRCULAR_DEPENDENCY_ERROR =
    "A stage cannot depend on itself or on a stage that already depends on it.";

function phaseWorkingDays(phase: Pick<ProgrammePhaseLink, "manualDays" | "calculatedDays">): number {
    return phase.manualDays ?? phase.calculatedDays;
}

function predecessorEndOffset(
    phases: readonly ProgrammePhaseLink[],
    predIdx: number,
    daysPerWeek: number,
): number {
    const pred = phases[predIdx];
    const span = plannerCalendarDays(phaseWorkingDays(pred), daysPerWeek);
    return pred.startOffset + span;
}

function normalizedDependsOn(
    dependsOn: number[] | undefined,
    phaseIndex: number,
    phaseCount: number,
): number[] {
    return (dependsOn ?? []).filter(
        dep => Number.isInteger(dep) && dep >= 0 && dep < phaseCount && dep !== phaseIndex,
    );
}

/**
 * Adding `successorIdx` → `predecessorIdx` would close a cycle when the predecessor
 * already depends (directly or transitively) on the successor.
 */
export function wouldCreateCircularDependency(
    phases: readonly ProgrammePhaseLink[],
    successorIdx: number,
    predecessorIdx: number,
): boolean {
    if (successorIdx < 0 || successorIdx >= phases.length) return false;
    if (predecessorIdx < 0 || predecessorIdx >= phases.length) return false;
    if (successorIdx === predecessorIdx) return true;
    const visited = new Set<number>();
    const stack = [predecessorIdx];
    while (stack.length > 0) {
        const idx = stack.pop()!;
        if (idx === successorIdx) return true;
        if (visited.has(idx)) continue;
        visited.add(idx);
        for (const dep of normalizedDependsOn(phases[idx]?.dependsOn, idx, phases.length)) {
            stack.push(dep);
        }
    }
    return false;
}

/** True when any saved dependsOn chain loops back. */
export function programmeHasCircularDependencies(phases: readonly ProgrammePhaseLink[]): boolean {
    const visiting = new Set<number>();
    const done = new Set<number>();
    function dfs(idx: number): boolean {
        if (done.has(idx)) return false;
        if (visiting.has(idx)) return true;
        visiting.add(idx);
        for (const dep of normalizedDependsOn(phases[idx]?.dependsOn, idx, phases.length)) {
            if (dfs(dep)) return true;
        }
        visiting.delete(idx);
        done.add(idx);
        return false;
    }
    for (let i = 0; i < phases.length; i++) {
        if (dfs(i)) return true;
    }
    return false;
}

/**
 * After a horizontal bar move, keep each stage's working duration and align
 * finish-to-start links with the moved bar.
 */
export function reconcileDependenciesAfterMove<T extends ProgrammePhaseLink>(
    phases: readonly T[],
    movedIdx: number,
    daysPerWeek: number,
): T[] {
    if (movedIdx < 0 || movedIdx >= phases.length) return phases.map(p => ({ ...p }));
    const next = phases.map(p => ({ ...p }));
    const moved = next[movedIdx];
    const predIdx = normalizedDependsOn(moved.dependsOn, movedIdx, next.length)[0];
    if (predIdx !== undefined) {
        const minStart = predecessorEndOffset(next, predIdx, daysPerWeek);
        if (moved.startOffset < minStart) moved.startOffset = minStart;
    }
    for (let i = 0; i < next.length; i++) {
        if (i === movedIdx) continue;
        const deps = normalizedDependsOn(next[i].dependsOn, i, next.length);
        if (!deps.includes(movedIdx)) continue;
        const minStart = predecessorEndOffset(next, movedIdx, daysPerWeek);
        if (next[i].startOffset < minStart) next[i].startOffset = minStart;
    }
    return next;
}