import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { workspaceStyles } from "@/lib/workspace-styles";

const replay = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, save: vi.fn(), begin: vi.fn(), work: vi.fn(), saved: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = replay.cursor++;
        if (!(index in replay.slots)) replay.slots[index] = initial;
        return [replay.slots[index], (value: unknown) => { replay.slots[index] = value; }];
    },
    useRef: (initial: unknown) => {
        const index = replay.cursor++;
        if (!(index in replay.slots)) replay.slots[index] = { current: initial };
        return replay.slots[index];
    },
}));
import LineActivity from "./line-activity";
type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function view(blocked = false) {
    replay.cursor = 0;
    return LineActivity({ lineId: "line", estimateId: "estimate", section: "General", choices: ["General", "Kitchen", "__proto__"], styles: workspaceStyles(false),
        blocked, onBegin: replay.begin, onWork: replay.work, onSaved: replay.saved, save: replay.save });
}
function button(text: string, blocked = false) { return nodes(view(blocked)).find(n => n.type === "button" && n.props.children === text)!; }
function click(text: string) { return (button(text).props.onClick as () => Promise<void> | void)(); }
function start() { (view().props.onClick as () => void)(); }
function type(value: string) { (nodes(view()).find(n => n.type === "input")!.props.onChange as (event: unknown) => void)({ currentTarget: { value } }); }
beforeEach(() => {
    replay.slots = []; replay.cursor = 0; replay.begin.mockReset().mockReturnValue(true); replay.saved.mockReset().mockReturnValue(true);
    replay.work.mockReset(); replay.save.mockReset().mockResolvedValue({ ok: true, lineId: "line", estimateId: "estimate", section: "Kitchen" });
});
describe("explicit saved-line activity editor", () => {
    it("starts closed; labelled choices and typing/Enter/Cancel make no save call", () => {
        expect(view().props["data-line-activity"]).toBe("line"); start();
        const input = nodes(view()).find(n => n.type === "input")!;
        expect(nodes(view()).find(n => n.type === "label")!.props.htmlFor).toBe(input.props.id);
        expect(nodes(view()).filter(n => n.type === "option").map(n => n.props.value)).toEqual(["General", "Kitchen", "__proto__"]);
        const preventDefault = vi.fn(); (input.props.onKeyDown as (event: unknown) => void)({ key: "Enter", preventDefault });
        type("Kitchen"); expect(preventDefault).toHaveBeenCalledOnce(); expect(replay.save).not.toHaveBeenCalled();
        click("Cancel"); expect(replay.work).toHaveBeenLastCalledWith("confirmed"); expect(replay.save).not.toHaveBeenCalled();
        expect(view().props["data-line-activity"]).toBe("line");
    });
    it("does not begin when a fresh parent guard or displayed blocked state refuses", () => {
        replay.begin.mockReturnValueOnce(false); start(); expect(nodes(view()).some(n => n.type === "input")).toBe(false);
        (view(true).props.onClick as () => void)(); expect(replay.begin).toHaveBeenCalledOnce(); expect(replay.save).not.toHaveBeenCalled();
    });
    it("uses explicit Save and only confirms the returned matching identity/name", async () => {
        start(); type(" Kitchen "); await click("Save activity");
        expect(replay.save).toHaveBeenCalledExactlyOnceWith({ estimateId: "estimate", lineId: "line", expectedSection: "General", section: "Kitchen" });
        expect(replay.saved).toHaveBeenCalledWith({ ok: true, lineId: "line", estimateId: "estimate", section: "Kitchen" }, "General");
        expect(replay.work.mock.calls.map(call => call[0])).toEqual(["saving", "confirmed"]);
        expect(nodes(view()).some(n => n.type === "input")).toBe(false);
    });
    it("immediately fences duplicate clicks and stale Cancel/typing while pending", async () => {
        let finish!: (value: unknown) => void;
        replay.save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        start(); type("Kitchen"); const save = button("Save activity").props.onClick as () => Promise<void>;
        const cancel = button("Cancel").props.onClick as () => void;
        const change = nodes(view()).find(n => n.type === "input")!.props.onChange as (event: unknown) => void;
        const pending = save(); await save(); cancel(); change({ currentTarget: { value: "Newer text" } });
        expect(replay.save).toHaveBeenCalledOnce(); expect(replay.work).not.toHaveBeenCalledWith("confirmed");
        expect(nodes(view()).find(n => n.type === "input")!.props.value).toBe("Kitchen");
        finish({ ok: true, lineId: "line", estimateId: "estimate", section: "Kitchen" }); await pending;
        await save(); expect(replay.save).toHaveBeenCalledOnce();
    });
    it("retains a refused draft for correction and explicit retry", async () => {
        start(); type("Kitchen"); replay.save.mockResolvedValueOnce({ ok: false, error: "Read unavailable" });
        await click("Save activity"); expect(nodes(view()).find(n => n.type === "input")!.props.value).toBe("Kitchen");
        expect(renderToStaticMarkup(view())).toContain("Read unavailable"); expect(replay.saved).not.toHaveBeenCalled();
        await click("Save activity"); expect(replay.save).toHaveBeenCalledTimes(2);
    });
    it("a retained Save callback reads current typing rather than replacing it with its old render", async () => {
        start(); type("Earlier name");
        const old = button("Save activity").props.onClick as () => Promise<void>;
        type("Kitchen"); await old();
        expect(replay.save).toHaveBeenCalledWith(expect.objectContaining({ section: "Kitchen" }));
        expect(replay.saved).toHaveBeenCalledOnce();
    });
    it.each(["rejection", "uncertain", "wrong-row", "late-view"])("retains draft and blocks blind retry/Cancel after %s", async reason => {
        start(); type("Kitchen");
        if (reason === "rejection") replay.save.mockRejectedValueOnce(Error("No reply"));
        if (reason === "uncertain") replay.save.mockResolvedValueOnce({ ok: false, uncertain: true, error: "May have saved" });
        if (reason === "wrong-row") replay.save.mockResolvedValueOnce({ ok: true, lineId: "other", estimateId: "estimate", section: "Kitchen" });
        if (reason === "late-view") replay.saved.mockReturnValueOnce(false);
        await click("Save activity");
        expect(nodes(view()).find(n => n.type === "input")!.props.value).toBe("Kitchen");
        expect(button("Save activity").props.disabled).toBe(true); expect(button("Cancel").props.disabled).toBe(true);
        await click("Save activity"); click("Cancel"); expect(replay.save).toHaveBeenCalledOnce();
        expect(replay.work).toHaveBeenLastCalledWith("uncertain");
    });
    it("refuses blank and overlong names without truncation and escapes source markup", () => {
        start(); type(" "); expect(button("Save activity").props.disabled).toBe(true);
        type("x".repeat(101)); expect(button("Save activity").props.disabled).toBe(true);
        expect(renderToStaticMarkup(view())).toContain("Nothing is truncated");
        type("<script>not code</script>"); expect(renderToStaticMarkup(view())).not.toContain("<script>");
        expect(replay.save).not.toHaveBeenCalled();
    });
});
