import React from "react";
import { createRoot } from "react-dom/client";
import ProgrammeOverview from "../../src/components/programme-overview";
import { computeProgrammePlan } from "../../src/lib/programme-plan";
import { computeRelativeProgramme, programmeStageBar, type DisplayProgrammePlan } from "../../src/lib/relative-programme";

/**
 * The actual ProgrammeOverview with its actual bundled CSS module.
 *
 * Plans come from the existing builders with the same synthetic inputs as
 * the A060 SSR cases; bar values come from the existing programmeStageBar.
 * Nothing is calculated here, saved or sent.
 */
type Kind = "three-weeks" | "wednesday" | "relative";
interface Options { kind: Kind; dark: boolean }
interface Fixture {
    plan: DisplayProgrammePlan;
    bars: { leftPct: number; widthPct: number }[];
    unchanged: () => boolean;
}
declare global {
    interface Window { __programmeStyledOptions?: Options; __programmeStyledLocal: Fixture }
}

const INPUTS: Record<Kind, { start: string | null; phases: Record<string, unknown>[] }> = {
    "three-weeks": { start: "2026-10-19", phases: [
        { name: "Strip out", manualDays: 5, startOffset: 0 },
        { name: "Install", manualDays: 5, startOffset: 7 },
        { name: "Finish", manualDays: 5, startOffset: 14 },
    ] },
    wednesday: { start: "2026-10-21", phases: [{ name: "Fit out", manualDays: 5, startOffset: 0 }] },
    relative: { start: null, phases: [
        { name: "Prepare", timeBasis: "relative_working_days", workingDayOffset: 0, manualDays: 3 },
        { name: "Install", timeBasis: "relative_working_days", workingDayOffset: 3, manualDays: 5 },
    ] },
};

const options = window.__programmeStyledOptions ?? { kind: "three-weeks", dark: false };
const input = INPUTS[options.kind];
const inputBefore = JSON.stringify(input);
const plan: DisplayProgrammePlan | null = options.kind === "relative"
    ? computeRelativeProgramme(input.phases)
    : computeProgrammePlan(input.start, input.phases);
if (!plan) throw new Error(`No plan for the ${options.kind} fixture`);
const planBefore = JSON.stringify(plan);

window.__programmeStyledLocal = {
    plan,
    bars: plan.stages.map((_, index) => programmeStageBar(plan, index, 0)),
    unchanged: () => JSON.stringify(input) === inputBefore && JSON.stringify(plan) === planBefore,
};
createRoot(document.getElementById("app")!).render(<ProgrammeOverview plan={plan} isDark={options.dark} />);
