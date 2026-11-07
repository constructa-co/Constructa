import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useId: () => "planning-test", useSyncExternalStore: (_subscribe: unknown, read: () => unknown) => read() }));
import PlanningConversationPanel from "./planning-conversation-panel";
import { createPlanningConversation, type PlanningConversation, type PlanningGenerator } from "@/lib/planning-conversation";
import { workspaceStyles } from "@/lib/workspace-styles";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
const project = { id: "job", name: "<b>Job</b>", start_date: "2026-11-02", programme_phases: [{ name: "Groundworks", manualDays: 10, startOffset: 0 }] };
function setup(generate?: PlanningGenerator) {
    return createPlanningConversation(() => ({ project, hasOpenWork: false }), generate);
}
const view = (session: PlanningConversation, blocked = false) => PlanningConversationPanel({ session, blocked, s: workspaceStyles(true) });
const buttons = (tree: unknown) => nodes(tree).filter(node => node.type === "button");
const text = (node: Element) => renderToStaticMarkup(node);

describe("planning conversation panel", () => {
    it("shows an honest not-enabled state with no form when there is no transport", () => {
        const html = renderToStaticMarkup(view(setup()));
        expect(html).toContain("Not enabled");
        expect(html).toContain("does not send your job details anywhere");
        expect(html).not.toContain("<form");
    });

    it("disables sending for empty input and while programme work is open", () => {
        const session = setup(vi.fn());
        expect(buttons(view(session)).find(b => b.props.type === "submit")?.props.disabled).toBe(true);
        session.setMessage("When to order windows?");
        expect(buttons(view(session)).find(b => b.props.type === "submit")?.props.disabled).toBe(false);
        const blocked = view(session, true);
        expect(buttons(blocked).find(b => b.props.type === "submit")?.props.disabled).toBe(true);
        expect(nodes(blocked).find(n => n.type === "textarea")?.props.disabled).toBe(true);
        expect(renderToStaticMarkup(blocked)).toContain("Save or discard your programme changes first");
    });

    it("shows pending controls and stops waiting on request", async () => {
        let release: ((value: unknown) => void) | undefined;
        const generate = vi.fn(() => new Promise(resolve => { release = resolve; }));
        const session = setup(generate);
        session.setMessage("Plan it");
        const outcome = session.send();
        const pending = view(session);
        expect(buttons(pending).find(b => b.props.type === "submit")?.props.disabled).toBe(true);
        const stop = buttons(pending).find(b => text(b).includes("Stop waiting"))!;
        (stop.props.onClick as () => void)();
        release?.({ message: "late" });
        expect(await outcome).toBe("cancelled");
        // Stopped before the transport was reached: nothing was sent.
        expect(generate).not.toHaveBeenCalled();
        expect(renderToStaticMarkup(view(session))).toContain("Your programme is unchanged");
    });

    it("renders a multi-turn reply as escaped text with review choices that save nothing", async () => {
        const session = setup(vi.fn<PlanningGenerator>().mockResolvedValue({
            message: "<img src=x onerror=alert(1)>", questions: ["Has the client chosen tiles?"],
            suggestions: [{ topic: "procurement", title: "Order windows", stage: "Groundworks", timing: null }],
        }));
        session.setMessage("What should I order first?");
        await session.send();
        const html = renderToStaticMarkup(view(session));
        expect(html).not.toContain("<img");
        expect(html).toContain("Still to confirm");
        expect(html).toContain("Timing not given yet.");
        const keep = buttons(view(session)).find(b => text(b).includes("Keep on list"))!;
        (keep.props.onClick as () => void)();
        expect(renderToStaticMarkup(view(session))).toContain("Add it to your programme yourself");
    });

    it("offers retry after a failed reply", async () => {
        const session = setup(vi.fn<PlanningGenerator>().mockRejectedValue(new Error("down")));
        session.setMessage("Plan it");
        await session.send();
        const tree = view(session);
        expect(buttons(tree).some(b => text(b).includes("Try again"))).toBe(true);
        expect(buttons(view(session, true)).some(b => text(b).includes("Try again"))).toBe(false);
    });
});
