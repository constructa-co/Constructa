import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
const current = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, pending: false, tasks: [] as Promise<unknown>[], ordinary: vi.fn(), won: vi.fn(), refresh: vi.fn() }));
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
    useTransition: () => [current.pending, (work: () => unknown) => {
        current.pending = true;
        const task = Promise.resolve(work()).catch(() => {}).finally(() => { current.pending = false; });
        current.tasks.push(task);
    }],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: current.refresh }) }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("./board-actions", () => ({ updateStatusAction: current.ordinary, markAsWonAction: current.won }));
import ProjectBoard from "./project-board";
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
const project = { id: "job", name: "QA Example", status: "Lead", created_at: null, potential_value: 0, client_name: "Test" };
let projects: typeof project[];
function view() { current.cursor = 0; return ProjectBoard({ projects, financials: {} }); }
function column(stage: string) { return nodes(view()).find(e => e.type === "div" && e.key === stage)!; }
function click(label: string) {
    const button = nodes(view()).find(e => e.type === "button" && text(e.props.children).trim() === label);
    expect(button).toBeDefined(); return button!.props.onClick as () => void;
}
const settle = async () => { await Promise.all(current.tasks); };
function held() { let resolve!: (value: unknown) => void; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; }
beforeEach(() => {
    current.slots = []; current.cursor = 0; current.pending = false; current.tasks = [];
    current.ordinary.mockReset().mockResolvedValue({ success: true }); current.won.mockReset().mockResolvedValue({ success: true }); current.refresh.mockReset();
    projects = [{ ...project }];
});
describe("actual pipeline move handler", () => {
    it.each(["returned failure", "thrown reply"])("restores server-provided status and displays uncertainty after %s", async kind => {
        if (kind === "returned failure") current.ordinary.mockResolvedValue({ success: false, error: "The change could not be confirmed. It may have saved." });
        else current.ordinary.mockRejectedValue(new Error("private transport detail"));
        click("Start Estimating")(); await settle();
        expect(text(column("Lead"))).toContain("QA Example"); expect(text(column("Estimating"))).not.toContain("QA Example");
        const alert = nodes(view()).find(e => e.props.role === "alert"); expect(alert).toBeDefined();
        expect(text(alert)).toMatch(/confirm|saved|reload/i); expect(text(alert)).not.toContain("private transport detail");
    });
    it("fences immediate duplicate clicks before React has rerendered the disabled controls", async () => {
        const wait = held(); current.ordinary.mockReturnValue(wait.promise);
        const move = click("Start Estimating"); move(); move();
        expect(current.ordinary).toHaveBeenCalledTimes(1);
        wait.resolve({ success: true }); await settle();
    });
    it("keeps confirmed optimistic movement until fresh server props arrive", async () => {
        click("Start Estimating")(); await settle(); expect(text(column("Estimating"))).toContain("QA Example");
        expect(current.refresh).toHaveBeenCalledOnce();
        projects = [{ ...project, status: "Lost" }];
        expect(text(column("Lost"))).toContain("QA Example"); expect(text(column("Estimating"))).not.toContain("QA Example");
    });
    it("calls the existing Won action only on the explicit existing Won control and rolls back rejection", async () => {
        projects = [{ ...project, status: "Proposal Sent" }]; current.won.mockResolvedValue({ success: false, error: "Could not confirm." });
        click("Mark as Won")(); await settle();
        expect(current.won).toHaveBeenCalledExactlyOnceWith("job"); expect(current.ordinary).not.toHaveBeenCalled();
        expect(text(column("Proposal Sent"))).toContain("QA Example"); expect(text(column("Active"))).not.toContain("QA Example");
    });
    it("preserves a confirmed move but gives a warning if refresh fails", async () => {
        current.refresh.mockImplementation(() => { throw Error("refresh failure"); });
        click("Start Estimating")(); await settle();
        expect(text(column("Estimating"))).toContain("QA Example"); expect(text(view())).toMatch(/saved.*refresh|saved.*reload/i);
    });
    it("preserves server-confirmed success when the action reports cache refresh failure", async () => {
        current.ordinary.mockResolvedValue({ success: true, warning: "The stage was saved, but the view could not refresh. Reload the pipeline." });
        click("Start Estimating")(); await settle();
        expect(text(column("Estimating"))).toContain("QA Example"); expect(text(view())).toContain("stage was saved");
    });
    it("releases the fence for a deliberate retry, without automatic resubmission", async () => {
        current.ordinary.mockResolvedValueOnce({ success: false, error: "Could not confirm. It may have saved." });
        click("Start Estimating")(); await settle(); expect(current.ordinary).toHaveBeenCalledTimes(1);
        click("Start Estimating")(); await settle(); expect(current.ordinary).toHaveBeenCalledTimes(2);
        expect(text(column("Estimating"))).toContain("QA Example");
    });
});
