import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { workspaceStyles } from "@/lib/workspace-styles";

const replay = vi.hoisted(() => ({ state: undefined as unknown, save: vi.fn(), work: vi.fn() }));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: (reduce: (state: unknown, patch: unknown) => unknown, initial: () => unknown) => {
    if (replay.state === undefined) replay.state = initial();
    return [replay.state, { getState: () => replay.state, dispatch: (patch: unknown) => { replay.state = reduce(replay.state, patch); } }];
} }));
vi.mock("../proposal/actions", () => ({ savePricingPaymentStagesAction: replay.save }));
import PricingPaymentStages from "./payment-stages";
type Element = ReactElement<Record<string, unknown>>;
const saved = [{ id: "original", stage: "Agreed milestone", description: "When agreed", percentage: 25 }];
function view(schedule: unknown = null, lockReason: string | null = null) {
    return PricingPaymentStages({ projectId: "job", schedule, lockReason, styles: workspaceStyles(false), onWorkChange: replay.work });
}
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Element; return [node, ...nodes(node.props.children)];
}
function text(value: unknown): string {
    if (Array.isArray(value)) return value.map(text).join("");
    if (typeof value === "string" || typeof value === "number") return String(value);
    return value && typeof value === "object" && "props" in value ? text((value as Element).props.children) : "";
}
function button(label: string, schedule: unknown = null) {
    const button = nodes(view(schedule)).find(n => n.type === "button" && text(n.props.children) === label);
    expect(button, label).toBeDefined(); return button!.props;
}
function click(label: string, schedule: unknown = null) { (button(label, schedule).onClick as () => void)(); }
function change(label: string, value: string, schedule: unknown = null) {
    const input = nodes(view(schedule)).find(n => n.props["aria-label"] === label);
    expect(input).toBeDefined(); (input!.props.onChange as (event: unknown) => void)({ target: { value } });
}
async function submit(schedule: unknown = null) {
    const form = nodes(view(schedule)).find(n => n.type === "form")!;
    (form.props.onSubmit as (event: unknown) => void)({ preventDefault: vi.fn() });
    await Promise.resolve(); await Promise.resolve();
}
function draft() {
    click("Set payment stages"); click("Add payment stage");
    change("Stage 1 name", "My chosen stage"); change("Stage 1 percentage", "40"); change("Stage 1 due", "When agreed with client");
}
beforeEach(() => { replay.state = undefined; replay.save.mockReset(); replay.work.mockReset(); });

