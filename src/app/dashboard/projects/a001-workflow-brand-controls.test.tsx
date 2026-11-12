import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { coreFocusVisibleRing, corePrimaryButton } from "@/lib/core-editing-palette";

// A001 remaining workflow brand controls: the real job tab bar, projects error
// retry, drawing takeoff add actions and archive restore confirm. Classes are
// checked on the real elements (a source/markup check, not computed contrast);
// handlers, disabled rules and semantic colours must stay exactly as they were.
const current = vi.hoisted(() => ({
    slots: [] as unknown[], cursor: 0, seed: new Map<number, unknown>(), theme: "dark", pending: false,
    transitions: [] as (() => unknown)[], refresh: vi.fn(),
}));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = current.seed.has(i) ? current.seed.get(i) : typeof initial === "function" ? (initial as () => unknown)() : initial;
        return [current.slots[i], (next: unknown) => { current.slots[i] = typeof next === "function" ? (next as (v: unknown) => unknown)(current.slots[i]) : next; }];
    },
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: () => {},
    useCallback: (fn: unknown) => fn,
    useTransition: () => [current.pending, (fn: () => unknown) => { current.transitions.push(fn); }],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: current.refresh, push: vi.fn() }) }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: current.theme, setTheme: vi.fn() }) }));
vi.mock("@/lib/observability", () => ({ reportError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("./drawings/actions", () => ({ analyzeDrawingPagesAction: vi.fn(), addItemsToEstimateAction: vi.fn(async () => ({ success: true, added: 1 })) }));
vi.mock("./drawings/drawing-viewer", () => ({ default: () => null }));
vi.mock("./archive/actions", () => ({ restoreProjectAction: vi.fn(async () => ({})) }));

import ProjectNavBar from "@/components/project-navbar";
import ProjectsError from "./error";
import DrawingsClient from "./drawings/drawings-client";
import ArchiveClient from "./archive/archive-client";
import { addItemsToEstimateAction } from "./drawings/actions";
import { restoreProjectAction } from "./archive/actions";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const e = value as Element; return [e, ...nodes(e.props.children)];
}
function text(value: unknown): string {
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(text).join("");
    if (value && typeof value === "object" && "props" in value) return text((value as Element).props.children);
    return "";
}
/** Render a function component with the controlled hooks, expanding nested local components. */
function tree(element: Element): Element[] {
    const out = (element.type as (p: Record<string, unknown>) => unknown)(element.props);
    return nodes(out).flatMap(e => typeof e.type === "function" && localComponents.has(e.type.name) ? [e, ...tree(e)] : [e]);
}
const localComponents = new Set(["ExtractionResultsPanel", "DrawingRegister"]);
const button = (els: Element[], label: RegExp) => els.find(e => (e.type === "button" || (typeof e.type !== "string" && e.props.onClick)) && label.test(text(e.props.children)))!;
const className = (e: Element) => String(e.props.className ?? "");
function expectBrandPrimary(e: Element) {
    expect(className(e)).toContain(corePrimaryButton);
    expect(className(e)).toContain(coreFocusVisibleRing);
    expect(className(e)).not.toMatch(/blue/);
}

const item = (name: string, section: string) => ({ item_name: name, estimated_quantity: 3, unit: "m2", suggested_rate: 10, trade_section: section, library_match: null });
const extraction = (id: string) => ({
    id, project_id: "job-1", filename: `${id}.pdf`, file_size_kb: 12, format: "pdf", page_count: 1, pages_processed: 1,
    extracted_items: [item("Blockwork", "Masonry"), item("Screed", "Floors")], status: "processed", error_message: null, created_at: "2026-10-01T00:00:00Z",
});
const archived = {
    id: "arch-1", name: "Old kitchen", client_name: "Client", site_address: null, project_type: "Kitchen", archived_at: "2026-09-01", archive_reason: null, start_date: null,
    archive_snapshots: [{ contract_value: 1000, total_costs_posted: 800, gross_margin_pct: 20, total_invoiced: 1000, total_paid: 1000, retention_outstanding: 0, final_account_amount: 1000, final_account_status: "agreed", planned_duration_days: 10, actual_duration_days: 12, programme_delay_days: 2, variation_count: 0, approved_variation_total: 0, snapshot_date: "2026-09-01" }],
};

beforeEach(() => {
    current.slots = []; current.cursor = 0; current.seed = new Map(); current.theme = "dark"; current.pending = false; current.transitions = []; current.refresh.mockReset();
    vi.mocked(addItemsToEstimateAction).mockClear(); vi.mocked(restoreProjectAction).mockClear();
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("A001 full-profile job tabs", () => {
    it.each(["dark", "light"])("%s: the active tab underline is the brand sage/emerald with a visible focus ring; routes and order unchanged", theme => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "full");
        current.theme = theme;
        const html = renderToStaticMarkup(<ProjectNavBar projectId="job-1" activeTab="drawings" />);
        expect(html).not.toMatch(/blue-/);
        const links = [...html.matchAll(/<a\b[^>]*>/g)].map(m => m[0]);
        expect(links.map(a => /href="\/dashboard\/projects\/(\w+)\?projectId=job-1"/.exec(a)![1])).toEqual(["overview", "brief", "costs", "drawings", "schedule", "contracts", "proposal", "communications"]);
        const active = links.filter(a => a.includes('aria-current="page"'));
        expect(active).toHaveLength(1);
        expect(active[0]).toContain("/dashboard/projects/drawings");
        expect(active[0]).toContain(theme === "dark" ? "border-[#c9efcf]" : "border-emerald-700");
        for (const a of links) expect(a).toContain(theme === "dark" ? "focus-visible:outline-[#c9efcf]" : "focus-visible:outline-emerald-700");
        // Idle tabs keep their existing neutral treatment.
        expect(links.filter(a => !a.includes("aria-current")).every(a => a.includes("border-transparent"))).toBe(true);
    });
});

describe("A001 projects error boundary", () => {
    it("retries with the brand primary and focus ring, still calling reset only; the red warning stays", () => {
        const reset = vi.fn();
        const els = nodes(ProjectsError({ error: Object.assign(new Error("x"), { digest: "d1" }), reset }));
        const retry = button(els, /Try again/);
        expectBrandPrimary(retry);
        expect(retry.props.type).toBe("button");
        (retry.props.onClick as () => void)();
        expect(reset).toHaveBeenCalledTimes(1);
        expect(els.filter(e => typeof e.props.href === "string").map(e => e.props.href)).toEqual(["/dashboard"]);
        expect(els.some(e => className(e).includes("text-red-400"))).toBe(true);
    });
});

describe("A001 drawing takeoff add actions", () => {
    function render(seed: [number, unknown][]) {
        current.cursor = 0; current.slots = []; current.seed = new Map(seed);
        // DrawingsClient states: 1 uploadState, 5 active extractions; then panel 7 selected (when shown);
        // with no panel the register follows at 7 expanded, 9 addingFor.
        return tree(<DrawingsClient projectId="job-1" projectName="Job" initialExtractions={[extraction("a"), extraction("b")] as never} /> as Element);
    }

    it("the results panel adds the selected items with the brand primary, and stays disabled with nothing selected", async () => {
        let els = render([[1, "done"], [5, [extraction("a")]]]);
        const add = button(els, /to Estimate/);
        expectBrandPrimary(add);
        expect(className(add)).toContain("disabled:opacity-50");
        expect(add.props.disabled).toBe(false);
        await (add.props.onClick as () => Promise<void>)();
        expect(addItemsToEstimateAction).toHaveBeenCalledWith("job-1", extraction("a").extracted_items);

        els = render([[1, "done"], [5, [extraction("a")]], [7, new Set()]]);
        expect(button(els, /to Estimate/).props.disabled).toBe(true);
    });

    it("the register's add-all uses the brand primary, is disabled while that drawing is adding, and keeps status colours", async () => {
        let els = render([[7, "a"]]);
        const addAll = button(els, /Add all to estimate/);
        expectBrandPrimary(addAll);
        expect(addAll.props.disabled).toBe(false);
        await (addAll.props.onClick as () => Promise<void>)();
        expect(addItemsToEstimateAction).toHaveBeenCalledWith("job-1", extraction("a").extracted_items);
        expect(els.some(e => className(e).includes("bg-emerald-900/60 text-emerald-400"))).toBe(true);

        els = render([[7, "a"], [9, "a"]]);
        expect(button(els, /Add all to estimate/).props.disabled).toBe(true);
    });
});

describe("A001 archive restore confirm", () => {
    function render(pending: boolean) {
        current.cursor = 0; current.slots = []; current.pending = pending;
        // ArchiveClient states: 2 expandedId, 4 confirmRestoreId.
        current.seed = new Map([[2, "arch-1"], [4, "arch-1"]]);
        return tree(<ArchiveClient projects={[archived]} /> as Element);
    }

    it("confirms with the brand primary, disabled while pending, still restoring that project only", async () => {
        let els = render(false);
        const confirm = button(els, /Confirm Restore/);
        expect(className(confirm)).toContain(corePrimaryButton);
        expect(className(confirm)).toContain(coreFocusVisibleRing);
        expect(className(confirm)).not.toMatch(/blue/);
        expect(confirm.props.disabled).toBe(false);
        (confirm.props.onClick as () => void)();
        await current.transitions[0]();
        expect(restoreProjectAction).toHaveBeenCalledWith("arch-1");
        expect(current.refresh).toHaveBeenCalledTimes(1);
        expect(button(els, /Cancel/).props.variant).toBe("outline");

        els = render(true);
        expect(button(els, /Confirm Restore/).props.disabled).toBe(true);
    });
});
