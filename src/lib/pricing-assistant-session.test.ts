import { describe, expect, it, vi } from "vitest";
import { createPricingAssistantSession } from "./pricing-assistant-session";
import { PRICING_CONVERSATION_OFF, type PricingConversationGenerator, type PricingConversationSnapshot } from "./pricing-conversation";

const reply = { message: "Review preparation.", suggestions: [{ source: "briefWork", start: 0, end: 14 }] };
function setup(generate?: PricingConversationGenerator) {
    const snapshot: PricingConversationSnapshot = { project: { id: "job", brief_scope: "Prepare walls. Paint walls." }, estimate: null, hasOpenWork: false };
    const read = vi.fn(() => snapshot), open = vi.fn().mockReturnValue({ ok: true });
    return { snapshot, read, open, session: createPricingAssistantSession(read, open, generate) };
}
function held() { let resolve!: (value: unknown) => void; let reject!: (error: unknown) => void; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

describe("pricing assistant UI store (no default provider or write)", () => {
    it("is unavailable without reading job data, retaining text, sending or opening a draft", async () => {
        const f = setup(); f.session.setMessage("Private text"); expect(await f.session.send()).toBe("off");
        expect(f.session.getSnapshot()).toMatchObject({ available: false, message: "", error: PRICING_CONVERSATION_OFF, conversation: { status: "off", messages: [], pending: null } });
        expect(f.read).not.toHaveBeenCalled(); expect(f.open).not.toHaveBeenCalled();
    });
    it("keeps a stable frozen external-store snapshot until an event publishes", () => {
        const f = setup(async () => reply), first = f.session.getSnapshot(), changed = vi.fn(), unsubscribe = f.session.subscribe(changed);
        expect(f.session.getSnapshot()).toBe(first);
        f.session.setMessage("Question"); expect(changed).toHaveBeenCalledOnce(); expect(f.session.getSnapshot()).not.toBe(first);
        expect(Reflect.set(f.session.getSnapshot(), "message", "tamper")).toBe(false);
        unsubscribe(); f.session.setMessage("New text"); expect(changed).toHaveBeenCalledOnce();
    });
    it("publishes pending immediately and accepted review only, without opening any draft", async () => {
        const wait = held(), generate = vi.fn(() => wait.promise), f = setup(generate);
        f.session.setMessage("Question"); const request = f.session.send();
        expect(f.session.getSnapshot().conversation.status).toBe("pending");
        expect(await f.session.send()).toBe("busy"); await Promise.resolve(); expect(generate).toHaveBeenCalledOnce();
        wait.resolve(reply); expect(await request).toBe("review");
        expect(f.session.getSnapshot().conversation.pending?.suggestions[0].description).toBe("Prepare walls.");
        expect(f.session.getSnapshot().message).toBe(""); expect(f.open).not.toHaveBeenCalled();
    });
    it("does not clear newer typing when an older submitted message finishes", async () => {
        const wait = held(), f = setup(() => wait.promise);
        f.session.setMessage("Original question"); const request = f.session.send();
        f.session.setMessage("New typing"); wait.resolve(reply); await request;
        expect(f.session.getSnapshot().message).toBe("New typing");
        expect(f.session.choose(0)).toEqual({ ok: true });
        expect(f.open.mock.calls[0][2]).toBe("Original question");
        expect(f.session.getSnapshot().notice).toContain("unpriced draft");
    });
    it("cancels/clears immediately and cannot show a late old reply over a new request", async () => {
        const old = held(), latest = held(); let n = 0;
        const f = setup(() => ++n === 1 ? old.promise : latest.promise);
        f.session.setMessage("Old"); const a = f.session.send(); await Promise.resolve(); f.session.cancel(); await a;
        f.session.setMessage("New"); const b = f.session.send(); await Promise.resolve(); latest.resolve({ ...reply, message: "New reply" }); await b;
        old.resolve({ ...reply, message: "Old reply" }); await Promise.resolve();
        expect(f.session.getSnapshot().conversation.pending?.message).toBe("New reply");
    });
    it("retains text and safe errors for explicit retry after a rejected request", async () => {
        const generate = vi.fn<PricingConversationGenerator>().mockRejectedValueOnce(Error("private internal detail")).mockResolvedValue(reply), f = setup(generate);
        f.session.setMessage("Retry this"); expect(await f.session.send()).toBe("failed");
        expect(f.session.getSnapshot().message).toBe("Retry this"); expect(JSON.stringify(f.session.getSnapshot())).not.toContain("private internal detail");
        expect(await f.session.send()).toBe("review"); expect(generate).toHaveBeenCalledTimes(2);
    });
    it("refresh invalidates review after the job source changes", async () => {
        const f = setup(async () => reply); f.session.setMessage("Question"); await f.session.send();
        f.snapshot.project.brief_scope += " Extra work"; f.session.refresh();
        expect(f.session.getSnapshot().conversation.pending).toBeNull(); expect(f.session.getSnapshot().conversation.messages).toEqual([]);
        expect(f.session.choose(0).ok).toBe(false); expect(f.open).not.toHaveBeenCalled();
    });
    it("prevents source mutation through the rendered snapshot", async () => {
        const f = setup(async () => reply); f.session.setMessage("Question"); await f.session.send();
        expect(() => { f.session.getSnapshot().conversation.pending!.suggestions[0].description = "Changed scope"; }).toThrow();
        expect(f.session.choose(0)).toEqual({ ok: true });
        expect(f.open.mock.calls[0][0].suggestions[0].description).toBe("Prepare walls.");
    });
    it.each([-1, 99, 0.5, Number.NaN])("rejects unreviewed choice %s before the parent callback", async index => {
        const f = setup(async () => reply); f.session.setMessage("Question"); await f.session.send();
        expect(f.session.choose(index).ok).toBe(false); expect(f.open).not.toHaveBeenCalled();
    });
    it("keeps a refused parent choice pending, with an error and no success claim", async () => {
        const f = setup(async () => reply); f.open.mockReturnValue({ ok: false, error: "Finish your open line first." });
        f.session.setMessage("Question"); await f.session.send(); expect(f.session.choose(0).ok).toBe(false);
        expect(f.session.getSnapshot()).toMatchObject({ error: "Finish your open line first.", notice: null });
        expect(f.session.getSnapshot().conversation.pending).not.toBeNull();
    });
    it("uses uncertain wording if the local draft callback throws", async () => {
        const f = setup(async () => reply); f.open.mockImplementation(() => { throw Error("internal secret"); });
        f.session.setMessage("Question"); await f.session.send(); f.session.choose(0);
        expect(f.session.getSnapshot().error).toContain("could not be confirmed"); expect(f.session.getSnapshot().error).not.toContain("internal secret");
    });
    it("drops old data on detach and remains usable after Strict Mode cleanup/setup replay", async () => {
        const wait = held(), generate = vi.fn<PricingConversationGenerator>().mockImplementationOnce(() => wait.promise).mockResolvedValue(reply), f = setup(generate);
        f.session.setMessage("Old"); const first = f.session.send(); await Promise.resolve(); f.session.detach(); await first;
        expect(f.session.getSnapshot()).toMatchObject({ message: "", conversation: { pending: null, messages: [] } });
        f.session.setMessage("New"); expect(await f.session.send()).toBe("review");
        wait.reject(Error("late rejection")); await Promise.resolve();
        expect(f.session.getSnapshot().conversation.pending?.message).toBe(reply.message);
    });
    it("allows explicit local reset without writing or reusing history", async () => {
        const generate = vi.fn<PricingConversationGenerator>().mockResolvedValue(reply), f = setup(generate);
        f.session.setMessage("First"); await f.session.send(); f.session.reset();
        expect(f.session.getSnapshot()).toMatchObject({ message: "", conversation: { messages: [], pending: null } });
        f.session.setMessage("Second"); await f.session.send();
        expect(generate.mock.calls[1][0].messages).toEqual([{ role: "user", content: "Second" }]); expect(f.open).not.toHaveBeenCalled();
    });
    it("refuses client BoQ generation before calling the injected adapter", async () => {
        const generate = vi.fn(), f = setup(generate);
        f.snapshot.estimate = { is_client_boq: true } as never;
        f.session.setMessage("Question"); expect(await f.session.send()).toBe("invalid"); expect(generate).not.toHaveBeenCalled();
        expect(f.session.getSnapshot().error).toContain("client BoQ");
    });
});
