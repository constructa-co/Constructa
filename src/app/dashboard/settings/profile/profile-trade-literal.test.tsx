import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A031: the actual ProfileForm through the same controlled-hook seam as the
// public response transport test. Imports nothing new, so a missing group or
// control is a behavioural failure, not an import error.
const current = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, save: vi.fn(), guard: vi.fn() }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = typeof initial === "function" ? (initial as () => unknown)() : initial;
        return [current.slots[i], (next: unknown) => { current.slots[i] = typeof next === "function" ? (next as (v: unknown) => unknown)(current.slots[i]) : next; }];
    },
    useRef: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = { current: initial };
        return current.slots[i];
    },
    useEffect: () => undefined,
}));
vi.mock("./actions", () => ({ updateProfileAction: current.save, rewriteWithAIAction: vi.fn(), rewriteMdMessageAction: vi.fn() }));
vi.mock("@/app/storage/actions", () => ({ uploadProfileImageAction: vi.fn() }));
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: current.guard }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import ProfileForm from "./profile-form";

// The existing 59 names in their existing order, written out here.
const ALL = [
    "Site Setup & Preliminaries", "Demolition & Strip Out", "Asbestos Removal", "Temporary Works / Propping / Shoring", "Groundworks & Civils", "Drainage",
    "Utilities – Water", "Utilities – Gas", "Utilities – Electric / Ducting", "Utilities – Telecoms / Data Ducting", "Attenuation / SuDS / Stormwater",
    "Piling", "Underpinning & Structural Stabilisation", "Concrete / RC Works", "Steel Frame / Steel Erection", "Structural Timber / Framing",
    "Masonry / Brickwork / Blockwork", "Cladding & Rainscreen", "Roofing", "Waterproofing", "Insulation", "Windows, Doors & Glazing",
    "Builders / General Building", "Landscaping & External Works", "Surfacing, Paving & Kerbing", "Fencing & Gates",
    "Swimming Pools & Water Features", "Signage", "Line Marking & Road Furniture", "External Lighting", "Domestic Electrical", "Commercial Electrical",
    "Industrial Electrical", "EV Chargers", "Street Electrical / Feeder Pillars", "Substations", "Domestic Plumbing", "Commercial Plumbing / Public Health",
    "Mechanical / HVAC", "Domestic Heating", "Air Conditioning / Refrigeration", "Fire Alarm & Life Safety", "Security / CCTV / Access Control",
    "Drylining & Partitions", "Plastering & Rendering", "Carpentry & Joinery", "Kitchen Installation", "Bathroom Installation", "Tiling", "Flooring",
    "Ceilings", "Painting & Decorating", "Fire Stopping", "Passive Fire Protection / Intumescent", "Diamond Drilling & Sawing",
    "Builderswork in Connection", "Specialist Finishes", "Waste Management / Logistics", "Scaffolding & Access",
];

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function text(value: unknown): string {
    if (Array.isArray(value)) return value.map(text).join("");
    if (typeof value === "string" || typeof value === "number") return String(value);
    return value && typeof value === "object" && "props" in value ? text((value as Element).props.children) : "";
}
let profile: Record<string, unknown> = {};
function view() {
    current.cursor = 0;
    const tree = nodes(ProfileForm({ profile: profile as never, userEmail: "sam@example.invalid" }));
    const details = tree.find(e => e.type === "details" && e.props["data-profile-trade-preferences"] !== undefined)!;
    const inside = nodes(details.props.children);
    const buttons = inside.filter(e => e.type === "button");
    return {
        tree, details, inside, buttons,
        labels: buttons.map(b => text(b.props.children)),
        pressed: buttons.filter(b => b.props["aria-pressed"] === true).map(b => text(b.props.children)),
        saved: JSON.parse(String(tree.find(e => e.type === "form")!.props["data-preferred-trades"])) as string[],
        reason: text(inside.filter(e => e.props["data-profile-trade-matches"] !== undefined)),
    };
}
const listed = (labels: string[]) => labels.filter(label => ALL.includes(label));
const type = (value: string) => {
    const input = view().tree.find(e => e.props.name === "business_type")!;
    const onChange = input.props.onChange as ((event: { target: { value: string } }) => void) | undefined;
    if (onChange) onChange({ target: { value } });
};
const click = (label: string) => (view().buttons.find(b => text(b.props.children) === label)!.props.onClick as () => void)();
const withoutMatches = (first: string[]) => [...first, ...ALL.filter(name => !first.includes(name))];

