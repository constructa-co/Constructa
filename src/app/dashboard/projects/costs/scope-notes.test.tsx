import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { PricingScopeNotesSource } from "@/lib/pricing-scope-notes";
import { workspaceStyles } from "@/lib/workspace-styles";

const replay = vi.hoisted(() => ({ state: undefined as unknown, save: vi.fn(), work: vi.fn() }));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: (reduce: (state: unknown, patch: unknown) => unknown, initial: () => unknown) => {
    if (replay.state === undefined) replay.state = initial();
    return [replay.state, { getState: () => replay.state, dispatch: (patch: unknown) => { replay.state = reduce(replay.state, patch); } }];
} }));
vi.mock("../proposal/actions", () => ({ savePricingScopeNotesAction: replay.save }));
import PricingScopeNotesEditor from "./scope-notes";

type Element = ReactElement<Record<string, unknown>>;
const empty: PricingScopeNotesSource = { exclusions_text: null, clarifications_text: null, contract_exclusions: null, contract_clarifications: null };
const saved = { ...empty, exclusions_text: "Keep exclusions", clarifications_text: "Keep clarifications" };
function view(source: PricingScopeNotesSource = empty, lockReason: string | null = null) {
    return PricingScopeNotesEditor({ projectId: "job", source, lockReason, styles: workspaceStyles(false), onWorkChange: replay.work });
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
function button(label: string, source = empty) {
    const control = nodes(view(source)).find(node => node.type === "button" && text(node.props.children) === label);
    expect(control, label).toBeDefined(); return control!.props;
}
function click(label: string, source = empty) { (button(label, source).onClick as () => void)(); }
function input(index: number, source = empty) { return nodes(view(source)).filter(node => node.type === "textarea")[index].props; }
function change(index: number, value: string, source = empty) { (input(index, source).onChange as (event: unknown) => void)({ target: { value } }); }
async function submit(source = empty) {
    (nodes(view(source)).find(node => node.type === "form")!.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
    await Promise.resolve(); await Promise.resolve();
}
beforeEach(() => { replay.state = undefined; replay.save.mockReset(); replay.work.mockReset(); });

describe("reviewed price exclusions and clarifications", () => {
    it("shows no invented conditions and starts outside editing with no write", () => {
        const html = renderToStaticMarkup(view()); expect(html).toContain("No exclusions saved."); expect(html).toContain("No clarifications saved.");
        expect(nodes(view()).some(node => node.type === "form")).toBe(false); expect(replay.save).not.toHaveBeenCalled(); expect(replay.work).not.toHaveBeenCalled();
    });
    it("preserves saved multiline wording on opening, typing and Cancel without writes", () => {
        view(saved); click("Review price notes", saved);
        expect(input(0, saved).value).toBe("Keep exclusions"); expect(input(1, saved).value).toBe("Keep clarifications");
        change(0, "Draft only\nSecond line", saved); click("Cancel", saved);
        expect(text(view(saved))).toContain("Keep exclusions"); expect(replay.save).not.toHaveBeenCalled(); expect(replay.work).toHaveBeenLastCalledWith(false);
        click("Review price notes", saved); expect(input(0, saved).value).toBe("Keep exclusions");
    });
    it("labels both multiline fields and retains the existing ten-thousand-character limits", () => {
        click("Review price notes"); const labels = nodes(view()).filter(node => node.type === "label");
        expect(labels).toHaveLength(2); expect(text(labels[0])).toContain("What's not included"); expect(text(labels[1])).toContain("Clarifications");
        expect(input(0).maxLength).toBe(10000); expect(input(1).maxLength).toBe(10000);
        expect(input(0).onKeyDown).toBeUndefined(); expect(input(1).onBlur).toBeUndefined();
    });
    it("saves the two exact reviewed fields only after explicit Submit and then shows stored confirmation", async () => {
        click("Review price notes"); change(0, "No decorating.\nClient supplies fittings."); change(1, "Access by agreement.");
        expect(replay.save).not.toHaveBeenCalled();
        replay.save.mockResolvedValueOnce({ success: true, source: { ...empty, exclusions_text: "No decorating.\nClient supplies fittings.", clarifications_text: "Access by agreement." } });
        await submit(); expect(replay.save).toHaveBeenCalledWith("job", empty, { exclusions: "No decorating.\nClient supplies fittings.", clarifications: "Access by agreement." });
        expect(text(view())).toContain("saved for the proposal"); expect(text(view())).toContain("Client supplies fittings."); expect(replay.work).toHaveBeenLastCalledWith(false);
    });
    it("starts from existing contract fallback wording without saving it implicitly", () => {
        const source = { ...empty, contract_exclusions: "Legacy exclusion", contract_clarifications: "Legacy assumption" };
        view(source); click("Review price notes", source);
        expect(input(0, source).value).toBe("Legacy exclusion"); expect(input(1, source).value).toBe("Legacy assumption");
        expect(text(view(source))).toContain("does not remove or change those contract notes"); expect(replay.save).not.toHaveBeenCalled();
    });
    it("does not falsely save a cleared field when legacy contract notes would reappear", async () => {
        const source = { ...empty, contract_exclusions: "Legacy exclusion" };
        view(source); click("Review price notes", source); change(0, "", source); await submit(source);
        expect(text(view(source))).toContain("would reappear"); expect(replay.save).not.toHaveBeenCalled(); expect(input(0, source).value).toBe("");
    });
    it.each([0, 1])("refuses overlong field %s without truncating the draft", async index => {
        click("Review price notes"); change(index, "x".repeat(10001)); await submit();
        expect(replay.save).not.toHaveBeenCalled(); expect(input(index).value).toBe("x".repeat(10001)); expect(text(view())).toContain("Nothing has been shortened");
    });
    it("retains draft and navigation protection on a definite server refusal", async () => {
        click("Review price notes"); change(0, "My edited exclusion"); replay.save.mockResolvedValueOnce({ success: false, error: "Changed elsewhere" });
        await submit(); expect(text(view())).toContain("Changed elsewhere"); expect(input(0).value).toBe("My edited exclusion");
        expect(replay.work).toHaveBeenLastCalledWith(true); expect(button("Cancel").disabled).toBe(false);
    });
    it("fences duplicates and keeps submitted values immutable until acknowledgement", async () => {
        click("Review price notes"); change(0, "Submitted wording");
        let resolve!: (value: unknown) => void; replay.save.mockReturnValueOnce(new Promise(done => { resolve = done; }));
        await submit(); await submit(); expect(replay.save).toHaveBeenCalledOnce(); expect(button("Cancel").disabled).toBe(true);
        change(0, "Later typing"); expect(input(0).value).toBe("Submitted wording");
        resolve({ success: true, source: { ...empty, exclusions_text: "Submitted wording" } }); await Promise.resolve(); await Promise.resolve();
        expect(text(view())).toContain("Submitted wording");
    });
    it.each(["throw", "uncertain"])("keeps an %s save outcome visible and prevents blind retry or Cancel", async outcome => {
        click("Review price notes"); change(0, "Keep my draft");
        if (outcome === "throw") replay.save.mockRejectedValueOnce(Error("Transport"));
        else replay.save.mockResolvedValueOnce({ success: false, uncertain: true, error: "May have saved; reload" });
        await submit(); await submit(); expect(replay.save).toHaveBeenCalledOnce(); expect(input(0).value).toBe("Keep my draft");
        expect(button("Save price notes").disabled).toBe(true); expect(button("Cancel").disabled).toBe(true); expect(replay.work).toHaveBeenLastCalledWith(true);
    });
    it("retains saved text but does not offer editing for a locked project", () => {
        expect(text(view(saved, "This proposal has been accepted."))).toContain("Keep exclusions");
        expect(nodes(view(saved, "Locked")).some(node => node.type === "button")).toBe(false); expect(replay.save).not.toHaveBeenCalled();
    });
    it("escapes note markup instead of rendering contractor text as HTML", () => {
        const html = renderToStaticMarkup(view({ ...empty, exclusions_text: "<script>unsafe()</script>" }));
        expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;");
    });
});
