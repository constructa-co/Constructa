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
vi.mock("../proposal/actions", () => ({ savePricingOpeningAction: replay.save }));
import PricingOpeningEditor from "./opening-message";
type Element = ReactElement<Record<string, unknown>>;
type Patch = { source?: string | null; lockReason?: string | null; projectId?: string };
function view(patch: Patch = {}) { replay.cursor = 0; return PricingOpeningEditor({ projectId: "job", source: null, lockReason: null, styles: workspaceStyles(false), onWorkChange: replay.work, ...patch }); }
function nodes(value: unknown): Element[] { if (Array.isArray(value)) return value.flatMap(nodes); if (!value || typeof value !== "object" || !("props" in value)) return []; const node = value as Element; return [node, ...nodes(node.props.children)]; }
function text(value: unknown): string { if (Array.isArray(value)) return value.map(text).join(""); if (typeof value === "string" || typeof value === "number") return String(value); return value && typeof value === "object" && "props" in value ? text((value as Element).props.children) : ""; }
function button(label: string, patch: Patch = {}) { return nodes(view(patch)).find(n => n.type === "button" && text(n.props.children) === label)!.props; }
function click(label: string, patch: Patch = {}) { (button(label, patch).onClick as () => void)(); }
function input(patch: Patch = {}) { return nodes(view(patch)).find(n => n.type === "textarea")!.props; }
function change(value: string, patch: Patch = {}) { (input(patch).onChange as (event: unknown) => void)({ target: { value } }); }
async function submit(patch: Patch = {}) { (nodes(view(patch)).find(n => n.type === "form")!.props.onSubmit as (event: unknown) => void)({ preventDefault() {} }); await Promise.resolve(); await Promise.resolve(); }
beforeEach(() => { replay.state = undefined; replay.refs = []; replay.cursor = 0; replay.cleanups = []; replay.save.mockReset(); replay.work.mockReset(); });
describe("optional reviewed opening message while pricing", () => {
    it("starts closed and blank without generated copy or writes", () => {
        expect(text(view())).toContain("No opening message saved"); expect(nodes(view()).some(n => n.type === "form")).toBe(false);
        expect(replay.save).not.toHaveBeenCalled(); expect(replay.work).not.toHaveBeenCalled();
    });
    it("retains saved wording,typed draft and explicit Cancel without blur writes", () => {
        const patch = { source: "Existing opening\nSecond paragraph" }; view(patch); click("Review opening message", patch);
        expect(input(patch).value).toBe(patch.source); expect(input(patch).maxLength).toBe(20000); expect(input(patch).onBlur).toBeUndefined();
        change("Draft only", patch); click("Cancel", patch); expect(text(view(patch))).toContain(patch.source);
        click("Review opening message", patch); expect(input(patch).value).toBe(patch.source); expect(replay.save).not.toHaveBeenCalled();
    });
    it("explicitly saves exact text and uses confirmed trim/null semantics", async () => {
        click("Review opening message"); change("  Reviewed opening  "); expect(replay.save).not.toHaveBeenCalled();
        replay.save.mockResolvedValueOnce({ success: true, introduction: "Reviewed opening" }); await submit();
        expect(replay.save).toHaveBeenCalledExactlyOnceWith("job", null, "  Reviewed opening  "); expect(text(view())).toContain("Opening message saved"); expect(replay.work).toHaveBeenLastCalledWith(false);
    });
    it("does not truncate overlong text", async () => {
        click("Review opening message"); change("x".repeat(20001)); await submit();
        expect(replay.save).not.toHaveBeenCalled(); expect(input().value).toBe("x".repeat(20001)); expect(text(view())).toContain("Nothing has been shortened");
    });
    it("fences duplicate Submit,typing and Cancel until acknowledgement", async () => {
        click("Review opening message"); change("Submitted"); let resolve!: (value: unknown) => void;
        replay.save.mockReturnValueOnce(new Promise(done => { resolve = done; })); await submit(); await submit(); change("Later"); click("Cancel");
        expect(replay.save).toHaveBeenCalledOnce(); expect(input().value).toBe("Submitted"); expect(button("Cancel").disabled).toBe(true);
        resolve({ success: true, introduction: "Submitted" }); await Promise.resolve(); await Promise.resolve(); expect(replay.work).toHaveBeenLastCalledWith(false);
    });
    it.each(["throw", "uncertain", "different", "missing"])("retains an unconfirmed %s draft and blocks blind retries", async mode => {
        click("Review opening message"); change("Keep draft");
        if (mode === "throw") replay.save.mockRejectedValueOnce(Error("Lost"));
        else replay.save.mockResolvedValueOnce(mode === "uncertain" ? { success: false, uncertain: true, error: "May have saved" } : mode === "missing" ? null : { success: true, introduction: "Different" });
        await submit(); await submit(); expect(replay.save).toHaveBeenCalledOnce(); expect(input().value).toBe("Keep draft"); expect(button("Cancel").disabled).toBe(true); expect(replay.work).toHaveBeenLastCalledWith(true);
    });
    it("keeps a definite refusal editable and cancellable", async () => {
        click("Review opening message"); change("Draft"); replay.save.mockResolvedValueOnce({ success: false, error: "Changed elsewhere" }); await submit();
        expect(input().value).toBe("Draft"); expect(button("Cancel").disabled).toBe(false); expect(text(view())).toContain("Changed elsewhere");
    });
    it("recognizes its own confirmed server refresh without refilling or blocking the next review", async () => {
        click("Review opening message"); change("Submitted"); let resolve!: (value: unknown) => void;
        replay.save.mockReturnValueOnce(new Promise(done => { resolve = done; })); await submit(); view({ source: "Submitted" });
        resolve({ success: true, introduction: "Submitted" }); await Promise.resolve(); await Promise.resolve();
        expect(button("Review opening message", { source: "Submitted" }).disabled).toBe(false); click("Review opening message", { source: "Submitted" });
        expect(input({ source: "Submitted" }).value).toBe("Submitted");
    });
    it("refuses stale source/project/lock handlers and retains typed wording", async () => {
        click("Review opening message"); change("Keep draft"); const submitOld = nodes(view()).find(n => n.type === "form")!.props.onSubmit as (event: unknown) => void;
        view({ source: "External" }); submitOld({ preventDefault() {} }); expect(replay.save).not.toHaveBeenCalled(); expect(input({ source: "External" }).value).toBe("Keep draft");
        view({ projectId: "different", source: "External" }); submitOld({ preventDefault() {} }); expect(replay.save).not.toHaveBeenCalled();
        view({ lockReason: "Accepted" }); submitOld({ preventDefault() {} }); expect(replay.save).not.toHaveBeenCalled();
    });
    it("does not confirm a late result after unmount", async () => {
        click("Review opening message"); change("Draft"); let resolve!: (value: unknown) => void; replay.save.mockReturnValueOnce(new Promise(done => { resolve = done; })); await submit();
        for (const cleanup of replay.cleanups) cleanup(); resolve({ success: true, introduction: "Draft" }); await Promise.resolve(); await Promise.resolve();
        expect(replay.work).not.toHaveBeenCalledWith(false);
    });
    it("escapes stored text and retains locked read-only display", () => {
        const html = renderToStaticMarkup(view({ source: "<script>literal</script>", lockReason: "Accepted" }));
        expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;"); expect(nodes(view({ lockReason: "Accepted" })).some(n => n.type === "button")).toBe(false);
    });
});
