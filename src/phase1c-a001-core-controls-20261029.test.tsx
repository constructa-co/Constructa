/**
 * Phase1C A001 — core primary controls (source class contract on four scoped targets).
 * Mock RPC/actions only; not browser pixel or auth DB proof.
 */
import type { ReactElement } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    coreFocusRing,
    coreFocusVisibleRing,
    corePrimaryButton,
} from "@/lib/core-editing-palette";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

const rateState = vi.hoisted(() => ({
    slots: [] as unknown[],
    cursor: 0,
    seed: new Map<number, unknown>(),
}));

vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = rateState.cursor++;
        if (!(i in rateState.slots)) {
            rateState.slots[i] = rateState.seed.has(i)
                ? rateState.seed.get(i)
                : typeof initial === "function"
                  ? (initial as () => unknown)()
                  : initial;
        }
        return [
            rateState.slots[i],
            (next: unknown) => {
                rateState.slots[i] =
                    typeof next === "function" ? (next as (v: unknown) => unknown)(rateState.slots[i]) : next;
            },
        ];
    },
    useEffect: () => {},
    useRef: (initial: unknown) => ({ current: initial }),
}));

vi.mock("@/lib/observability", () => ({ reportError: vi.fn() }));
vi.mock("@/lib/launch-profile", () => ({ getLaunchLandingPath: () => "/dashboard/home" }));
vi.mock("@/app/dashboard/library/actions", () => ({
    upsertRateOverrideAction: vi.fn(),
    deleteRateOverrideAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/app/dashboard/library/templates-actions", () => ({
    addItemsToTemplateAction: vi.fn(),
}));
vi.mock("@/components/ui/select", () => ({
    Select: ({ children }: { children: React.ReactNode }) => createElement("div", { "data-select": true }, children),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => createElement("button", { type: "button" }, children),
    SelectValue: ({ placeholder }: { placeholder?: string }) => createElement("span", null, placeholder),
    SelectContent: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
    SelectGroup: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
    SelectLabel: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
    SelectItem: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
}));

import ProjectPicker from "@/components/project-picker";
import DashboardError from "@/app/dashboard/error";
import RateOverrideItem from "@/app/dashboard/library/rate-override-client";
import TemplateItemEditor from "@/app/dashboard/library/templates/[id]/template-item-editor";
import { upsertRateOverrideAction } from "@/app/dashboard/library/actions";
import { addItemsToTemplateAction } from "@/app/dashboard/library/templates-actions";

type Element = ReactElement<Record<string, unknown>>;

function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const el = value as Element;
    return [el, ...nodes(el.props.children)];
}

function tree(element: Element): Element[] {
    const out = (element.type as (p: Record<string, unknown>) => unknown)(element.props);
    return nodes(out);
}

const cn = (e: Element) => String(e.props.className ?? "");

function text(value: unknown): string {
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(text).join("");
    if (value && typeof value === "object" && "props" in value) return text((value as Element).props.children);
    return "";
}

function expectDashboardPrimary(classes: string) {
    expect(classes).toContain(corePrimaryButton);
    expect(classes).toContain(coreFocusVisibleRing);
    expect(classes).not.toMatch(/\bbg-blue-600\b|\bhover:bg-blue-700\b/);
    expect(classes).not.toContain("bg-[#b9f6a5]");
}

beforeEach(() => {
    router.push.mockReset();
    rateState.slots = [];
    rateState.cursor = 0;
    rateState.seed = new Map();
    vi.mocked(upsertRateOverrideAction).mockReset();
    vi.mocked(addItemsToTemplateAction).mockReset();
});

afterEach(() => vi.clearAllMocks());

