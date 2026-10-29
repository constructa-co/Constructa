import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { coreFocusRing, coreFocusVisibleRing, corePrimaryButton } from "@/lib/core-editing-palette";

const current = vi.hoisted(() => ({
    slots: [] as unknown[],
    cursor: 0,
    seed: new Map<number, unknown>(),
    pending: false,
    transitions: [] as (() => unknown)[],
    refresh: vi.fn(),
}));

vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) {
            current.slots[i] = current.seed.has(i)
                ? current.seed.get(i)
                : typeof initial === "function"
                  ? (initial as () => unknown)()
                  : initial;
        }
        return [
            current.slots[i],
            (next: unknown) => {
                current.slots[i] =
                    typeof next === "function" ? (next as (v: unknown) => unknown)(current.slots[i]) : next;
            },
        ];
    },
    useEffect: () => {},
    useTransition: () => [current.pending, (fn: () => unknown) => { current.transitions.push(fn); }],
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: current.refresh, push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/install-banner", () => ({ default: () => null }));
vi.mock("@/app/dashboard/projects/p-and-l/actions", () => ({ logCostAction: vi.fn(async () => ({})) }));
vi.mock("./resources/staff/actions", () => ({
    upsertStaffResourceAction: vi.fn(async () => ({})),
    deleteStaffResourceAction: vi.fn(async () => ({})),
}));

import { toast } from "sonner";
import MobileHubClient from "./mobile/mobile-hub-client";
import StaffResourcesClient, { type StaffRow } from "./resources/staff/staff-client";
import { logCostAction } from "@/app/dashboard/projects/p-and-l/actions";
import { upsertStaffResourceAction } from "./resources/staff/actions";

type Element = ReactElement<Record<string, unknown>>;

function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const el = value as Element;
    return [el, ...nodes(el.props.children)];
}

function text(value: unknown): string {
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(text).join("");
    if (value && typeof value === "object" && "props" in value) return text((value as Element).props.children);
    return "";
}

/** Renders a component and expands only the named local function components (not shared UI). */
function tree(element: Element, expand: string[] = []): Element[] {
    const out = nodes((element.type as (p: Record<string, unknown>) => unknown)(element.props));
    return out.flatMap(e =>
        typeof e.type === "function" && expand.includes((e.type as { name: string }).name) ? [e, ...tree(e, expand)] : [e]);
}

function render(element: Element, expand: string[] = []) {
    current.cursor = 0;
    return tree(element, expand);
}

const className = (e: Element) => String(e.props.className ?? "");
const byText = (els: Element[], label: RegExp) => els.find(e => label.test(text(e.props.children)) && typeof e.props.onClick === "function"
    || (e.props.type === "submit" && label.test(text(e.props.children))))!;

function expectBrandPrimary(e: Element) {
    expect(className(e)).toContain(corePrimaryButton);
    expect(className(e)).toContain(coreFocusVisibleRing);
    expect(className(e)).not.toMatch(/\bbg-blue-600\b|\bhover:bg-blue-700\b|\bshadow-blue-/);
}

beforeEach(() => {
    current.slots = [];
    current.cursor = 0;
    current.seed = new Map();
    current.pending = false;
    current.transitions = [];
    current.refresh.mockReset();
    vi.mocked(logCostAction).mockClear();
    vi.mocked(upsertStaffResourceAction).mockClear();
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
});

// ── Mobile hub: useState slots 0 selectedId, 1 fabOpen, 2 fabSaving, 3 fabAmount, 4 fabDesc, 5 fabType ──

const projects = [{ id: "job-1", name: "Kitchen", client_name: "Ms Patel" }, { id: "job-2", name: "Loft" }];
const recentCosts = [{ id: "c1", description: "Skip", amount: 240, created_at: "2026-10-29T08:00:00Z", projects: { name: "Kitchen" } }];
const mobile = (props: Partial<Parameters<typeof MobileHubClient>[0]> = {}) =>
    <MobileHubClient projects={projects} recentCosts={recentCosts} recentVars={[]} {...props} /> as Element;

