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

type Rig = ReturnType<typeof cohortRig> & { delayMs: number };
const store = globalThis as unknown as { __constructaCaseStudyFixture?: Record<string, Rig> };

function guard() {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") notFound();
}

function rigFor(run: string): Rig {
    store.__constructaCaseStudyFixture ??= {};
    store.__constructaCaseStudyFixture[run] ??= { ...cohortRig({ enabled: !run.startsWith("off-") }), delayMs: 0 };
    return store.__constructaCaseStudyFixture[run];
}

export async function fixtureEnhance(run: string, whatWeDelivered: string, valueAdded: string, projectName: string, projectType: string) {
    guard();
    const rig = rigFor(run);
    // Lets the spec act while a request is on its way.
    if (rig.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, rig.delayMs));
    return enhanceCaseStudy(rig.context, { whatWeDelivered, valueAdded, projectName, projectType });
}

/** What the spec reads back, and how it sets the next canned reply, a delay or a used-up allowance. */
export async function fixtureCaseStudyControl(run: string, op: { reply?: Canned; delayMs?: number; allowance?: "used-up" | "normal" }) {
    guard();
    const rig = rigFor(run);
    if (op.reply) rig.canned(op.reply);
    if (typeof op.delayMs === "number") rig.delayMs = op.delayMs;
    if (op.allowance) rig.budget.limits.contractor.perHour = op.allowance === "used-up" ? 0 : 6;
    return {
        providerCalls: rig.sent.length,
        sent: rig.sent.map((request) => JSON.parse(request.user) as Record<string, string>),
        attempts: rig.budget.attempts.map((attempt) => attempt.outcome),
        charged: rig.budget.charged(),
        budgetCalls: rig.budget.rpcCalls.length,
    };
}
