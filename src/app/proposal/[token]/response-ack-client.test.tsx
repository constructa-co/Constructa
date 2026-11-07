import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { responseWording, type ProposalResponseKind } from "@/lib/proposal-response";

// A114: the actual ResponseClient handlers through the same controlled-hook
// seam as response-transport.test.tsx. Only the action's answer is simulated.
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
function view(kind: ProposalResponseKind = "acknowledgement") {
    current.cursor = 0;
    return ResponseClient({ token: TOKEN, kind, ...responseWording(kind), companyName: "TEST DATA - Contractor", reference: "SYNTHETIC-V1", defaultName: "Alex Client", status: "viewed", respondedAt: null, respondedBy: null, isExpired: false, isRevoked: false, respond: current.respond });
}
async function send() {
    const form = nodes(view()).find(e => e.type === "form")!;
    (form.props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault: vi.fn() });
    for (let i = 0; i < 5; i++) await Promise.resolve();
}
const recorded = () => nodes(view()).find(e => e.props["data-response-state"] === "recorded");
const alert = () => text(nodes(view()).find(e => e.props.role === "alert"));
beforeEach(() => { current.slots = []; current.cursor = 0; current.respond.mockReset(); });

describe("A114 public response: only a confirmed acknowledgement is shown as recorded", () => {
    it.each([
        ["success with no status or time", { success: true }],
        ["success with a status this page never asks for", { success: true, status: "accepted", respondedAt: "2026-10-25T00:00:00.000Z" }],
        ["success with a missing time", { success: true, status: "acknowledged" }],
        ["success with an unreadable time", { success: true, status: "acknowledged", respondedAt: "soon" }],
    ])("does not invent a record from %s", async (_label, result) => {
        current.respond.mockResolvedValueOnce(result);
        await send();
        expect(recorded()).toBeUndefined();
        expect(alert()).toMatch(/could not be confirmed/i);
        expect(alert()).not.toMatch(/not recorded|could not be recorded/i);
        expect(text(view())).not.toMatch(/Proposal accepted/);
        expect(current.respond).toHaveBeenCalledTimes(1);
    });

    it("shows the server's unconfirmed outcome, keeps the typing and does not retry by itself", async () => {
        current.respond.mockResolvedValueOnce({ success: false, unconfirmed: true, error: "Your response could not be confirmed. Refresh this page to check whether it was recorded before trying again, or contact the contractor." });
        await send();
        expect(recorded()).toBeUndefined();
        expect(alert()).toContain("Refresh this page to check");
        expect(nodes(view()).find(e => e.props.id === "response-name")!.props.value).toBe("Alex Client");
        for (let i = 0; i < 5; i++) await Promise.resolve();
        expect(current.respond).toHaveBeenCalledTimes(1);
    });

    it("still shows a confirmed acknowledgement with the server's own time", async () => {
        current.respond.mockResolvedValueOnce({ success: true, status: "acknowledged", respondedAt: "2026-10-25T09:00:00.000Z" });
        await send();
        expect(recorded()).toBeDefined();
        expect(text(recorded())).toContain("25 October 2026");
    });
});