describe("explicit payment stages while pricing", () => {
    it("starts with no commercial defaults, no request, and an early requirement explanation", () => {
        const html = renderToStaticMarkup(view()); expect(html).toContain("No payment stages saved");
        expect(html).toContain("before sending"); expect(nodes(view()).some(n => n.type === "form")).toBe(false);
        expect(replay.save).not.toHaveBeenCalled(); expect(replay.work).not.toHaveBeenCalled();
    });
    it("opens a local draft and cancels without a write or a default deposit", () => {
        draft(); expect(replay.save).not.toHaveBeenCalled(); expect(replay.work).toHaveBeenLastCalledWith(true);
        click("Cancel"); expect(replay.work).toHaveBeenLastCalledWith(false); expect(replay.save).not.toHaveBeenCalled();
        click("Set payment stages"); expect(nodes(view()).filter(n => n.type === "input")).toEqual([]);
    });
    it("sends only explicitly saved stages and confirms the returned saved state", async () => {
        draft(); replay.save.mockImplementationOnce(async (_id, _expected, rows) => ({ success: true, paymentSchedule: rows }));
        await submit(); expect(replay.save).toHaveBeenCalledOnce();
        expect(replay.save.mock.calls[0]).toEqual(["job", null, [{ id: expect.any(String), stage: "My chosen stage", description: "When agreed with client", percentage: 40 }]]);
        expect(text(view())).toContain("saved for this project's proposal"); expect(replay.work).toHaveBeenLastCalledWith(false);
        expect(text(view())).toContain("My chosen stage - 40%");
    });
    it.each(["0", "100.1", "1.234", "abc"])("retains invalid percentage %s without a save", async value => {
        draft(); change("Stage 1 percentage", value); await submit();
        expect(replay.save).not.toHaveBeenCalled(); expect(nodes(view()).find(n => n.props["aria-label"] === "Stage 1 percentage")!.props.value).toBe(value);
    });
    it("rejects a total above 100 using the existing proposal validator", async () => {
        draft(); click("Add payment stage"); change("Stage 2 name", "Later"); change("Stage 2 percentage", "70");
        await submit(); expect(replay.save).not.toHaveBeenCalled(); expect(text(view())).toMatch(/100%/);
    });
    it("retains saved IDs and makes no changes on opening, typing or cancelling", () => {
        view(saved); click("Edit payment stages", saved); change("Stage 1 name", "Draft only", saved); click("Cancel", saved);
        expect(text(view(saved))).toContain("Agreed milestone - 25%"); expect(replay.save).not.toHaveBeenCalled();
    });
    it("allows deliberate removal but warns that an empty saved schedule is not send-ready", async () => {
        view(saved); click("Edit payment stages", saved); click("Remove stage 1", saved);
        replay.save.mockResolvedValueOnce({ success: true, paymentSchedule: [] }); await submit(saved);
        expect(replay.save).toHaveBeenCalledWith("job", saved, []); expect(text(view(saved))).toContain("still need payment stages before sending");
    });
    it("blocks immediate duplicate saves, editing and Cancel while saving", async () => {
        draft(); let resolve!: (result: unknown) => void; replay.save.mockReturnValueOnce(new Promise(done => { resolve = done; }));
        const form = nodes(view()).find(n => n.type === "form")!;
        (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
        await submit(); expect(replay.save).toHaveBeenCalledOnce(); expect(button("Cancel").disabled).toBe(true);
        change("Stage 1 name", "Should not replace submitted draft");
        expect(nodes(view()).find(n => n.props["aria-label"] === "Stage 1 name")!.props.value).toBe("My chosen stage");
        resolve({ success: true, paymentSchedule: saved }); await Promise.resolve(); await Promise.resolve();
        expect(text(view())).toContain("Agreed milestone");
    });
    it("retains draft and navigation guard after a definite server refusal", async () => {
        draft(); replay.save.mockResolvedValueOnce({ success: false, error: "Changed elsewhere" }); await submit();
        expect(text(view())).toContain("Changed elsewhere"); expect(button("Cancel").disabled).toBe(false);
        expect(replay.work).toHaveBeenLastCalledWith(true); expect(nodes(view()).find(n => n.props["aria-label"] === "Stage 1 name")!.props.value).toBe("My chosen stage");
    });
    it.each(["throw", "uncertain"])("does not claim saved or blindly retry an %s outcome", async outcome => {
        draft(); if (outcome === "throw") replay.save.mockRejectedValueOnce(Error("Transport"));
        else replay.save.mockResolvedValueOnce({ success: false, uncertain: true, error: "May have saved; reload" });
        await submit(); await submit(); expect(replay.save).toHaveBeenCalledOnce(); expect(button("Cancel").disabled).toBe(true);
        expect(button("Save payment stages").disabled).toBe(true); expect(replay.work).toHaveBeenLastCalledWith(true);
    });
    it.each([[{ stage: "Legacy fixed", amount: 250 }], [{ nope: true }]].map(schedule => ({ schedule })))("keeps legacy or malformed saved schedules untouched: $schedule", ({ schedule }) => {
        expect(text(view(schedule))).toContain("kept unchanged"); expect(nodes(view(schedule)).some(n => n.type === "button")).toBe(false);
        expect(replay.save).not.toHaveBeenCalled();
    });
    it("does not offer editing when the existing pre-contract lock applies", () => {
        expect(text(view(null, "This proposal has been accepted."))).toContain("accepted");
        expect(nodes(view(null, "Locked")).some(n => n.type === "button")).toBe(false); expect(replay.save).not.toHaveBeenCalled();
    });
    it("retains the existing maximum twelve stages without auto-creating later ones", () => {
        click("Set payment stages"); for (let i = 0; i < 13; i++) click("Add payment stage");
        expect(button("Add payment stage").disabled).toBe(true); expect(nodes(view()).filter(n => n.type === "input")).toHaveLength(36);
        expect(replay.save).not.toHaveBeenCalled();
    });
    it("shows a draft percentage total for valid multi-stage shares before save", () => {
        draft(); click("Add payment stage"); change("Stage 2 name", "Later"); change("Stage 2 percentage", "30"); change("Stage 2 due", "After");
        expect(text(view())).toContain("Draft percentage total (not saved): 70%");
        expect(nodes(view()).find(n => n.props["aria-label"] === "Stage 1 percentage")!.props.value).toBe("40");
        expect(nodes(view()).find(n => n.props["aria-label"] === "Stage 2 percentage")!.props.value).toBe("30");
        change("Stage 2 percentage", "35");
        expect(text(view())).toContain("Draft percentage total (not saved): 75%");
        expect(nodes(view()).find(n => n.props["aria-label"] === "Stage 2 percentage")!.props.value).toBe("35");
        expect(replay.save).not.toHaveBeenCalled(); expect(nodes(view()).some(n => n.type === "form")).toBe(true);
    });
    it("keeps a check-input draft total fallback for invalid raw percentages", () => {
        draft(); change("Stage 1 percentage", "abc");
        expect(text(view())).toContain("Check the stage names and percentages."); expect(text(view())).not.toContain("NaN");
        expect(nodes(view()).find(n => n.props["aria-label"] === "Stage 1 percentage")!.props.value).toBe("abc");
        expect(replay.save).not.toHaveBeenCalled();
    });
});
