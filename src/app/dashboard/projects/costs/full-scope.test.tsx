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
vi.mock("../proposal/actions", () => ({ savePricingFullScopeAction: replay.save }));
import PricingFullScopeEditor from "./full-scope";
type Element = ReactElement<Record<string, unknown>>;
const source = (scope_text: string | null = null, brief_scope: string | null = null) => ({ scope_text, brief_scope });
type Patch = { source?: ReturnType<typeof source>; lockReason?: string | null; projectId?: string };
function view(patch: Patch = {}) { replay.cursor = 0; return PricingFullScopeEditor({ projectId: "job", source: source(), lockReason: null, styles: workspaceStyles(false), onWorkChange: replay.work, ...patch }); }
function nodes(value: unknown): Element[] { if (Array.isArray(value)) return value.flatMap(nodes); if (!value || typeof value !== "object" || !("props" in value)) return []; const node = value as Element; return [node, ...nodes(node.props.children)]; }
function text(value: unknown): string { if (Array.isArray(value)) return value.map(text).join(""); if (typeof value === "string" || typeof value === "number") return String(value); return value && typeof value === "object" && "props" in value ? text((value as Element).props.children) : ""; }
function button(label: string, patch: Patch = {}) { return nodes(view(patch)).find(n => n.type === "button" && text(n.props.children) === label)!.props; }
function click(label: string, patch: Patch = {}) { (button(label, patch).onClick as () => void)(); }
function input(patch: Patch = {}) { return nodes(view(patch)).find(n => n.type === "textarea")!.props; }
function change(value: string, patch: Patch = {}) { (input(patch).onChange as (event: unknown) => void)({ target: { value } }); }
async function submit(patch: Patch = {}) { (nodes(view(patch)).find(n => n.type === "form")!.props.onSubmit as (event: unknown) => void)({ preventDefault() {} }); await Promise.resolve(); await Promise.resolve(); }
beforeEach(() => { replay.state = undefined; replay.refs = []; replay.cursor = 0; replay.cleanups = []; replay.save.mockReset(); replay.work.mockReset(); });

