import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { workspaceStyles } from "@/lib/workspace-styles";

const replay = vi.hoisted(() => ({ state: undefined as unknown, refs: [] as Array<{ current: unknown }>, cursor: 0, cleanups: [] as Array<() => void>, save: vi.fn(), work: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
    useRef: (initial: unknown) => replay.refs[replay.cursor++] ??= { current: initial },
    useEffect: (effect: () => void | (() => void)) => { const cleanup = effect(); if (cleanup) replay.cleanups.push(cleanup); },
}));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: (reduce: (state: unknown, patch: unknown) => unknown, initial: () => unknown) => {
    if (replay.state === undefined) replay.state = initial();
    return [replay.state, { getState: () => replay.state, dispatch: (patch: unknown) => { replay.state = reduce(replay.state, patch); } }];
} }));
vi.mock("./experience-actions", () => ({ savePricingExperienceAction: replay.save }));
import PricingExperienceEditor from "./experience-selection";
type Element = ReactElement<Record<string, unknown>>;
const source = (selected: string[] | null = [], catalogKey = "a".repeat(64)) => ({ catalogKey, selected, options: [{ tick: "old", title: "Saved kitchen", detail: "Refurbishment" }, { tick: "1", title: "Saved bathroom", detail: "" }], retained: (selected ?? []).filter(tick => !["old", "1"].includes(tick)), notes: ["Saved proposal checks"] });
type Patch = { source?: ReturnType<typeof source>; lockReason?: string | null; projectId?: string };
function view(patch: Patch = {}) { replay.cursor = 0; return PricingExperienceEditor({ projectId: "job", source: source(), lockReason: null, styles: workspaceStyles(false), onWorkChange: replay.work, save: replay.save, ...patch }); }
function nodes(value: unknown): Element[] { if (Array.isArray(value)) return value.flatMap(nodes); if (!value || typeof value !== "object" || !("props" in value)) return []; const node = value as Element; return [node, ...nodes(node.props.children)]; }
function text(value: unknown): string { if (Array.isArray(value)) return value.map(text).join(""); if (typeof value === "string" || typeof value === "number") return String(value); return value && typeof value === "object" && "props" in value ? text((value as Element).props.children) : ""; }
function button(label: string, patch: Patch = {}) { return nodes(view(patch)).find(n => n.type === "button" && text(n.props.children) === label)!.props; }
function click(label: string, patch: Patch = {}) { (button(label, patch).onClick as () => void)(); }
function toggle(index = 0, patch: Patch = {}) { (nodes(view(patch)).filter(n => n.type === "input")[index].props.onChange as () => void)(); }
async function submit(patch: Patch = {}) { (nodes(view(patch)).find(n => n.type === "form")!.props.onSubmit as (event: unknown) => void)({ preventDefault() {} }); await Promise.resolve(); await Promise.resolve(); }
beforeEach(() => { replay.state = undefined; replay.refs = []; replay.cursor = 0; replay.cleanups = []; replay.save.mockReset(); replay.work.mockReset(); });

