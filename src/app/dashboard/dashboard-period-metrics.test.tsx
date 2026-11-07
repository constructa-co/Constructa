import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ states: [] as unknown[], index: 0, boardIds: [] as string[], listIds: [] as string[] }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = hooks.index++;
        if (!(index in hooks.states)) hooks.states[index] = initial;
        return [hooks.states[index], (value: unknown) => { hooks.states[index] = value; }];
    },
    useMemo: (calculate: () => unknown) => calculate(),
}));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("./project-board", () => ({ default: ({ projects }: { projects: Array<{ id: string }> }) => {
    hooks.boardIds = projects.map(p => p.id); return <div data-mocked-board />;
} }));
vi.mock("./project-list", () => ({ default: ({ projects }: { projects: Array<{ id: string }> }) => {
    hooks.listIds = projects.map(p => p.id); return <div data-mocked-list />;
} }));
import DashboardClient from "./dashboard-client";

type Node = ReactElement<{ children?: ReactNode; onClick?: () => void; onChange?: (e: { target: { value: string } }) => void; placeholder?: string }>;
const nodes = (value: ReactNode): Node[] => {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Node;
    return [node, ...nodes(node.props.children)];
};
const zero = { totalPipelineValue: 0, proposalsSent: 0, wonThisMonth: 0, activeJobs: 0, winRate: 0, winRateSampleSize: 0, totalRevenueSigned: 0 };
const at = (month: number, day: number, hour = 0, minute = 0, second = 0, millisecond = 0) => new Date(2026, month, day, hour, minute, second, millisecond).toISOString();
const project = (id: string, date: string, value: number) => ({ id, name: `Synthetic ${id}`, client_name: `Client ${id}`, project_type: "Synthetic work", status: "Won", potential_value: value, created_at: date, proposal_sent_at: date, proposal_accepted_at: date });
function tree(projects: ReturnType<typeof project>[], financials: Record<string, number> = {}) {
    hooks.index = 0;
    return DashboardClient({ projects, financials, metrics: zero, companyName: "Synthetic builders" });
}
function metric(view: ReactNode, label: string) {
    const group = nodes(view).find(node => Array.isArray(node.props.children) && (node.props.children[1] as Node | undefined)?.props?.children === label);
    expect(group, label).toBeDefined();
    return ((group!.props.children as ReactNode[])[0] as Node).props.children;
}
function choose(view: ReactNode, label: string) {
    const button = nodes(view).find(node => node.type === "button" && node.props.children === label);
    expect(button, label).toBeDefined(); button!.props.onClick!();
}
beforeEach(() => {
    hooks.states = []; hooks.index = 0; hooks.boardIds = []; hooks.listIds = [];
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 25, 12));
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("actual dashboard period metrics", () => {
    it.each([
        ["This Week", at(9, 19), at(9, 25, 23, 59, 59, 999)],
        ["This Month", at(9, 1), at(9, 31, 23, 59, 59, 999)],
        ["This Quarter", at(9, 1), at(11, 31, 23, 59, 59, 999)],
        ["This Year", at(0, 1), at(11, 31, 23, 59, 59, 999)],
    ])("includes the complete final second of %s but neither neighbouring period", (period, start, end) => {
        const projects = [project("start", start, 101), project("end", end, 202), project("before", new Date(Date.parse(start) - 1).toISOString(), 303), project("after", new Date(Date.parse(end) + 1).toISOString(), 404)];
        const financials = { start: 201, end: 402 };
        choose(tree(projects, financials), period);
        const view = tree(projects, financials);
        expect(metric(view, "Pipeline Value")).toBe("\u00a3603");
        expect(metric(view, "Proposals Sent")).toBe("2");
        expect(metric(view, "Projects Won")).toBe("2");
        expect(metric(view, "Revenue Signed")).toBe("\u00a3603");
        // These two existing metrics remain all-time, not redefined by this repair.
        expect(metric(view, "Active Jobs")).toBe("4");
        expect(metric(view, "Win Rate")).toBe("100%");
    });

    it("recalculates actual cards when changing the existing month/week/quarter/year controls", () => {
        const projects = [project("week", at(9, 20), 13), project("month", at(9, 2), 19), project("quarter", at(10, 1), 29), project("year", at(1, 1), 37)];
        expect(metric(tree(projects), "Pipeline Value")).toBe("\u00a332");
        for (const [period, total, count] of [["This Week", 13, 1], ["This Quarter", 61, 3], ["This Year", 98, 4], ["This Month", 32, 2]] as const) {
            choose(tree(projects), period);
            const view = tree(projects);
            expect(metric(view, "Pipeline Value")).toBe(`\u00a3${total}`);
            expect(metric(view, "Proposals Sent")).toBe(String(count));
            expect(metric(view, "Projects Won")).toBe(String(count));
            expect(metric(view, "Revenue Signed")).toBe(`\u00a3${total}`);
        }
    });

    it("keeps client/project search case-insensitive in board and list without redefining global KPIs", () => {
        const projects = [project("alpha", at(9, 20), 13), project("beta", at(9, 2), 19)];
        const input = nodes(tree(projects)).find(node => node.props.placeholder === "Search by client or project name...")!;
        input.props.onChange!({ target: { value: "cLIent BETA" } });
        let view = tree(projects); renderToStaticMarkup(view);
        expect(hooks.boardIds).toEqual(["beta"]);
        expect(metric(view, "Pipeline Value")).toBe("\u00a332");
        // Board/List captions include icons, so use their existing click order.
        const toggles = nodes(view).filter(node => node.type === "button" && Array.isArray(node.props.children));
        const list = toggles.find(node => (node.props.children as ReactNode[]).includes("List"))!;
        list.props.onClick!(); view = tree(projects); renderToStaticMarkup(view);
        expect(hooks.listIds).toEqual(["beta"]);
        input.props.onChange!({ target: { value: "SYNTHETIC ALPHA" } });
        renderToStaticMarkup(tree(projects)); expect(hooks.listIds).toEqual(["alpha"]);
        input.props.onChange!({ target: { value: "no matching job" } });
        renderToStaticMarkup(tree(projects)); expect(hooks.listIds).toEqual([]);
        input.props.onChange!({ target: { value: "" } });
        renderToStaticMarkup(tree(projects)); expect(hooks.listIds).toEqual(["alpha", "beta"]);
    });
});