describe("reviewed full scope while pricing", () => {
    it("opens only on review and shows existing fallback work without copying qualifiers or writing", () => {
        const patch = { source: source(null, "Paint walls\n\nSite, access and assumptions:\nAccess by agreement") };
        expect(text(view(patch))).toContain("Paint walls"); expect(nodes(view(patch)).some(n => n.type === "form")).toBe(false);
        click("Review full scope", patch); expect(input(patch).value).toBe("Paint walls");
        expect(input(patch).onBlur).toBeUndefined(); expect(input(patch).maxLength).toBe(20000);
        click("Cancel", patch); expect(replay.save).not.toHaveBeenCalled();
    });
    it("preserves a saved override and cancelled edits rather than refilling from brief", () => {
        const patch = { source: source("Saved scope", "Other brief") }; view(patch); click("Review full scope", patch);
        expect(input(patch).value).toBe("Saved scope"); change("Draft", patch); click("Cancel", patch);
        click("Review full scope", patch); expect(input(patch).value).toBe("Saved scope"); expect(replay.save).not.toHaveBeenCalled();
    });
    it("explicitly saves one scope with both reviewed source values and confirms only the returned pair", async () => {
        const patch = { source: source(null, "Brief work") };
        click("Review full scope", patch); change("  Reviewed scope  ", patch); expect(replay.save).not.toHaveBeenCalled();
        replay.save.mockResolvedValueOnce({ success: true, source: source("Reviewed scope", "Brief work") }); await submit(patch);
        expect(replay.save).toHaveBeenCalledExactlyOnceWith("job", patch.source, "  Reviewed scope  ");
        expect(text(view(patch))).toContain("Scope saved"); expect(replay.work).toHaveBeenLastCalledWith(false);
    });
    it("refuses a false blank clear when brief work would reappear,without changing or truncating text", async () => {
        const patch = { source: source("Override", "Brief work") }; click("Review full scope", patch); change(" \n ", patch); await submit(patch);
        expect(text(view(patch))).toContain("would reappear"); expect(input(patch).value).toBe(" \n "); expect(replay.save).not.toHaveBeenCalled();
        change("x".repeat(20001), patch); await submit(patch); expect(text(view(patch))).toContain("Nothing has been shortened"); expect(input(patch).value).toHaveLength(20001);
        expect(replay.save).not.toHaveBeenCalled();
    });
    it("allows explicit blank-to-null only without fallback work", async () => {
        click("Review full scope"); change(" "); replay.save.mockResolvedValueOnce({ success: true, source: source() }); await submit();
        expect(replay.save).toHaveBeenCalledOnce(); expect(text(view())).toContain("Scope saved");
    });
    it("fences duplicate submit,typing and Cancel during acknowledgement", async () => {
        click("Review full scope"); change("Submitted"); let resolve!: (value: unknown) => void;
        replay.save.mockReturnValueOnce(new Promise(done => { resolve = done; })); await submit(); await submit(); change("Later"); click("Cancel");
        expect(replay.save).toHaveBeenCalledOnce(); expect(input().value).toBe("Submitted"); expect(button("Cancel").disabled).toBe(true);
        resolve({ success: true, source: source("Submitted") }); await Promise.resolve(); await Promise.resolve(); expect(replay.work).toHaveBeenLastCalledWith(false);
    });
    it.each(["throw", "uncertain", "differentScope", "differentBrief", "missing"])("retains uncertain %s drafts without blind retry", async mode => {
        click("Review full scope"); change("Keep draft");
        if (mode === "throw") replay.save.mockRejectedValueOnce(Error("Lost"));
        else replay.save.mockResolvedValueOnce(mode === "uncertain" ? { success: false, uncertain: true, error: "May have saved" }
            : mode === "missing" ? null : { success: true, source: source(mode === "differentScope" ? "Different" : "Keep draft", mode === "differentBrief" ? "Changed" : null) });
        await submit(); await submit(); expect(replay.save).toHaveBeenCalledOnce(); expect(input().value).toBe("Keep draft");
        expect(button("Cancel").disabled).toBe(true); expect(replay.work).toHaveBeenLastCalledWith(true);
    });
    it("retains a definite refusal with explicit Cancel available", async () => {
        click("Review full scope"); change("Draft"); replay.save.mockResolvedValueOnce({ success: false, error: "Changed elsewhere" }); await submit();
        expect(input().value).toBe("Draft"); expect(text(view())).toContain("Changed elsewhere"); click("Cancel"); expect(replay.work).toHaveBeenLastCalledWith(false);
    });
    it.each([source("External"), source(null, "New brief")])("fences either stale source field and old handlers", async changed => {
        click("Review full scope"); change("Keep draft"); const old = nodes(view()).find(n => n.type === "form")!.props.onSubmit as (event: unknown) => void;
        view({ source: changed }); old({ preventDefault() {} }); expect(replay.save).not.toHaveBeenCalled(); expect(input({ source: changed }).value).toBe("Keep draft");
        expect(input({ source: changed }).disabled).toBe(true);
    });
    it("fences changed project and locks without losing wording", () => {
        click("Review full scope"); change("Keep draft"); const old = nodes(view()).find(n => n.type === "form")!.props.onSubmit as (event: unknown) => void;
        view({ projectId: "another" }); old({ preventDefault() {} }); view({ lockReason: "Accepted" }); old({ preventDefault() {} });
        expect(replay.save).not.toHaveBeenCalled(); expect(input({ lockReason: "Accepted" }).value).toBe("Keep draft");
    });
    it("accepts its exact own refresh before acknowledgement but never a changed brief", async () => {
        click("Review full scope"); change("Submitted"); let resolve!: (value: unknown) => void;
        replay.save.mockReturnValueOnce(new Promise(done => { resolve = done; })); await submit(); view({ source: source("Submitted") });
        resolve({ success: true, source: source("Submitted") }); await Promise.resolve(); await Promise.resolve();
        click("Review full scope", { source: source("Submitted") }); expect(input({ source: source("Submitted") }).value).toBe("Submitted");
    });
    it("retains draft if an external brief changes during a save", async () => {
        click("Review full scope"); change("Submitted"); let resolve!: (value: unknown) => void;
        replay.save.mockReturnValueOnce(new Promise(done => { resolve = done; })); await submit(); view({ source: source("Submitted", "Changed brief") });
        resolve({ success: true, source: source("Submitted") }); await Promise.resolve(); await Promise.resolve();
        expect(input({ source: source("Submitted", "Changed brief") }).value).toBe("Submitted"); expect(replay.work).not.toHaveBeenCalledWith(false);
    });
    it("does not confirm late acknowledgement after unmount", async () => {
        click("Review full scope"); change("Draft"); let resolve!: (value: unknown) => void;
        replay.save.mockReturnValueOnce(new Promise(done => { resolve = done; })); await submit();
        for (const cleanup of replay.cleanups) cleanup(); resolve({ success: true, source: source("Draft") }); await Promise.resolve(); await Promise.resolve();
        expect(replay.work).not.toHaveBeenCalledWith(false);
    });
    it("escapes saved wording and keeps locked review readonly", () => {
        const patch = { source: source("<script>literal</script>"), lockReason: "Accepted" };
        const html = renderToStaticMarkup(view(patch)); expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;");
        expect(nodes(view(patch)).some(n => n.type === "button")).toBe(false);
    });
});
