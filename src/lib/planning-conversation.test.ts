import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
    PLANNING_CHANGED, PLANNING_FAILED, PLANNING_NO_CONTEXT, PLANNING_NOT_USABLE, PLANNING_OFF, PLANNING_OPEN_WORK, PLANNING_STOPPED, PLANNING_TURN_LIMIT,
    buildPlanningContext, createPlanningConversation, reviewPlanningReply, type PlanningGenerator, type PlanningProjectFields,
} from "./planning-conversation";

const DATED: PlanningProjectFields = {
    id: "job-a", name: "Rear extension", client_name: "Ms Patel", start_date: "2026-11-02",
    programme_phases: [{ name: "Groundworks", manualDays: 10, startOffset: 0 }, { name: "Kitchen fit", manualDays: 5, startOffset: 14 }],
};
const RELATIVE: PlanningProjectFields = {
    id: "job-b", name: "Loft conversion", start_date: null,
    programme_phases: [
        { name: "Strip out", timeBasis: "relative_working_days", manualDays: 5, workingDayOffset: 0 },
        { name: "Dormer", timeBasis: "relative_working_days", manualDays: 15, workingDayOffset: 5 },
    ],
};
const reply = (over: Record<string, unknown> = {}) => ({ message: "Let's plan the kitchen order around Kitchen fit.", questions: [], suggestions: [], ...over });
const deferred = <T,>() => { let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function setup(generate?: PlanningGenerator, project: PlanningProjectFields = DATED) {
    const source = { project, hasOpenWork: false };
    const read = vi.fn(() => source);
    return { source, read, session: createPlanningConversation(read, generate) };
}
async function say(session: ReturnType<typeof setup>["session"], text: string) { session.setMessage(text); return session.send(); }

describe("planning context comes from the selected job's saved programme only", () => {
    it("grounds a dated job in its saved stages and dates", () => {
        const context = buildPlanningContext(DATED)!;
        expect(context).toMatchObject({ job: { id: "job-a", name: "Rear extension", client: "Ms Patel" }, basis: "dated" });
        expect(context.stages.map(stage => stage.name)).toEqual(["Groundworks", "Kitchen fit"]);
        expect(context.start).toMatch(/2 Nov/);
        expect(context.stages[1].from).toMatch(/16 Nov/);
    });
    it("keeps a relative programme in working days, with no invented dates", () => {
        const context = buildPlanningContext(RELATIVE)!;
        expect(context).toMatchObject({ basis: "relative", start: null, finish: null });
        expect(context.stages[1]).toMatchObject({ name: "Dormer", from: "Day 6", to: "Day 20" });
    });
    it("handles a job with no programme yet and refuses an unreadable one", () => {
        expect(buildPlanningContext({ id: "job-c", name: "New", programme_phases: null })).toMatchObject({ basis: "none", stages: [] });
        expect(buildPlanningContext({ ...DATED, programme_phases: "broken" as unknown as unknown[] })).toBeNull();
        expect(buildPlanningContext({ ...DATED, programme_working_pattern: { weekdays: [] } })).toBeNull();
    });
});

describe("transport is honestly off without an authorised adapter", () => {
    it("never reads the job or sends anything when no generator is supplied", async () => {
        const { session, read } = setup(undefined);
        expect(session.getSnapshot()).toMatchObject({ available: false, status: "off", error: PLANNING_OFF });
        session.setMessage("When should the windows be ordered?");
        expect(await session.send()).toBe("off");
        expect(read).not.toHaveBeenCalled();
        expect(session.getSnapshot().message).toBe("");
    });
});

describe("multi-turn conversation", () => {
    it("carries earlier turns and open questions into the follow-up, with the same job context", async () => {
        const generate = vi.fn<PlanningGenerator>()
            .mockResolvedValueOnce(reply({ questions: ["Has the client chosen the kitchen units?"] }))
            .mockResolvedValueOnce(reply({ message: "Then the order can follow the client's choice.", suggestions: [{ topic: "client-decision", title: "Client to confirm kitchen units", stage: "kitchen fit", timing: "by the end of groundworks" }] }));
        const { session } = setup(generate);
        expect(await say(session, "The client hasn't picked a kitchen yet.")).toBe("reply");
        expect(await say(session, "They said they'd decide by the end of groundworks.")).toBe("reply");
        const second = generate.mock.calls[1][0];
        expect(second.context.job.id).toBe("job-a");
        expect(second.messages.map(item => item.role)).toEqual(["user", "assistant", "user"]);
        expect(second.messages[1].content).toContain("Has the client chosen the kitchen units?");
        const state = session.getSnapshot();
        expect(state.messages).toHaveLength(4);
        expect(state.messages[3]).toMatchObject({ role: "assistant", suggestions: [{ topic: "client-decision", stage: "Kitchen fit", timing: "by the end of groundworks" }] });
        expect(state.message).toBe("");
    });

    it("does not let a generator mutate the stored job context or transcript", async () => {
        const seen: number[] = [];
        const generate = vi.fn<PlanningGenerator>(async ({ context, messages }) => {
            seen.push(context.stages.length, messages.length);
            context.stages.length = 0; messages.length = 0; return reply();
        });
        const { session } = setup(generate);
        await say(session, "First question");
        await say(session, "Second question");
        expect(seen).toEqual([2, 1, 2, 3]);
        expect(session.getSnapshot().messages).toHaveLength(4);
    });
});

describe("unknown dates and lead times stay questions", () => {
    const context = buildPlanningContext(DATED)!;
    it("keeps timing only when the contractor said it, and asks otherwise", () => {
        const result = reviewPlanningReply(context, ["Windows take 6 weeks from order."], {
            message: "Order windows early.",
            suggestions: [
                { topic: "procurement", title: "Order windows", stage: "Groundworks", timing: "6 weeks" },
                { topic: "procurement", title: "Order roof lights", stage: null, timing: "4 weeks" },
                { topic: "procurement", title: "Order kitchen", stage: null, timing: null },
            ],
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.suggestions.map(item => item.timing)).toEqual(["6 weeks", null, null]);
        expect(result.value.questions).toEqual([
            expect.stringContaining("Order roof lights"),
            expect.stringContaining("Order kitchen"),
        ]);
    });
    it("drops a reply that invents a date, lead time or amount, or names another stage", () => {
        const said = ["When do I need the steel?"];
        expect(reviewPlanningReply(context, said, reply({ message: "Order the steel by 27 Nov." })).ok).toBe(false);
        expect(reviewPlanningReply(context, said, reply({ message: "Steel usually takes 5 weeks." })).ok).toBe(false);
        expect(reviewPlanningReply(context, said, reply({ message: "Budget about £4,000 for steel." })).ok).toBe(false);
        expect(reviewPlanningReply(context, said, reply({ suggestions: [{ topic: "milestone", title: "Steel in", stage: "Roofing", timing: null }] })).ok).toBe(false);
        expect(reviewPlanningReply(context, said, { message: "ok", extra: true }).ok).toBe(false);
        expect(reviewPlanningReply(context, said, "free text").ok).toBe(false);
    });
    it("accepts dates already in the saved programme", () => {
        expect(reviewPlanningReply(context, [], reply({ message: `Kitchen fit starts ${context.stages[1].from}.` })).ok).toBe(true);
    });
    it("keeps a relative date in the contractor's own words on a relative programme", () => {
        const relative = buildPlanningContext(RELATIVE)!;
        const ok = reviewPlanningReply(relative, ["Client decides on the dormer finish next Friday."], reply({
            message: "Note the dormer finish decision.", suggestions: [{ topic: "client-decision", title: "Dormer finish", stage: "Dormer", timing: "next Friday" }],
        }));
        expect(ok.ok && ok.value.suggestions[0].timing).toBe("next Friday");
        expect(reviewPlanningReply(relative, ["Client decides next Friday."], reply({ message: "That is 2026-11-13." })).ok).toBe(false);
    });
});

describe("failure, refusal, cancellation and retry", () => {
    it("reports a failed transport and retries the same message", async () => {
        const generate = vi.fn<PlanningGenerator>().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(reply());
        const { session } = setup(generate);
        expect(await say(session, "Plan the scaffold")).toBe("failed");
        expect(session.getSnapshot()).toMatchObject({ status: "error", error: PLANNING_FAILED, canRetry: true, messages: [] });
        session.setMessage("");
        expect(await session.retry()).toBe("reply");
        expect(generate.mock.calls[1][0].messages).toEqual([{ role: "user", content: "Plan the scaffold" }]);
        expect(session.getSnapshot().canRetry).toBe(false);
    });
    it("drops an unusable reply and allows retry", async () => {
        const { session } = setup(vi.fn<PlanningGenerator>().mockResolvedValue({ refused: true }));
        expect(await say(session, "Plan it")).toBe("rejected");
        expect(session.getSnapshot()).toMatchObject({ error: PLANNING_NOT_USABLE, canRetry: true, messages: [] });
    });
    it("stops waiting and ignores a late reply", async () => {
        const late = deferred<unknown>();
        const generate = vi.fn<PlanningGenerator>(() => late.promise);
        const { session } = setup(generate);
        const outcome = say(session, "Plan the scaffold");
        expect(session.getSnapshot().status).toBe("pending");
        expect(await say(session, "Another")).toBe("busy");
        session.cancel();
        expect(generate.mock.calls[0][0].signal.aborted).toBe(true);
        late.resolve(reply());
        expect(await outcome).toBe("cancelled");
        expect(session.getSnapshot()).toMatchObject({ status: "idle", messages: [], notice: PLANNING_STOPPED });
        expect(generate).toHaveBeenCalledTimes(1);
    });
    it("ignores a reply that settles after the page unmounts", async () => {
        const late = deferred<unknown>();
        const { session } = setup(vi.fn<PlanningGenerator>(() => late.promise));
        const outcome = say(session, "Plan it");
        session.detach();
        late.resolve(reply());
        expect(await outcome).toBe("cancelled");
        expect(session.getSnapshot()).toMatchObject({ messages: [], message: "", status: "idle" });
    });
    it("keeps a newer draft typed while waiting", async () => {
        const late = deferred<unknown>();
        const { session } = setup(vi.fn<PlanningGenerator>(() => late.promise));
        const outcome = say(session, "First");
        session.setMessage("Second, still typing");
        late.resolve(reply());
        expect(await outcome).toBe("reply");
        expect(session.getSnapshot().message).toBe("Second, still typing");
    });
});

describe("controls and isolation", () => {
    it("refuses empty or over-long input without sending", async () => {
        const generate = vi.fn<PlanningGenerator>();
        const { session } = setup(generate);
        expect(await say(session, "   ")).toBe("invalid");
        expect(await say(session, "x".repeat(2001))).toBe("invalid");
        expect(generate).not.toHaveBeenCalled();
    });
    it("blocks a turn while programme work is unsaved, and stops a wait when it opens", async () => {
        const late = deferred<unknown>();
        const generate = vi.fn<PlanningGenerator>(() => late.promise);
        const { session, source } = setup(generate);
        source.hasOpenWork = true;
        expect(await say(session, "Plan it")).toBe("blocked");
        expect(session.getSnapshot().error).toBe(PLANNING_OPEN_WORK);
        expect(generate).not.toHaveBeenCalled();
        source.hasOpenWork = false;
        const outcome = session.send();
        source.hasOpenWork = true;
        session.refresh();
        late.resolve(reply());
        expect(await outcome).toBe("cancelled");
        expect(session.getSnapshot()).toMatchObject({ status: "error", error: PLANNING_OPEN_WORK, messages: [] });
    });
    it("starts again when the selected job or its saved programme changes, including mid-reply", async () => {
        const late = deferred<unknown>();
        const generate = vi.fn<PlanningGenerator>().mockResolvedValueOnce(reply()).mockImplementationOnce(() => late.promise).mockResolvedValueOnce(reply({ message: "Dormer noted." }));
        const { session, source } = setup(generate);
        await say(session, "Job A question");
        source.project = RELATIVE;
        session.refresh();
        expect(session.getSnapshot()).toMatchObject({ messages: [], notice: PLANNING_CHANGED });
        const outcome = say(session, "Job B question");
        source.project = { ...RELATIVE, programme_phases: [RELATIVE.programme_phases![0]] };
        late.resolve(reply());
        expect(await outcome).toBe("stale");
        expect(session.getSnapshot()).toMatchObject({ messages: [], notice: PLANNING_CHANGED, message: "Job B question" });
        expect(await session.send()).toBe("reply");
        const last = generate.mock.calls[2][0];
        expect(last.context.job.id).toBe("job-b");
        expect(last.messages).toEqual([{ role: "user", content: "Job B question" }]);
        expect(JSON.stringify(last)).not.toContain("Job A");
    });
    it("refuses when the saved programme cannot be read", async () => {
        const { session, source } = setup(vi.fn<PlanningGenerator>());
        source.project = { ...DATED, programme_phases: "broken" as unknown as unknown[] };
        expect(await say(session, "Plan it")).toBe("blocked");
        expect(session.getSnapshot().error).toBe(PLANNING_NO_CONTEXT);
    });
    it("records review choices in memory only and limits turns", async () => {
        const generate = vi.fn<PlanningGenerator>().mockResolvedValue(reply({ suggestions: [{ topic: "milestone", title: "Groundworks complete", stage: "Groundworks", timing: null }] }));
        const { session } = setup(generate);
        await say(session, "What milestones matter?");
        expect(session.decide(1, 0, "kept")).toBe(true);
        expect(session.decide(0, 0, "kept")).toBe(false);
        expect(session.decide(1, 3, "dismissed")).toBe(false);
        expect(session.getSnapshot().decisions).toEqual({ "1:0": "kept" });
        for (let i = 1; i < PLANNING_TURN_LIMIT; i++) await say(session, `Turn ${i}`);
        expect(await say(session, "One too many")).toBe("limit");
        expect(generate).toHaveBeenCalledTimes(PLANNING_TURN_LIMIT);
        session.reset();
        expect(session.getSnapshot()).toMatchObject({ messages: [], decisions: {} });
    });
});

describe("no hidden writes or reused authority", () => {
    it("has no transport, storage, write or weekly-update dependency in source", () => {
        const code = readFileSync(new URL("./planning-conversation.ts", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
        for (const banned of ["supabase", "fetch(", "localStorage", "sessionStorage", "indexedDB", "ai-budget", "@/lib/ai", "cohort-ai", "programme-update", "Action", "process.env"]) {
            expect(code, banned).not.toContain(banned);
        }
    });
    it("is mounted without a default generator", () => {
        const page = readFileSync(new URL("../app/dashboard/projects/schedule/page.tsx", import.meta.url), "utf8");
        const client = readFileSync(new URL("../app/dashboard/projects/schedule/simple-programme-client.tsx", import.meta.url), "utf8");
        expect(page).not.toContain("planningGenerator");
        // A055: the page passes only the server's availability; the real request
        // path is used only when that is on, and a test generator only when injected.
        expect(page).toContain('planningAssistantEnabled={await jobAssistantAvailable("planning")}');
        expect(client).toContain("planningGenerator ?? (planningAssistantEnabled\n        ? createPlanningRequestGenerator(planningAssistantTurnAction) : undefined)");
        expect(client).toContain("createPlanningConversation(() => source, planningTransport)");
        expect(client).toMatch(/planningAssistantEnabled = false/);
        expect(client).not.toMatch(/planningGenerator\s*=/);
    });
});