describe("explicit reviewed experience choices while pricing", () => {
    it("starts closed with no default selection or writes", () => {
        expect(nodes(view()).some(n => n.type === "form")).toBe(false); expect(text(view())).toContain("0 saved selection values");
        expect(replay.save).not.toHaveBeenCalled(); expect(replay.work).not.toHaveBeenCalled();
    });
    it("typing a choice/Cancel never writes and reopens the saved choices", () => {
        click("Review relevant experience"); toggle(); expect(replay.save).not.toHaveBeenCalled(); click("Cancel"); click("Review relevant experience");
        expect(nodes(view()).filter(n => n.type === "input").map(n => n.props.checked)).toEqual([false, false]); expect(replay.save).not.toHaveBeenCalled();
    });
    it("saves only explicitly,then accepts only exact acknowledged catalog and selections", async () => {
        click("Review relevant experience"); toggle(); replay.save.mockResolvedValueOnce({ success: true, source: source(["old"]) }); await submit();
        expect(replay.save).toHaveBeenCalledExactlyOnceWith("job", { catalogKey: "a".repeat(64), selected: [] }, ["old"]);
        expect(text(view())).toContain("Experience choices saved"); expect(replay.work).toHaveBeenLastCalledWith(false);
    });
    it("keeps unavailable saved ticks unchanged without an editable checkbox or silent removal", async () => {
        const patch = { source: source(["missing", "lib:unavailable", "missing"]) }; click("Review relevant experience", patch); toggle(0, patch);
        expect(text(view(patch))).toContain("kept unchanged"); expect(nodes(view(patch)).filter(n => n.type === "input")).toHaveLength(2);
        replay.save.mockResolvedValueOnce({ success: false, error: "Retained" }); await submit(patch);
        expect(replay.save.mock.calls[0][2]).toEqual(["missing", "lib:unavailable", "missing", "old"]);
    });
    it("fences duplicates,Cancel and old checkbox handlers while pending", async () => {
        click("Review relevant experience"); toggle(); const old = nodes(view()).filter(n => n.type === "input")[1].props.onChange as () => void;
        let resolve!: (value: unknown) => void; replay.save.mockReturnValueOnce(new Promise(done => { resolve = done; }));
        await submit(); await submit(); old(); click("Cancel"); expect(replay.save).toHaveBeenCalledOnce(); expect(button("Cancel").disabled).toBe(true);
        resolve({ success: true, source: source(["old"]) }); await Promise.resolve(); await Promise.resolve(); expect(replay.work).toHaveBeenLastCalledWith(false);
    });
    it.each(["throw", "uncertain", "differentSelection", "differentCatalog", "missing"])("retains uncertain %s choices without blind retry", async mode => {
        click("Review relevant experience"); toggle();
        if (mode === "throw") replay.save.mockRejectedValueOnce(Error("Lost"));
        else replay.save.mockResolvedValueOnce(mode === "uncertain" ? { success: false, uncertain: true, error: "May have saved" } : mode === "missing" ? null
            : { success: true, source: source(mode === "differentSelection" ? [] : ["old"], mode === "differentCatalog" ? "b".repeat(64) : "a".repeat(64)) });
        await submit(); await submit(); expect(replay.save).toHaveBeenCalledOnce(); expect(button("Cancel").disabled).toBe(true);
        expect(nodes(view()).filter(n => n.type === "input")[0].props.checked).toBe(true); expect(replay.work).not.toHaveBeenCalledWith(false);
    });
    it("keeps definite refusal cancellable and draft choices intact", async () => {
        click("Review relevant experience"); toggle(); replay.save.mockResolvedValueOnce({ success: false, error: "Changed source" }); await submit();
        expect(nodes(view()).filter(n => n.type === "input")[0].props.checked).toBe(true); expect(button("Cancel").disabled).toBe(false);
        click("Cancel"); expect(replay.work).toHaveBeenLastCalledWith(false);
    });
    it.each([{ source: source([], "b".repeat(64)) }, { source: source(["1"]) }, { projectId: "another" }, { lockReason: "Accepted" }])("fences stale sources/selection/project/lock and old handlers %j", patch => {
        click("Review relevant experience"); const oldToggle = nodes(view()).filter(n => n.type === "input")[0].props.onChange as () => void;
        const oldSubmit = nodes(view()).find(n => n.type === "form")!.props.onSubmit as (e: unknown) => void;
        view(patch); oldToggle(); oldSubmit({ preventDefault() {} }); expect(replay.save).not.toHaveBeenCalled();
        expect(nodes(view(patch)).filter(n => n.type === "input")[0].props.checked).toBe(false);
    });
    it("recognizes only its own exact confirmed refresh", async () => {
        click("Review relevant experience"); toggle(); let resolve!: (value: unknown) => void;
        replay.save.mockReturnValueOnce(new Promise(done => { resolve = done; })); await submit(); view({ source: source(["old"]) });
        resolve({ success: true, source: source(["old"]) }); await Promise.resolve(); await Promise.resolve();
        click("Review relevant experience", { source: source(["old"]) }); expect(nodes(view({ source: source(["old"]) })).filter(n => n.type === "input")[0].props.checked).toBe(true);
    });
    it("does not confirm late acknowledgement after unmount", async () => {
        click("Review relevant experience"); toggle(); let resolve!: (value: unknown) => void;
        replay.save.mockReturnValueOnce(new Promise(done => { resolve = done; })); await submit();
        for (const cleanup of replay.cleanups) cleanup(); resolve({ success: true, source: source(["old"]) }); await Promise.resolve(); await Promise.resolve();
        expect(replay.work).not.toHaveBeenCalledWith(false);
    });
    it("escapes stored titles and keeps locked review readonly", () => {
        const catalog = source(); catalog.options[0].title = "<script>literal</script>";
        click("Review relevant experience", { source: catalog });
        expect(renderToStaticMarkup(view({ source: catalog }))).toContain("&lt;script&gt;");
        replay.state = undefined; replay.refs = [];
        expect(nodes(view({ lockReason: "Accepted" })).some(n => n.type === "button")).toBe(false);
    });
});
