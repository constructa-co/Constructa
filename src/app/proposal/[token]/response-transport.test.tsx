import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { responseWording, type ProposalResponseKind } from "@/lib/proposal-response";

// Same controlled-hook seam as project-board-feedback.test.tsx; actual component handlers, no server or browser.
const current = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, respond: vi.fn() }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = initial;
        return [current.slots[i], (next: unknown) => { current.slots[i] = typeof next === "function" ? next(current.slots[i]) : next; }];
    },
    useRef: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = { current: initial };
        return current.slots[i];
    },
}));
vi.mock("./actions", () => ({ respondToProposalAction: current.respond }));
import ResponseClient from "./response-client";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function text(value: unknown): string {
    if (Array.isArray(value)) return value.map(text).join(" ");
    if (typeof value === "string" || typeof value === "number") return String(value);
    return value && typeof value === "object" && "props" in value ? text((value as Element).props.children) : "";
}
const TOKEN = "ab".repeat(32);
function view(kind: ProposalResponseKind = "non_binding_intent") {
    current.cursor = 0;
    const wording = responseWording(kind);
    return ResponseClient({ token: TOKEN, kind, ...wording, companyName: "TEST DATA - Contractor", reference: "SYNTHETIC-V1", defaultName: "Alex Client", status: "viewed", respondedAt: null, respondedBy: null, isExpired: false, isRevoked: false, respond: current.respond });
}
function submit(kind?: ProposalResponseKind) {
    const form = nodes(view(kind)).find(e => e.type === "form")!;
    expect(form).toBeDefined();
    return () => (form.props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault: vi.fn() });
}
async function settle() { for (let i = 0; i < 5; i++) await Promise.resolve(); }
beforeEach(() => { current.slots = []; current.cursor = 0; current.respond.mockReset(); });

describe("actual public response transport boundary", () => {
    it("does not claim nothing was sent after a reply is lost following a simulated recorded response", async () => {
        let mockRecorded = false;
        current.respond.mockImplementation(async () => { mockRecorded = true; throw Error("private transport details"); });
        const email = nodes(view()).find(e => e.props.id === "response-email")!;
        (email.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "client@example.invalid" } });
        submit()(); await settle();
        expect(mockRecorded).toBe(true);
        expect(current.respond).toHaveBeenCalledExactlyOnceWith(TOKEN, "Alex Client", "client@example.invalid");
        const tree = view(), alert = nodes(tree).find(e => e.props.role === "alert");
        expect(text(alert)).toMatch(/could not be confirmed|couldn't confirm/i);
        expect(text(alert)).not.toMatch(/nothing was sent|not recorded|private transport details/i);
        expect(nodes(tree).find(e => e.props["data-response-state"] === "recorded")).toBeUndefined();
        expect(nodes(tree).find(e => e.props.id === "response-name")!.props.value).toBe("Alex Client");
        expect(nodes(tree).find(e => e.props.id === "response-email")!.props.value).toBe("client@example.invalid");
        await settle(); expect(current.respond).toHaveBeenCalledTimes(1);
    });

    it("fences an immediate second submit before rerender and releases only for deliberate retry", async () => {
        let resolve!: (result: { success: boolean; error: string }) => void;
        current.respond.mockReturnValueOnce(new Promise(r => { resolve = r; }));
        const send = submit("acknowledgement"); send(); send();
        expect(current.respond).toHaveBeenCalledTimes(1);
        const pending = nodes(view("acknowledgement"));
        expect(pending.find(e => e.type === "button")!.props.disabled).toBe(true);
        expect(pending.filter(e => e.type === "input").every(e => e.props.disabled === true)).toBe(true);
        resolve({ success: false, error: "Synthetic explicit refusal" }); await settle();
        expect(current.respond).toHaveBeenCalledTimes(1);
        expect(text(view("acknowledgement"))).toContain("Synthetic explicit refusal");
        current.respond.mockResolvedValueOnce({ success: true, status: "acknowledged", respondedAt: "2026-10-25T00:00:00.000Z" });
        submit("acknowledgement")(); await settle();
        expect(current.respond).toHaveBeenCalledTimes(2);
        expect(nodes(view("acknowledgement")).find(e => e.props["data-response-state"] === "recorded")).toBeDefined();
    });

    it("releases the synchronous pending fence when the reply promise rejects, then a deliberate retry of the same literal happens exactly once before the acknowledged recorded state", async () => {
        current.respond.mockReturnValueOnce(Promise.reject(new Error("Synthetic lost reply transport")));
        const email = nodes(view()).find(e => e.props.id === "response-email")!;
        (email.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: "client@example.invalid" } });
        const send = submit(); send();
        // The lost reply resolves asynchronously: the pending fence holds synchronously, no duplicate in-flight submit.
        const pending = nodes(view());
        expect(pending.find(e => e.type === "button")!.props.disabled).toBe(true);
        expect(pending.filter(e => e.type === "input").every(e => e.props.disabled === true)).toBe(true);
        await settle();
        // The rejected promise releases the fence with the lost-reply wording, fields retained, and no automatic retry.
        expect(current.respond).toHaveBeenCalledTimes(1);
        const released = view();
        const alert = nodes(released).find(e => e.props.role === "alert");
        expect(text(alert)).toMatch(/could not be confirmed|couldn't confirm/i);
        expect(text(alert)).not.toMatch(/nothing was sent|not recorded/i);
        expect(nodes(released).find(e => e.props["data-response-state"] === "recorded")).toBeUndefined();
        expect(nodes(released).find(e => e.props.id === "response-name")!.props.value).toBe("Alex Client");
        expect(nodes(released).find(e => e.props.id === "response-email")!.props.value).toBe("client@example.invalid");
        await settle(); expect(current.respond).toHaveBeenCalledTimes(1);
        // The deliberate retry carries the SAME literal name/email/token exactly once and reaches the recorded state.
        current.respond.mockResolvedValueOnce({ success: true, status: "acknowledged", respondedAt: "2026-10-25T00:00:00.000Z" });
        submit()(); await settle();
        expect(current.respond).toHaveBeenCalledTimes(2);
        expect(current.respond).toHaveBeenLastCalledWith(TOKEN, "Alex Client", "client@example.invalid");
        await settle(); expect(current.respond).toHaveBeenCalledTimes(2);
        expect(nodes(view()).find(e => e.props["data-response-state"] === "recorded")).toBeDefined();
    });
});