describe("A001 mobile hub primary controls", () => {
    it("closed: the floating quick-log button is brand primary and only opens the sheet", () => {
        const els = render(mobile());
        const fab = els.find(e => e.props["aria-label"] === "Quick log cost")!;
        expectBrandPrimary(fab);
        (fab.props.onClick as () => void)();
        expect(current.slots[1]).toBe(true);
        expect(logCostAction).not.toHaveBeenCalled();
    });

    it("open: Log Cost is brand primary, disabled while saving or with no project, and inputs use the brand focus ring", () => {
        current.seed = new Map([[1, true]]);
        let els = render(mobile());
        const save = byText(els, /Log Cost$/);
        expectBrandPrimary(save);
        expect(save.props.disabled).toBe(false);
        for (const input of els.filter(e => e.type === "input")) {
            expect(className(input)).toContain(coreFocusRing);
            expect(className(input)).not.toMatch(/ring-blue/);
        }

        current.slots = [];
        current.seed = new Map<number, unknown>([[1, true], [2, true]]);
        els = render(mobile());
        const saving = byText(els, /Saving…/);
        expect(saving.props.disabled).toBe(true);
        expectBrandPrimary(saving);

        current.slots = [];
        current.seed = new Map([[1, true]]);
        els = render(mobile({ projects: [] }));
        expect(byText(els, /Log Cost$/).props.disabled).toBe(true);
    });

    it("selected cost type and selected project use brand selection; choosing changes only local state", () => {
        current.seed = new Map([[1, true]]);
        const els = render(mobile());
        const materials = els.find(e => e.type === "button" && text(e.props.children) === "materials")!;
        const plant = els.find(e => e.type === "button" && text(e.props.children) === "plant")!;
        expect(className(materials)).toContain(corePrimaryButton);
        expect(className(materials)).not.toMatch(/bg-blue-600/);
        expect(className(plant)).toContain("bg-slate-800");
        expect(className(plant)).toContain(coreFocusVisibleRing);
        (plant.props.onClick as () => void)();
        expect(current.slots[5]).toBe("plant");

        const kitchen = els.find(e => e.type === "button" && text(e.props.children).startsWith("Kitchen"))!;
        const loft = els.find(e => e.type === "button" && text(e.props.children).startsWith("Loft"))!;
        expect(className(kitchen)).toContain("border-emerald-600");
        expect(className(kitchen)).not.toMatch(/blue/);
        expect(className(loft)).toContain("bg-slate-900");
        expect(className(loft)).toContain(coreFocusVisibleRing);
        (loft.props.onClick as () => void)();
        expect(current.slots[0]).toBe("job-2");
        expect(logCostAction).not.toHaveBeenCalled();
    });

    it("semantic and category blues are untouched", () => {
        const els = render(mobile());
        expect(els.some(e => className(e).includes("bg-blue-600") && className(e).includes("rounded-xl flex"))).toBe(true);
        expect(els.some(e => className(e).includes("bg-violet-600"))).toBe(true);
        expect(els.some(e => className(e) === "w-3.5 h-3.5 text-blue-400")).toBe(true);
        expect(els.some(e => className(e).includes("group-hover:text-blue-300"))).toBe(true);
    });

    it("quick-log handler keeps its exact validation and payload", async () => {
        current.seed = new Map<number, unknown>([[1, true], [3, "abc"], [4, "Timber"], [5, "plant"]]);
        let els = render(mobile());
        await (byText(els, /Log Cost$/).props.onClick as () => Promise<void>)();
        expect(toast.error).toHaveBeenCalledWith("Enter a valid amount");
        expect(logCostAction).not.toHaveBeenCalled();

        current.slots = [];
        current.seed = new Map<number, unknown>([[1, true], [3, "12.5"], [4, "  Timber delivery "], [5, "plant"]]);
        els = render(mobile());
        await (byText(els, /Log Cost$/).props.onClick as () => Promise<void>)();
        expect(logCostAction).toHaveBeenCalledWith({
            projectId: "job-1",
            description: "Timber delivery",
            amount: 12.5,
            cost_type: "plant",
            trade_section: "General",
            expense_date: new Date().toISOString().slice(0, 10),
        });
        expect(toast.success).toHaveBeenCalledWith("£12.50 logged to Kitchen");
        expect(current.slots[1]).toBe(false);
        expect(current.slots[2]).toBe(false);
    });
});

// ── Staff: parent slots 0 dialogOpen, 1 editingRow; dialog slot 2 form ──

const fullRow: StaffRow = {
    id: "s1", user_id: "u1", title: "Ms", first_name: "Sarah", last_name: "Johnson", name: "", job_title: "Site Manager",
    role: null, rate_mode: "full", hourly_chargeout_rate: 0, overtime_chargeout_rate: 0, annual_salary: 40_000,
    employer_ni_pct: 13.8, employer_pension_pct: 3, company_car_annual: 0, car_allowance_annual: 0, mobile_phone_annual: 0,
    it_costs_annual: 0, life_insurance_annual: 0, other_benefits_annual: 0, annual_working_days: 260, holiday_days: 28,
    public_holiday_days: 8, overhead_absorption_pct: 15, profit_uplift_pct: 10, notes: null, is_active: true,
};
const staffPage = (staff: StaffRow[] = [fullRow]) => <StaffResourcesClient staff={staff} /> as Element;
const DIALOG = ["StaffFormDialog", "NumericInput"];

