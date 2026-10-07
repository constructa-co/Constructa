import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { wordingRig } from "./__fixtures__/wording-rig";
import { aiWordingOffered } from "./ai-availability";
import { rewordDraft } from "./ai-wording";
import { approve, buildDraft, loadInterview, saveAnswer } from "./service";

const BASE = { work: "Kitchen and bathroom fitting", business_started: "2017", area: "Leeds", memberships: "Gas Safe registered" };
const FAITHFUL = "Smith Builders fits kitchens and bathrooms in Leeds. The business has been trading since 2017.";

async function ready(options: Parameters<typeof wordingRig>[0] = {}) {
    const rig = wordingRig(options);
    await rig.answers(BASE);
    return rig;
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    vi.unstubAllEnvs();
});

describe("rewordDraft", () => {
    it("reserves, calls once, judges, records, then saves the AI draft tied to its attempt and its sources", async () => {
        const rig = await ready();
        rig.reply({ text: FAITHFUL });
        const result = await rewordDraft(rig.context);

        expect(result).toMatchObject({ ok: true, wording: "ai" });
        expect(result.ok && result.state.draft).toMatchObject({ generator: "ai", text: FAITHFUL, status: "draft", stale: false });
        const names = [...rig.budget.rpcCalls.map((call) => call.name), ...rig.db.rpcCalls.filter((call) => call.name === "company_narrative_save_draft").map((call) => call.name)];
        expect(names).toEqual(["ai_generation_reserve", "ai_generation_finish", "company_narrative_save_draft"]);
        expect(rig.providerCalls).toHaveLength(1);

        const attempt = rig.budget.attempts[0];
        const draft = rig.currentDraft()!;
        expect(attempt).toMatchObject({ feature: "company.introduction", outcome: "ok", completion_tokens: 120, prompt_tokens: 400, model: "canned-model", prompt_version: "intro-ai-v1" });
        expect(draft).toMatchObject({ generator: "ai", ai_attempt_id: attempt.id, model: "canned-model", generator_version: "intro-ai-v1", answers_fingerprint: attempt.source_fingerprint });
        // The facts on offer are still the contractor's own words, built by rule, not by the model.
        expect((draft.facts as Array<Record<string, unknown>>).map((fact) => [fact.field, fact.proposed])).toEqual([["years_trading", "9"], ["accreditations", "Gas Safe registered"]]);
        expect(rig.db.profileWrites).toEqual([]);
    });

    it("the attempt is recorded before the draft is saved, and never touched again", async () => {
        const rig = await ready();
        rig.reply({ text: FAITHFUL });
        let finishedWhenSaving: unknown = "not reached";
        rig.db.beforeNext("company_narrative_save_draft", () => { finishedWhenSaving = rig.budget.attempts[0].outcome; });
        await rewordDraft(rig.context);
        expect(finishedWhenSaving).toBe("ok");
        expect(rig.budget.calls("ai_generation_finish")).toHaveLength(1);
    });

    it("checks the sources twice: before the attempt is recorded, and again in the database when saving", async () => {
        // Moved during the call: caught by the service's own re-read, recorded as sources-moved.
        const during = await ready();
        during.reply({ text: FAITHFUL, during: () => during.answer("area", "Bradford") });
        expect(await rewordDraft(during.context)).toMatchObject({ ok: true, wording: "sources-moved" });
        expect(during.budget.attempts.map((attempt) => attempt.outcome)).toEqual(["sources-moved"]);
        expect(during.db.rpcCalls.filter((call) => call.name === "company_narrative_save_draft" && call.args.p_generator === "ai")).toEqual([]);

        // Moved after the attempt was recorded: the service's check passed; the database refuses the save.
        const after = await ready();
        after.reply({ text: FAITHFUL });
        after.db.beforeNext("company_narrative_save_draft", () => after.answer("area", "Bradford"));
        expect(await rewordDraft(after.context)).toMatchObject({ ok: true, wording: "sources-moved" });
        const aiSaves = after.db.rpcCalls.filter((call) => call.name === "company_narrative_save_draft" && call.args.p_generator === "ai");
        expect(aiSaves).toHaveLength(1);
        // The attempt stays what it truthfully was: a valid reply, paid for, attached to nothing.
        expect(after.budget.attempts[0]).toMatchObject({ outcome: "ok", completion_tokens: 120 });
        expect(after.drafts().filter((row) => row.generator === "ai")).toEqual([]);
        for (const rig of [during, after]) {
            expect(rig.currentDraft()).toMatchObject({ generator: "template", ai_attempt_id: null });
            expect(String(rig.currentDraft()!.draft_text)).toContain("We cover Bradford.");
            expect(rig.providerCalls).toHaveLength(1);
        }
    });

    it("never retries: a rejected, failed or stale reply costs one call and gives the plain draft", async () => {
        for (const reply of [{ text: "Smith Builders is an award-winning fitter." }, { error: true as const }, { invalid: true as const, usage: null }]) {
            const rig = await ready();
            rig.reply(reply);
            const result = await rewordDraft(rig.context);
            expect(result.ok && result.state.draft?.generator).toBe("template");
            expect(rig.providerCalls).toHaveLength(1);
            expect(rig.budget.attempts).toHaveLength(1);
        }
    });

    it("makes no call while AI wording is switched off, which is how it ships", async () => {
        const rig = await ready({ enabled: false });
        const result = await rewordDraft(rig.context);
        expect(result).toMatchObject({ ok: true, wording: "off" });
        expect(result.ok && result.state.draft?.generator).toBe("template");
        expect(rig.providerCalls).toEqual([]);
        expect(rig.budget.attempts).toEqual([]);
    });

    it("the emergency stop makes no call and consults no budget", async () => {
        vi.stubEnv("CONSTRUCTA_AI_DISABLED", "1");
        const rig = await ready();
        expect(await rewordDraft(rig.context)).toMatchObject({ ok: true, wording: "off" });
        expect(rig.budget.rpcCalls).toEqual([]);
        expect(rig.providerCalls).toEqual([]);
    });

    it("lets one of two simultaneous presses reach the provider; the other gets the plain draft", async () => {
        const rig = await ready();
        rig.reply({ text: FAITHFUL });
        const results = await Promise.all([rewordDraft(rig.context), rewordDraft(rig.context)]);
        expect(results.map((result) => result.wording).sort()).toEqual(["ai", "busy"]);
        expect(rig.providerCalls).toHaveLength(1);
    });

    it("shares the allowance with the profile rewrite buttons", async () => {
        const rig = await ready();
        for (let press = 0; press < 6; press += 1) {
            const claim = await rig.admin.rpc("ai_generation_reserve", { p_user_id: rig.context.userId, p_feature: "profile.rewrite", p_reserve_output_tokens: 700, p_source_fingerprint: null });
            await rig.admin.rpc("ai_generation_finish", { p_user_id: rig.context.userId, p_attempt_id: (claim.data as { attempt_id: string }).attempt_id, p_outcome: "error", p_prompt_tokens: null, p_completion_tokens: null, p_model: null, p_prompt_version: null });
        }
        expect(await rewordDraft(rig.context)).toMatchObject({ ok: true, wording: "used-up" });
        expect(rig.providerCalls).toEqual([]);
    });

    it("acts only for the contractor it was given, in every privileged call", async () => {
        const rig = await ready();
        rig.reply({ text: FAITHFUL });
        await rewordDraft({ ...rig.context, ...({ p_user_id: "someone-else" } as object) });
        const all = [...rig.budget.rpcCalls, ...rig.db.rpcCalls];
        expect(new Set(all.map((call) => call.args.p_user_id))).toEqual(new Set([rig.context.userId]));
    });

    it("reads only answers, drafts and the saved profile: never a website suggestion", async () => {
        const rig = await ready();
        rig.reply({ text: FAITHFUL });
        await rewordDraft(rig.context);
        expect(new Set(rig.db.reads)).toEqual(new Set(["profiles", "company_interview_answers", "company_narrative_drafts"]));
        expect(rig.providerCalls[0].user).not.toContain("Evil Website");
    });
});