describe("phase1c-a001-core-controls-20261029", () => {
    it("project-picker: empty-state primary CTA, search focus token, row focus, footer link stays ordinary blue; status pills semantic", () => {
        const htmlEmpty = renderToStaticMarkup(
            createElement(ProjectPicker, {
                projects: [],
                targetPath: "/dashboard/projects/billing",
                title: "Billing",
            }),
        );
        expect(htmlEmpty).toContain(corePrimaryButton);
        expect(htmlEmpty).not.toMatch(/New Project[\s\S]*bg-blue-600/);
        expect(htmlEmpty).not.toContain("bg-[#b9f6a5]");

        const projects = [
            { id: "p1", name: "Alpha", proposal_status: "sent", updated_at: new Date().toISOString() },
            { id: "p2", name: "Beta", proposal_status: "accepted", updated_at: new Date().toISOString() },
            { id: "p3", name: "Gamma", proposal_status: "viewed", updated_at: new Date().toISOString() },
            { id: "p4", name: "Delta", proposal_status: "draft", updated_at: new Date().toISOString() },
            { id: "p5", name: "Epsilon", proposal_status: "declined", updated_at: new Date().toISOString() },
            { id: "p6", name: "Zeta", client_name: "Client", updated_at: new Date().toISOString() },
        ];
        const htmlList = renderToStaticMarkup(
            createElement(ProjectPicker, {
                projects,
                targetPath: "/dashboard/projects/billing",
                title: "Billing",
            }),
        );
        expect(htmlList).toContain("focus:border-emerald-600");
        expect(htmlList).toContain(coreFocusRing);
        expect(htmlList).toContain("text-blue-500");
        expect(htmlList).toContain("bg-blue-500/15");
        expect(htmlList).toContain("bg-green-500/15");
        expect(htmlList).toContain("bg-purple-500/15");
        expect(htmlList).toContain("bg-red-500/15");

        const els = tree(
            createElement(ProjectPicker, {
                projects: [{ id: "only", name: "One", updated_at: new Date().toISOString() }],
                targetPath: "/dashboard/projects/p-and-l",
                title: "Job P&L",
            }) as unknown as Element,
        );
        const row = els.find(e => e.type === "button" && cn(e).includes(coreFocusVisibleRing))!;
        expect(row).toBeDefined();
        (row.props.onClick as () => void)();
        expect(router.push).toHaveBeenCalledWith("/dashboard/projects/p-and-l?projectId=only");
    });

    it("dashboard error: Try again primary approved green; Dashboard href preserved; reset handler attached not invoked", () => {
        const reset = vi.fn();
        const els = tree(
            createElement(DashboardError, {
                error: Object.assign(new Error("boom"), { digest: "abc123" }),
                reset,
            }) as Element,
        );
        const tryAgain = els.find(e => e.type === "button" && cn(e).includes(corePrimaryButton))!;
        expectDashboardPrimary(cn(tryAgain));
        expect(typeof tryAgain.props.onClick).toBe("function");
        expect(reset).not.toHaveBeenCalled();
        const dash = els.find(e => cn(e).includes("border-slate-700") && /Dashboard/.test(text(e.props.children)));
        expect(dash).toBeDefined();
        expect(cn(dash!)).toContain("border-slate-700");
    });

    it("rate override: save check control brand primary; upsert not called without click", () => {
        rateState.seed = new Map<number, unknown>([[0, true], [1, "12.5"], [2, false]]);
        const els = tree(
            createElement(RateOverrideItem, {
                item: {
                    id: "item-1",
                    code: "GW-01",
                    description: "Excavation",
                    unit: "m3",
                    base_rate: 10,
                    is_featured: false,
                    override: null,
                },
            }) as unknown as Element,
        );
        const save = els.find(e => cn(e).includes(corePrimaryButton) && e.props.disabled !== true)!;
        expect(save).toBeDefined();
        expectDashboardPrimary(cn(save));
        expect(upsertRateOverrideAction).not.toHaveBeenCalled();
        expect(els.some(e => cn(e).includes("text-amber-400"))).toBe(false);
    });

    it("template item editor: Add to Kit brand primary; disabled without selection; action not called", () => {
        const els = tree(
            createElement(TemplateItemEditor, {
                templateId: "tmpl-1",
                libraryItems: [{ id: "lib-1", category: "Groundworks", description: "Dig", unit: "m3", unit_cost: 50 }],
            }) as unknown as Element,
        );
        const add = els.find(e => cn(e).includes(corePrimaryButton) && cn(e).includes("font-bold"))!;
        expect(add).toBeDefined();
        expectDashboardPrimary(cn(add));
        expect(add.props.disabled).toBe(true);
        expect(addItemsToTemplateAction).not.toHaveBeenCalled();
    });
});
