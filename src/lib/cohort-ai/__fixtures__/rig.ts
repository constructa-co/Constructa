/**
 * A canned provider and a synthetic budget for the cohort AI features. No
 * network, no key, no cost. The real budget wrapper runs against the
 * in-memory budget, so what a test sees recorded is what would be recorded.
 */

import { AiResponseError, type GenerateStructuredOptions } from "@/lib/ai";
import { fakeAiBudget } from "@/lib/__fixtures__/fake-ai-budget";
import type { CohortAiContext } from "../shared";

export type Canned = { reply: unknown } | { fail: "network" | "not-json" | "wrong-shape" };

export function cohortRig(options: { enabled?: boolean; userId?: string } = {}) {
    const budget = fakeAiBudget({ cohortEnabled: options.enabled ?? true });
    const sent: Array<{ feature: string; system: string; user: string; maxOutputTokens: number; timeoutMs: number }> = [];
    let next: Canned = { reply: {} };

    const generate = (async (request: GenerateStructuredOptions<never>) => {
        sent.push({ feature: request.feature, system: request.system, user: request.user, maxOutputTokens: request.maxOutputTokens, timeoutMs: request.timeoutMs });
        if ("fail" in next) {
            if (next.fail === "network") throw new Error("socket hang up");
            throw new AiResponseError(request.feature, next.fail, "canned", { promptTokens: 40, completionTokens: 25 });
        }
        const parsed = (request.schema as { safeParse: (value: unknown) => { success: boolean; data?: unknown } }).safeParse(next.reply);
        if (!parsed.success) throw new AiResponseError(request.feature, "wrong-shape", "canned", { promptTokens: 40, completionTokens: 25 });
        return { data: parsed.data, model: "canned", usage: { promptTokens: 40, completionTokens: 30 } };
    }) as unknown as NonNullable<CohortAiContext["generate"]>;

    const context: CohortAiContext = { admin: budget.admin, userId: options.userId ?? "user-1", generate };
    return {
        budget,
        context,
        sent,
        /** What the provider will say next. */
        canned: (value: Canned) => { next = value; },
    };
}