beforeEach(() => { current.slots = []; current.cursor = 0; current.save.mockReset(); });

describe("A031 trade discovery from the contractor's own work description", () => {
    it("shows whole existing names written in the description first, with the reason, and selects nothing", () => {
        profile = { company_name: "Example", business_type: "Groundworks & Civils, drainage and small extensions", preferred_trades: [] };
        const v = view();
        expect(listed(v.labels)).toEqual(withoutMatches(["Groundworks & Civils", "Drainage"]));
        expect(new Set(listed(v.labels)).size).toBe(59);
        expect(v.reason).toMatch(/Matches words you wrote/);
        expect(v.reason).toMatch(/nothing is chosen for you/i);
        expect(v.pressed).toEqual([]);
        expect(v.saved).toEqual([]);
        expect(v.details.props.open).toBeFalsy();
    });

    it.each([
        ["no description", ""],
        ["a stem only", "groundwork and drains"],
        ["a description that does not contain a whole name", "Kitchen and bathroom fitting"],
        ["one part of a compound name", "Brickwork and masonry repairs"],
        ["a word with no trade name", "Hempcrete and lime specialist"],
    ])("leaves the list exactly as before for %s", (_label, business_type) => {
        profile = { company_name: "Example", business_type, preferred_trades: [] };
        const v = view();
        expect(listed(v.labels)).toEqual(ALL);
        expect(v.reason).toBe("");
    });

    it("matches a whole name inside other words, ignoring case and punctuation", () => {
        profile = { company_name: "Example", business_type: "Kitchen and bathroom fitting, TILING, roofing.", preferred_trades: [] };
        expect(listed(view().labels)).toEqual(withoutMatches(["Roofing", "Tiling"]));
    });

    it("updates as the description is typed, without changing saved choices", () => {
        profile = { company_name: "Example", business_type: "", preferred_trades: ["Piling"] };
        type("Roofing and insulation");
        const v = view();
        expect(listed(v.labels).slice(0, 2)).toEqual(["Roofing", "Insulation"]);
        expect(v.saved).toEqual(["Piling"]);
        expect(current.save).not.toHaveBeenCalled();
    });

    it("shows an already chosen matching name once, still chosen", () => {
        profile = { company_name: "Example", business_type: "Roofing", preferred_trades: ["Roofing"] };
        const v = view();
        expect(v.labels.filter(label => label === "Roofing")).toHaveLength(1);
        expect(listed(v.labels)[0]).toBe("Roofing");
        expect(v.pressed).toEqual(["Roofing"]);
    });
});

describe("A031 the contractor's own stored labels", () => {
    it("shows each stored label outside the list as its own chosen button, exactly as stored", () => {
        profile = { company_name: "Example", business_type: "", preferred_trades: ["Kitchen Installation", "Legacy specialist <work>", " roofing "] };
        const v = view();
        expect(v.pressed).toEqual(expect.arrayContaining(["Legacy specialist <work>", " roofing ", "Kitchen Installation"]));
        expect(v.labels.filter(label => label === " roofing ")).toHaveLength(1);
        expect(listed(v.labels)).toEqual(ALL);
    });

    it("removes a stored label only on a deliberate click, keeps it available to put back, and never rewrites it", () => {
        profile = { company_name: "Example", business_type: "Roofing", preferred_trades: ["Legacy specialist <work>", "Piling"] };
        expect(view().saved).toEqual(["Legacy specialist <work>", "Piling"]);
        click("Legacy specialist <work>");
        let v = view();
        expect(v.saved).toEqual(["Piling"]);
        expect(v.labels).toContain("Legacy specialist <work>");
        expect(v.pressed).not.toContain("Legacy specialist <work>");
        click("Legacy specialist <work>");
        v = view();
        expect(v.saved).toEqual(["Piling", "Legacy specialist <work>"]);
        expect(current.save).not.toHaveBeenCalled();
    });
});
