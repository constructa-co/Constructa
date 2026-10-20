import { describe, expect, it, vi } from "vitest";
import type { Estimate } from "@/app/dashboard/projects/costs/types";
import { buildPricingReviewContext, prepareReviewedPriceDraft, PRICING_REVIEW_STALE, PRICING_REVIEW_OPEN } from "./pricing-review";
import { createPricingConversation, PRICING_CONVERSATION_LIMIT, PRICING_CONVERSATION_OFF, type PricingConversationGenerator } from "./pricing-conversation";

const reply = { message: "Review the work you described.", suggestions: [{ source: "briefWork", start: 0, end: 14 }] };
function fixture() {
    const estimate: Estimate = { id: "estimate", project_id: "job", version_name: "Main", is_active: true,
        overhead_pct: 10, profit_pct: 15, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 123,
        estimate_lines: [{ id: "line", estimate_id: "estimate", trade_section: "Preparation", description: "Existing work", quantity: 1,
            unit: "item", unit_rate: 123, line_total: 123, line_type: "general", pricing_mode: "simple", estimate_line_components: [] }] };
    const snapshot = { project: { id: "job", brief_scope: "Prepare walls. Paint walls.\n\nSite, access and assumptions:\nPrivate site note." }, estimate, hasOpenWork: false };
    return { snapshot, read: () => snapshot };
}
function deferred() {
    let resolve!: (value: unknown) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<unknown>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

describe("pricing conversation lifecycle (injected test replies, no provider)", () => {
    it("is honestly off without a generator, without reading or writing the job", async () => {
        const read = vi.fn(); const conversation = createPricingConversation(read);
        expect(await conversation.send("Help price this")).toBe("off");
        expect(read).not.toHaveBeenCalled();
        expect(conversation.getState()).toMatchObject({ status: "off", pending: null, error: PRICING_CONVERSATION_OFF });
    });
    it("sends only allowlisted context and text history, not identifiers, prices or site notes", async () => {
        const f = fixture(), before = JSON.stringify(f.snapshot);
        const generate = vi.fn<PricingConversationGenerator>().mockResolvedValue(reply);
        const c = createPricingConversation(f.read, generate);
        expect(await c.send("Start with preparation")).toBe("review");
        const input = generate.mock.calls[0][0];
        expect(input.context).toEqual({ work: "Prepare walls. Paint walls.", contractorMessage: "Start with preparation", existingWork: [{ description: "Existing work", section: "Preparation" }] });
        expect(input.messages).toEqual([{ role: "user", content: "Start with preparation" }]);
        expect(JSON.stringify(input)).not.toMatch(/Private site note|projectId|estimateId|revision|unit_rate|total_cost|123/);
        expect(JSON.stringify(f.snapshot)).toBe(before);
        expect(c.getState().pending?.suggestions[0].description).toBe("Prepare walls.");
    });
    it("builds multi-turn history only from accepted reviewed replies", async () => {
        const f = fixture(), generate = vi.fn<PricingConversationGenerator>().mockResolvedValue(reply);
        const c = createPricingConversation(f.read, generate);
        await c.send("First question"); await c.send("Follow-up question");
        expect(generate.mock.calls[1][0].messages).toEqual([
            { role: "user", content: "First question" }, { role: "assistant", content: reply.message }, { role: "user", content: "Follow-up question" },
        ]);
        expect(c.getState().messages).toHaveLength(4);
    });
    it("fences immediate duplicate sends while one request is pending", async () => {
        const f = fixture(), held = deferred(), generate = vi.fn(() => held.promise);
        const c = createPricingConversation(f.read, generate);
        const first = c.send("First");
        expect(await c.send("Duplicate")).toBe("busy");
        await Promise.resolve(); expect(generate).toHaveBeenCalledOnce();
        held.resolve(reply); expect(await first).toBe("review");
        expect(c.getState().messages[0].content).toBe("First");
    });
    it("cancels immediately even when the generator ignores its AbortSignal", async () => {
        const f = fixture(), held = deferred(); let signal: AbortSignal | undefined;
        const c = createPricingConversation(f.read, input => { signal = input.signal; return held.promise; });
        const request = c.send("First"); await Promise.resolve(); c.cancel();
        expect(await request).toBe("cancelled"); expect(signal?.aborted).toBe(true);
        expect(c.getState()).toMatchObject({ status: "idle", pending: null, messages: [] });
        held.reject(new Error("late provider secret must not surface")); await Promise.resolve();
        expect(c.getState().error).toBeNull();
    });
    it("does not call the generator when cancelled before its microtask starts", async () => {
        const f = fixture(), generate = vi.fn().mockResolvedValue(reply), c = createPricingConversation(f.read, generate);
        const request = c.send("First"); c.cancel(); expect(await request).toBe("cancelled");
        expect(generate).not.toHaveBeenCalled();
    });
    it("a late old reply cannot replace a newer pending review", async () => {
        const f = fixture(), old = deferred(), latest = deferred(); let count = 0;
        const c = createPricingConversation(f.read, () => ++count === 1 ? old.promise : latest.promise);
        const first = c.send("Old"); await Promise.resolve(); c.cancel(); expect(await first).toBe("cancelled");
        const second = c.send("New"); await Promise.resolve(); latest.resolve({ ...reply, message: "New reply" });
        expect(await second).toBe("review"); old.resolve({ ...reply, message: "Old reply" }); await Promise.resolve();
        expect(c.getState().pending?.message).toBe("New reply");
        expect(c.getState().messages[0].content).toBe("New");
    });
    it.each(["job", "brief", "estimate", "price", "components"])("drops a reply after the %s changes", async change => {
        const f = fixture(), held = deferred(), c = createPricingConversation(f.read, () => held.promise);
        const request = c.send("Question"); await Promise.resolve();
        if (change === "job") f.snapshot.project.id = "other";
        if (change === "brief") f.snapshot.project.brief_scope += " More work";
        if (change === "estimate") f.snapshot.estimate.id = "other";
        if (change === "price") f.snapshot.estimate.estimate_lines[0].unit_rate = 456;
        if (change === "components") f.snapshot.estimate.estimate_lines[0].estimate_line_components = [{ description: "new" }] as never;
        held.resolve(reply); expect(await request).toBe("stale");
        expect(c.getState()).toMatchObject({ pending: null, messages: [], error: PRICING_REVIEW_STALE });
    });
    it("clears the transcript before sending context from a different job", async () => {
        const f = fixture(), generate = vi.fn<PricingConversationGenerator>().mockResolvedValue(reply), c = createPricingConversation(f.read, generate);
        await c.send("Old job question"); f.snapshot.project.id = "new-job"; f.snapshot.estimate.project_id = "new-job";
        expect(c.getState().pending).toBeNull();
        await c.send("New job question"); expect(generate.mock.calls[1][0].messages).toEqual([{ role: "user", content: "New job question" }]);
    });
    it("rejects open work before generation and after a pending request", async () => {
        const f = fixture(), held = deferred(), generate = vi.fn(() => held.promise), c = createPricingConversation(f.read, generate);
        f.snapshot.hasOpenWork = true; expect(await c.send("Question")).toBe("invalid"); expect(generate).not.toHaveBeenCalled();
        f.snapshot.hasOpenWork = false; const request = c.send("Question"); await Promise.resolve();
        f.snapshot.hasOpenWork = true; held.resolve(reply); expect(await request).toBe("stale");
        expect(c.getState()).toMatchObject({ pending: null, error: PRICING_REVIEW_OPEN });
    });
    it("clears a reviewed suggestion when open work appears before it is consumed", async () => {
        const f = fixture(), c = createPricingConversation(f.read, async () => reply); await c.send("Question");
        f.snapshot.hasOpenWork = true; expect(c.getState()).toMatchObject({ pending: null, error: PRICING_REVIEW_OPEN });
    });
    it.each([{ ...reply, action: "save" }, { ...reply, suggestions: [{ ...reply.suggestions[0], rate: 99 }] }, null])("refuses an unreviewable reply %j without adding history", async value => {
        const f = fixture(), c = createPricingConversation(f.read, async () => value);
        expect(await c.send("Question")).toBe("invalid"); expect(c.getState().messages).toEqual([]); expect(c.getState().pending).toBeNull();
    });
    it("handles thrown and rejected generators without surfacing internal errors and supports explicit retry", async () => {
        const f = fixture(), generate = vi.fn<PricingConversationGenerator>().mockRejectedValueOnce(new Error("secret internal detail")).mockResolvedValue(reply);
        const c = createPricingConversation(f.read, generate); expect(await c.send("Question")).toBe("failed");
        expect(JSON.stringify(c.getState())).not.toContain("secret internal detail");
        expect(await c.send("Retry")).toBe("review"); expect(generate.mock.calls[1][0].messages).toHaveLength(1);
        const throwing = createPricingConversation(f.read, () => { throw Error("sync"); });
        expect(await throwing.send("Question")).toBe("failed");
    });
    it.each(["", "   ", "x".repeat(20001)])("refuses blank/oversized input without truncation or generation", async input => {
        const f = fixture(), generate = vi.fn(), c = createPricingConversation(f.read, generate);
        expect(await c.send(input)).toBe("invalid"); expect(generate).not.toHaveBeenCalled();
    });
    it("bounds in-memory turns without truncating history, then allows explicit reset", async () => {
        const f = fixture(), generate = vi.fn().mockResolvedValue(reply), c = createPricingConversation(f.read, generate);
        for (let n = 0; n < PRICING_CONVERSATION_LIMIT; n++) expect(await c.send(`Question ${n}`)).toBe("review");
        expect(await c.send("One too many")).toBe("limit"); expect(generate).toHaveBeenCalledTimes(PRICING_CONVERSATION_LIMIT);
        expect(c.getState().messages).toHaveLength(PRICING_CONVERSATION_LIMIT * 2);
        c.reset(); expect(await c.send("New review")).toBe("review"); expect(c.getState().messages).toHaveLength(2);
    });
    it("cannot mutate stored history or review through returned state or generator input", async () => {
        const f = fixture(); let inputs: Parameters<PricingConversationGenerator>[0] | undefined;
        const c = createPricingConversation(f.read, async input => { inputs = input; return reply; }); await c.send("Question");
        const state = c.getState(); state.messages[0].content = "changed"; state.pending!.suggestions[0].description = "changed";
        inputs!.messages[0].content = "changed"; inputs!.context.existingWork[0].description = "changed";
        expect(c.getState().messages[0].content).toBe("Question"); expect(c.getState().pending!.suggestions[0].description).toBe("Prepare walls.");
        expect(f.snapshot.estimate.estimate_lines[0].description).toBe("Existing work");
    });
    it("opens only an unpriced draft via the existing explicit reviewed-choice boundary", async () => {
        const f = fixture(), c = createPricingConversation(f.read, async () => reply); await c.send("Question");
        const context = buildPricingReviewContext(f.snapshot.project, f.snapshot.estimate, "Question");
        if (!context.ok) throw Error(context.error);
        const draft = prepareReviewedPriceDraft(c.getState().pending!, 0, context.value, false);
        expect(draft.ok && draft.value.description).toBe("Prepare walls.");
        expect(draft.ok && draft.value.amount).toBe("");
        expect(f.snapshot.estimate.total_cost).toBe(123);
    });
    it("disposing clears pending data and prevents further calls", async () => {
        const f = fixture(), held = deferred(), generate = vi.fn(() => held.promise), c = createPricingConversation(f.read, generate);
        const request = c.send("Question"); await Promise.resolve(); c.dispose(); expect(await request).toBe("cancelled");
        expect(await c.send("Another")).toBe("cancelled"); expect(c.getState()).toMatchObject({ pending: null, messages: [] });
        expect(generate).toHaveBeenCalledOnce(); held.resolve(reply);
    });
});
