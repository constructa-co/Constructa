"use server";

/**
 * Fixture harness for the case-study wording suggestion. TEST ONLY.
 *
 * Like the harnesses beside it, these files are copied into the app only for
 * a fixture browser run and removed afterwards, and every entry point refuses
 * to work unless CONSTRUCTA_IMPORT_FIXTURE is "1".
 *
 * The real feature code and the real budget wrapper run behind the real
 * screen, over an in-memory budget. The "provider" is a canned generator
 * that returns what the spec hands it. No network, no Supabase, no model,
 * and nothing here says anything about what a real model would write.
 *
 * The feature is ON here so the screen can be shown, unless the run's name
 * starts with "off-", which is how the application ships it. Nothing in this
 * folder can change the application's own setting.
 */

import { notFound } from "next/navigation";
import { cohortRig, type Canned } from "@/lib/cohort-ai/__fixtures__/rig";
import { enhanceCaseStudy } from "@/lib/cohort-ai/case-study-enhance";
import { SAVE_MESSAGES, type SaveCaseStudiesResult } from "@/app/dashboard/settings/case-studies/save-state";

/**
 * The save, for the fixture: an in-memory list per run, with the outcomes the
 * real action can return. It stands in for the action and the database; the
 * real action is covered by unit tests, not here. `written-unknown` stores
 * the list and then answers "not known", as a lost reply would.
 */
type SaveMode = "ok" | "no-row" | "signed-out" | "unknown" | "written-unknown";
interface Saves { stored: unknown[]; calls: unknown[][]; mode: SaveMode; delayMs: number }
type Rig = ReturnType<typeof cohortRig> & { delayMs: number; saves: Saves };

const FIRST = {
    id: "fixture-case-study",
    projectName: "Kitchen at Example Road",
    projectType: "Refurbishment",
    contractValue: "",
    programmeDuration: "",
    client: "",
    location: "",
    whatWeDelivered: "we refitted the kitchen moved the wall and replastered throughout",
    valueAdded: "family could stay in the house the whole time",
    photos: ["", "", ""],
    // A key the editor does not know about, as an older stored entry might have. It must survive every save.
    legacyNote: "kept exactly",
};
const store = globalThis as unknown as { __constructaCaseStudyFixture?: Record<string, Rig> };

function guard() {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") notFound();
}

function rigFor(run: string): Rig {
    store.__constructaCaseStudyFixture ??= {};
    store.__constructaCaseStudyFixture[run] ??= { ...cohortRig({ enabled: !run.startsWith("off-") }), delayMs: 0, saves: { stored: [structuredClone(FIRST)], calls: [], mode: "ok", delayMs: 0 } };
    return store.__constructaCaseStudyFixture[run];
}

export async function fixtureEnhance(run: string, whatWeDelivered: string, valueAdded: string, projectName: string, projectType: string) {
    guard();
    const rig = rigFor(run);
    // Lets the spec act while a request is on its way.
    if (rig.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, rig.delayMs));
    return enhanceCaseStudy(rig.context, { whatWeDelivered, valueAdded, projectName, projectType });
}

/** What the page loads: the list as this run has it stored. */
export async function fixtureCaseStudies(run: string): Promise<unknown[]> {
    guard();
    return structuredClone(rigFor(run).saves.stored);
}

export async function fixtureSaveCaseStudies(run: string, caseStudies: unknown): Promise<SaveCaseStudiesResult> {
    guard();
    const { saves } = rigFor(run);
    // The mode is read when the request arrives; the delay lets the spec type while it is on its way.
    const mode = saves.mode;
    saves.mode = "ok";
    if (saves.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, saves.delayMs));
    if (mode === "signed-out") return { status: "signed-out", message: SAVE_MESSAGES.signedOut };
    if (!Array.isArray(caseStudies)) return { status: "refused", message: SAVE_MESSAGES.refused };
    saves.calls.push(structuredClone(caseStudies));
    if (mode === "no-row") return { status: "no-row", message: SAVE_MESSAGES.noRow };
    if (mode === "unknown") return { status: "unknown", message: SAVE_MESSAGES.unknown };
    saves.stored = structuredClone(caseStudies);
    if (mode === "written-unknown") return { status: "unknown", message: SAVE_MESSAGES.unknown };
    return { status: "saved", refreshed: true };
}

/** What the spec reads back, and how it sets the next canned reply, a delay or a used-up allowance. */
export async function fixtureCaseStudyControl(run: string, op: { reply?: Canned; delayMs?: number; allowance?: "used-up" | "normal"; saveMode?: SaveMode; saveDelayMs?: number; storeElsewhere?: unknown[] }) {
    guard();
    const rig = rigFor(run);
    if (op.saveMode) rig.saves.mode = op.saveMode;
    if (typeof op.saveDelayMs === "number") rig.saves.delayMs = op.saveDelayMs;
    // Something saved "in another tab".
    if (Array.isArray(op.storeElsewhere)) rig.saves.stored = structuredClone(op.storeElsewhere);
    if (op.reply) rig.canned(op.reply);
    if (typeof op.delayMs === "number") rig.delayMs = op.delayMs;
    if (op.allowance) rig.budget.limits.contractor.perHour = op.allowance === "used-up" ? 0 : 6;
    return {
        providerCalls: rig.sent.length,
        sent: rig.sent.map((request) => JSON.parse(request.user) as Record<string, string>),
        attempts: rig.budget.attempts.map((attempt) => attempt.outcome),
        charged: rig.budget.charged(),
        budgetCalls: rig.budget.rpcCalls.length,
        stored: rig.saves.stored,
        saveCalls: rig.saves.calls.length,
        lastSent: rig.saves.calls.at(-1) ?? null,
    };
}