describe("everything else never reaches the provider", () => {
    it("loading, resuming, saving an answer, rebuilding and approving make no provider call and reserve nothing", async () => {
        const rig = await ready();
        rig.reply({ text: FAITHFUL });
        await rewordDraft(rig.context);
        const calls = rig.providerCalls.length;
        const reserved = rig.budget.attempts.length;

        await loadInterview(rig.context);
        await saveAnswer(rig.context, { key: "customers", answer: "Homeowners", skipped: false, expectedRevision: 0 });
        await loadInterview(rig.context);                       // resume: the draft is now stale
        const rebuilt = await buildDraft(rig.context);          // rebuild after a change
        expect(rebuilt.ok && rebuilt.state.draft).toMatchObject({ generator: "template", stale: false });
        await saveAnswer(rig.context, { key: "customers", answer: "Homeowners and landlords", skipped: false, expectedRevision: 1 });
        const stale = rebuilt.ok ? rebuilt.state.draft! : null;
        // Approving a stale draft makes the service rebuild. That rebuild is plain too.
        const approval = await approve(rig.context, { draftId: stale!.id, target: "introduction", text: stale!.text, expectedExisting: null });
        expect(!approval.ok && approval.state?.draft?.generator).toBe("template");
        const fresh = !approval.ok ? approval.state!.draft! : null;
        await approve(rig.context, { draftId: fresh!.id, target: "introduction", text: fresh!.text, expectedExisting: null });
        await approve(rig.context, { draftId: fresh!.id, target: "accreditations", text: null, expectedExisting: null });

        expect(rig.providerCalls.length).toBe(calls);
        expect(rig.budget.attempts.length).toBe(reserved);
        expect(rig.profile()).toMatchObject({ capability_statement: fresh!.text, accreditations: "Gas Safe registered" });
    });

    const root = path.resolve(__dirname, "../..");
    const sources = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return name === "node_modules" || name === "admin-e2e-import-fixture" ? [] : sources(full);
        return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });
    const relative = (file: string) => path.relative(root, file);
    const importsOf = (pattern: RegExp) => sources(root).filter((file) => pattern.test(readFileSync(file, "utf8"))).map(relative).sort();

    it("the provider-reachable module is imported by exactly one application file: the interview's actions", () => {
        // The rig is test equipment (unit tests, evaluation, browser fixture); the eval runner uses the rig.
        expect(importsOf(/company-interview\/ai-wording"|from "\.\.?\/ai-wording"/)).toEqual([
            "app/dashboard/settings/profile/interview/actions.ts",
            "app/dashboard/settings/profile/interview/interview-client.tsx", // types only, checked below
            "lib/company-interview/__fixtures__/wording-rig.ts",
            "lib/company-interview/eval/run.ts",
        ]);
        const client = readFileSync(path.join(root, "app/dashboard/settings/profile/interview/interview-client.tsx"), "utf8");
        expect(client).toContain('import type { PlainReason, WordingResult } from "@/lib/company-interview/ai-wording"');
        expect(client.match(/ai-wording/g)).toHaveLength(1);
        const rig = readFileSync(path.join(root, "lib/company-interview/__fixtures__/wording-rig.ts"), "utf8");
        expect(rig).toContain('import type { WordingContext } from "../ai-wording"');
    });

    it("only one action calls it, and the page, the service and the other actions cannot", () => {
        const actions = readFileSync(path.join(root, "app/dashboard/settings/profile/interview/actions.ts"), "utf8");
        expect(actions.match(/rewordDraft\(/g)).toHaveLength(1);
        expect(actions).toMatch(/export async function rewordInterviewDraftAction\(\)[^{]*\{\s*try \{\s*return await rewordDraft\(/);
        for (const file of [
            "app/dashboard/settings/profile/interview/page.tsx",
            "lib/company-interview/service.ts",
            "lib/company-interview/template.ts",
            "lib/company-interview/questions.ts",
            "lib/company-interview/ai-availability.ts",
            "lib/company-interview/ai-draft.ts",
            "lib/company-interview/guard.ts",
        ]) {
            expect(readFileSync(path.join(root, file), "utf8"), file).not.toMatch(/from "[^"]*(ai-wording|ai-budget)"|withAiBudget\(|rewordDraft\(|generateStructured\(|generateText\(|generateJSON\(|from "@\/lib\/ai"/);
        }
    });

    it("the wording module reaches the provider only through the budget wrapper", () => {
        const source = readFileSync(path.join(root, "lib/company-interview/ai-wording.ts"), "utf8");
        expect(source.match(/withAiBudget\(/g)).toHaveLength(1);
        expect(source).toMatch(/import type \{[^}]*\} from "@\/lib\/ai"/);
        expect(source).not.toMatch(/import \{[^}]*\} from "@\/lib\/ai"|generateStructured\(|process\.env/);
    });

    it("the AI step sits outside the plain draft's retry loop", () => {
        const service = readFileSync(path.join(root, "lib/company-interview/service.ts"), "utf8");
        const loop = service.slice(service.indexOf("for (let attempt = 1; attempt <= DRAFT_ATTEMPTS"), service.indexOf("return { ok: false, error: INTERVIEW_SOURCES_MOVING }"));
        expect(loop.length).toBeGreaterThan(200);
        expect(loop).toContain('p_generator: "template"');
        expect(loop).toContain("p_ai_attempt_id: null");
        expect(loop).not.toMatch(/withAiBudget|rewordDraft|"ai"/);
    });
});

describe("aiWordingOffered", () => {
    it("is false as shipped, true only when the database row says so, and reads nothing else", async () => {
        const off = wordingRig({ enabled: false });
        expect(await aiWordingOffered(off.admin as never)).toBe(false);
        const on = wordingRig({ enabled: true });
        expect(await aiWordingOffered(on.admin as never)).toBe(true);
        expect(on.budget.rpcCalls).toEqual([]);
        expect(on.providerCalls).toEqual([]);
    });

    it("is false under the emergency stop, on an error, and whatever else the environment says", async () => {
        const on = wordingRig({ enabled: true });
        vi.stubEnv("CONSTRUCTA_AI_DISABLED", "1");
        expect(await aiWordingOffered(on.admin as never)).toBe(false);
        vi.unstubAllEnvs();
        for (const name of ["CONSTRUCTA_AI_ENABLED", "CONSTRUCTA_INTERVIEW_AI", "ENABLE_AI"]) vi.stubEnv(name, "1");
        expect(await aiWordingOffered(wordingRig({ enabled: false }).admin as never)).toBe(false);
        expect(await aiWordingOffered({ from: () => { throw new Error("down"); } } as never)).toBe(false);
        expect(await aiWordingOffered({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: "x" } }) }) }) }) } as never)).toBe(false);
        const source = readFileSync(path.resolve(__dirname, "ai-availability.ts"), "utf8");
        expect(source.match(/process\.env\.\w+/g)).toEqual(["process.env.CONSTRUCTA_AI_DISABLED"]);
    });
});
