import type { ReactElement } from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { briefReducer, initialBriefState, BRIEF_STAGES, CLIENT_TYPES, type BriefStore, type BriefState } from "@/lib/guided-brief";
const current = vi.hoisted(() => ({ theme: "dark", store: null as unknown as BriefStore, slots: [] as unknown[], cursor: 0, push: vi.fn(), fetch: vi.fn(), save: vi.fn(), ask: vi.fn() }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(), useEffect: () => undefined,
    useState: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = typeof initial === "function" ? initial() : initial;
        return [current.slots[i], (next: unknown) => { current.slots[i] = typeof next === "function" ? next(current.slots[i]) : next; }];
    },
    useRef: (initial: unknown) => ({ current: initial }),
}));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [current.store.getState(), current.store] }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: current.push }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: current.theme }) }));
vi.mock("./actions", () => ({ saveBriefAction: vi.fn(), suggestBriefAction: vi.fn() }));
import BriefClient from "./brief-client";
type Element = ReactElement<Record<string, unknown>>;
const project = { id: "labelled-unit-job", name: "Unit-test job", client_name: "Client", site_address: "Existing site", postcode: "", brief_scope: "Replace the roof.", brief_trade_sections: [] as string[], client_type: "domestic", potential_value: null, start_date: "", lat: null, lng: null, region: "", brief_completed: false };
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const e = value as Element; return [e, ...nodes(e.props.children)];
}
function text(value: unknown): string {
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(text).join("");
    return value && typeof value === "object" && "props" in value ? text((value as Element).props.children) : "";
}
function view() { current.cursor = 0; return BriefClient({ project, save: current.save, ask: current.ask }); }
function button(label: string) { return nodes(view()).find(e => e.type === "button" && text(e.props.children).trim() === label)!; }
function click(e: Element) { (e.props.onClick as () => unknown)(); }
const selectedClasses = ["border-[var(--brief-accent)]", "bg-[var(--brief-accent)]", "text-[var(--brief-accent-text)]"];
beforeEach(() => {
    let state: BriefState = initialBriefState(project);
    current.store = { getState: () => state, dispatch: action => { state = briefReducer(state, action); } };
    current.slots = []; current.cursor = 0; current.theme = "dark"; current.push.mockReset(); current.fetch.mockReset(); current.save.mockReset().mockResolvedValue({ success: true }); current.ask.mockReset();
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
    vi.stubGlobal("window", { requestAnimationFrame: vi.fn() }); vi.stubGlobal("fetch", current.fetch);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe.each(["dark", "light"])("Brief palette in %s theme", theme => {
    beforeEach(() => { current.theme = theme; });
    it.each(CLIENT_TYPES)("retains the exact %s client value with visible reviewed selection, without saving", type => {
        const labels = { domestic: "A homeowner", commercial: "A business", public: "Public sector" };
        click(button(labels[type])); expect(current.store.getState().draft.clientType).toBe(type);
        const selected = button(labels[type]); expect(selected.props["aria-pressed"]).toBe(true);
        for (const cls of selectedClasses) expect(selected.props.className).toContain(cls);
        expect(current.save).not.toHaveBeenCalled(); expect(current.ask).not.toHaveBeenCalled(); expect(current.fetch).not.toHaveBeenCalled();
    });
    it.each(BRIEF_STAGES)("retains stage $key, its current marker and existing next/back structure", stage => {
        const target = nodes(view()).find(e => e.type === "button" && text(e.props.children).includes(stage.short))!;
        click(target); expect(current.store.getState().stage).toBe(stage.key);
        const active = nodes(view()).filter(e => e.type === "button" && e.props["aria-current"] === "step");
        expect(active).toHaveLength(1); for (const cls of selectedClasses) expect(active[0].props.className).toContain(cls);
        expect(current.save).not.toHaveBeenCalled(); expect(current.ask).not.toHaveBeenCalled();
    });
    it("retains optional trade toggle/remove semantics and the selected tick/chip", () => {
        current.store.dispatch({ type: "stage/set", stage: "work" });
        const trade = nodes(view()).find(e => e.type === "button" && e.props["aria-pressed"] === false)!;
        const label = text(trade.props.children); click(trade);
        expect(current.store.getState().draft.trades).toContain(label);
        const selected = nodes(view()).find(e => e.type === "button" && e.props["aria-pressed"] === true)!;
        for (const cls of selectedClasses) expect(selected.props.className).toContain(cls);
        const chip = nodes(view()).find(e => e.props["aria-label"] === `Remove ${label}`)!;
        expect(chip.props.className).toContain("bg-[var(--brief-accent)]"); click(chip);
        expect(current.store.getState().draft.trades).not.toContain(label); expect(current.save).not.toHaveBeenCalled(); expect(current.fetch).not.toHaveBeenCalled();
    });
    it("keeps Next as a local stage action using the already shared primary button", () => {
        const next = button("Next"); expect(next.props.className).toContain("bg-[#c9efcf]"); click(next);
        expect(current.store.getState().stage).toBe("work"); expect(current.save).not.toHaveBeenCalled(); expect(current.push).not.toHaveBeenCalled();
    });
});
describe("unchanged explicit handoff and source palette", () => {
    it("still saves once before opening this job's estimate", async () => {
        current.store.dispatch({ type: "stage/set", stage: "review" });
        await (button("Save and build the price").props.onClick as () => Promise<void>)();
        expect(current.save).toHaveBeenCalledTimes(1); expect(current.save.mock.calls[0][0]).toBe(project.id);
        expect(current.push).toHaveBeenCalledExactlyOnceWith(`/dashboard/projects/costs?projectId=${project.id}`); expect(current.fetch).not.toHaveBeenCalled();
    });
    it("retains wording and current view after a refused save and does not navigate", async () => {
        current.save.mockResolvedValue({ success: false, error: "Refused unit-test save" });
        current.store.dispatch({ type: "stage/set", stage: "review" });
        await (button("Save and build the price").props.onClick as () => Promise<void>)();
        expect(current.store.getState().draft.work).toBe("Replace the roof."); expect(current.store.getState().save.status).toBe("failed");
        expect(current.save).toHaveBeenCalledTimes(1); expect(current.push).not.toHaveBeenCalled();
    });
    it("uses existing theme tokens for every selected control, preserving separate suggestion/status styling", () => {
        const source = readFileSync(path.join(process.cwd(), "src/app/dashboard/projects/brief/brief-client.tsx"), "utf8");
        expect(source).not.toMatch(/(?:border|bg|text|accent)-blue-/);
        expect(source).toContain("accent-[var(--brief-accent)]"); expect(source).toContain("s.suggestionBox"); expect(source).toContain("s.errorBox");
        const css = readFileSync(path.join(process.cwd(), "src/components/brief-chrome.module.css"), "utf8");
        expect(css).toContain("--brief-accent: #203d2b"); expect(css).toContain("--brief-accent: #c9efcf");
    });
});
