/**
 * Runs the canned cases through the real feature code and the real budget
 * wrapper, over an in-memory budget and a canned generator. No provider, no
 * network, no database. The report it renders has no timestamp, so it is the
 * same every time.
 */

import { cohortRig } from "../__fixtures__/rig";
import { suggestBrief, type BriefInput } from "../brief-suggest";
import { enhanceCaseStudy, type CaseStudyInput } from "../case-study-enhance";
import { writeProgrammeUpdate, type ProgrammeInput } from "../programme-update";
import { suggestWording } from "../proposal-wording";
import { EVAL_CASES, type EvalCase } from "./cases";

export interface EvalOutcome {
    id: string;
    feature: EvalCase["feature"];
    what: string;
    kind: EvalCase["kind"];
    /** Did the contractor get a suggestion to look at? */
    shown: boolean;
    message: string | null;
    attempt: string | null;
    charged: number | null;
    providerCalls: number;
    /** A faithful reply the checks refused. */
    falseRejection: boolean;
    /** An unfaithful reply the checks let through to the contractor. */
    knownMiss: boolean;
}

const REPORT_DATE = new Date("2026-10-08T09:00:00Z");

export async function runCase(testCase: EvalCase): Promise<EvalOutcome> {
    const rig = cohortRig();
    rig.canned(testCase.canned);
    let shown = false;
    let message: string | null = null;

    if (testCase.feature === "brief.suggest") {
        const result = await suggestBrief(rig.context, testCase.input as unknown as BriefInput);
        shown = result.ok;
        message = result.ok ? null : result.error;
    } else if (testCase.feature === "proposal.wording") {
        const result = await suggestWording(rig.context, testCase.input.field, testCase.input.text);
        shown = result.ok;
        message = result.ok ? null : result.error;
    } else if (testCase.feature === "case-studies.enhance") {
        const result = await enhanceCaseStudy(rig.context, testCase.input as unknown as CaseStudyInput);
        shown = result.suggested;
        message = result.message ?? null;
    } else {
        const result = await writeProgrammeUpdate(rig.context, { ...(testCase.input as unknown as ProgrammeInput), today: REPORT_DATE });
        shown = result.ok;
        message = result.ok ? null : result.error;
    }

    const attempt = rig.budget.attempts.at(-1) ?? null;
    return {
        id: testCase.id,
        feature: testCase.feature,
        what: testCase.what,
        kind: testCase.kind,
        shown,
        message,
        attempt: attempt ? String(attempt.outcome) : null,
        charged: attempt ? rig.budget.charged().at(-1) ?? null : null,
        providerCalls: rig.sent.length,
        falseRejection: testCase.kind === "faithful" && !shown,
        knownMiss: testCase.kind === "unfaithful" && shown,
    };
}

export async function runEvaluation(): Promise<EvalOutcome[]> {
    const outcomes: EvalOutcome[] = [];
    for (const testCase of EVAL_CASES) outcomes.push(await runCase(testCase));
    return outcomes;
}

export function renderReport(outcomes: EvalOutcome[]): string {
    const count = (test: (entry: EvalOutcome) => boolean) => outcomes.filter(test).length;
    const unfaithful = count((entry) => entry.kind === "unfaithful");
    const faithful = count((entry) => entry.kind === "faithful");
    const lines = [
        "# Cohort AI text features: canned evaluation",
        "",
        "Produced by `npm run eval:cohort-ai`. Every reply below was written by hand to stand in for a provider.",
        "It is not evidence about what a real model writes, how often it is wrong, or what it costs.",
        "Provider calls made by a real provider: 0.",
        "",
        "What it does show: for these replies, which ones the checks stop and which they let through to the contractor,",
        "who then reads the suggestion and decides whether to use it. The checks look for added figures, names and claim",
        "words. They do not understand meaning.",
        "",
        `- Cases: ${outcomes.length}`,
        `- Faithful replies: ${faithful}, of which refused (false rejections): ${count((entry) => entry.falseRejection)}`,
        `- Unfaithful replies: ${unfaithful}, of which stopped: ${unfaithful - count((entry) => entry.knownMiss)}, let through (known misses): ${count((entry) => entry.knownMiss)}`,
        `- Provider failures: ${count((entry) => entry.kind === "no reply")}, all refused with nothing shown`,
        "",
        "## Known misses: unfaithful replies the checks let through",
        "",
        ...outcomes.filter((entry) => entry.knownMiss).map((entry) => `- \`${entry.id}\` (${entry.feature}): ${entry.what}`),
        "",
        "## False rejections: faithful replies the checks refused",
        "",
        ...outcomes.filter((entry) => entry.falseRejection).map((entry) => `- \`${entry.id}\` (${entry.feature}): ${entry.what}`),
        "",
        "## Every case",
        "",
        "| Case | Feature | Canned reply | Kind | Shown to contractor | Recorded as | Charged (output tokens) | Calls |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ...outcomes.map((entry) => `| \`${entry.id}\` | ${entry.feature} | ${entry.what} | ${entry.kind} | ${entry.shown ? "yes" : "no"} | ${entry.attempt ?? "none"} | ${entry.charged ?? "none"} | ${entry.providerCalls} |`),
        "",
    ];
    return `${lines.join("\n")}`;
}