describe("A001 staff editor primary controls", () => {
    it("toolbar and empty-state Add buttons are brand primary and only open the dialog", () => {
        let els = render(staffPage());
        const add = els.find(e => typeof e.props.onClick === "function" && text(e.props.children).includes("Add Staff Member"))!;
        expectBrandPrimary(add);
        current.slots[1] = fullRow;
        (add.props.onClick as () => void)();
        expect(current.slots).toEqual([true, null]);

        current.slots = [];
        els = render(staffPage([]));
        const adds = els.filter(e => typeof e.props.onClick === "function" && text(e.props.children).includes("Add Staff Member"));
        expect(adds).toHaveLength(2);
        adds.forEach(expectBrandPrimary);
        expect(upsertStaffResourceAction).not.toHaveBeenCalled();
    });

    it("dialog submit is brand primary and shows the pending state; inputs and title select use the brand focus", () => {
        current.seed = new Map([[0, true]]);
        let els = render(staffPage(), DIALOG);
        const submit = els.find(e => e.props.type === "submit")!;
        expectBrandPrimary(submit);
        expect(text(submit.props.children)).toBe("Add Staff Member");
        expect(submit.props.disabled).toBe(false);
        const fields = els.filter(e => /focus:border-/.test(className(e)));
        expect(fields.length).toBeGreaterThanOrEqual(5);
        for (const field of fields) {
            expect(className(field)).toContain("focus:border-emerald-600");
            expect(className(field)).toContain("focus-visible:ring-emerald-600");
            expect(className(field)).not.toMatch(/focus:border-blue-500/);
        }
        const trigger = els.find(e => className(e).includes("w-24"))!;
        expect(className(trigger)).toContain("focus:ring-emerald-600");
        expect(className(trigger)).not.toMatch(/ring-blue/);

        current.slots = [];
        current.pending = true;
        els = render(staffPage(), DIALOG);
        const pending = els.find(e => e.props.type === "submit")!;
        expect(pending.props.disabled).toBe(true);
        expect(text(pending.props.children)).toBe("Saving…");
        expectBrandPrimary(pending);
    });

    it("rate mode tiles use brand selection and still only change the form's rate mode", () => {
        current.seed = new Map([[0, true]]);
        const els = render(staffPage(), DIALOG);
        const simple = els.find(e => e.type === "button" && text(e.props.children).includes("Simple Rate"))!;
        const full = els.find(e => e.type === "button" && text(e.props.children).includes("Full Cost Buildup"))!;
        expect(className(simple)).toContain("border-emerald-600");
        expect(className(simple)).not.toMatch(/blue/);
        expect(className(full)).toContain("border-border bg-input/40");
        expect(className(full)).toContain(coreFocusVisibleRing);
        expect(els.some(e => e.type === "p" && className(e).includes("text-emerald-200") && text(e.props.children) === "Simple Rate")).toBe(true);
        (full.props.onClick as () => void)();
        expect((current.slots[2] as { rate_mode: string }).rate_mode).toBe("full");
    });

    it("Full Buildup badge and daily chargeout figure keep their semantic blue", () => {
        const els = render(staffPage());
        expect(els.some(e => className(e).includes("bg-blue-900/50 text-blue-300") && text(e.props.children) === "Full Buildup")).toBe(true);
        expect(els.some(e => className(e) === "text-blue-300 font-semibold")).toBe(true);
    });

    it("submit keeps its exact name validation and action payload", async () => {
        current.seed = new Map([[0, true]]);
        let els = render(staffPage(), DIALOG);
        const form = () => els.find(e => e.type === "form")!;
        (form().props.onSubmit as (e: { preventDefault(): void }) => void)({ preventDefault: () => {} });
        expect(toast.error).toHaveBeenCalledWith("Please enter at least a first or last name");
        expect(current.transitions).toHaveLength(0);

        current.slots = [];
        current.seed = new Map<number, unknown>([[0, true]]);
        els = render(staffPage(), DIALOG);
        current.slots[2] = { ...(current.slots[2] as object), first_name: "Sarah", hourly_chargeout_rate: 45 };
        els = render(staffPage(), DIALOG);
        (form().props.onSubmit as (e: { preventDefault(): void }) => void)({ preventDefault: () => {} });
        expect(current.transitions).toHaveLength(1);
        await current.transitions[0]();
        expect(upsertStaffResourceAction).toHaveBeenCalledTimes(1);
        expect(vi.mocked(upsertStaffResourceAction).mock.calls[0][0]).toMatchObject({ first_name: "Sarah", rate_mode: "simple", hourly_chargeout_rate: 45 });
        expect(toast.success).toHaveBeenCalledWith("Staff member added");
    });
});
