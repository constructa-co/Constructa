import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { minimalInput } from "@/lib/__fixtures__/proposal";
import type { ReviewState, ReviewAction, ReviewContext } from "@/lib/proposal-review";

const replay = vi.hoisted(() => ({ state: null as ReviewState | null, slots: [] as unknown[], cursor: 0, save: vi.fn(), ask: vi.fn(), publish: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
    useEffect: () => undefined, useMemo: (calculate: () => unknown) => calculate(), useRef: (initial: unknown) => ({ current: initial }),
    useState: (initial: unknown) => {
        const index = replay.cursor++;
        if (!(index in replay.slots)) replay.slots[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
        return [replay.slots[index], (value: unknown) => { replay.slots[index] = typeof value === "function" ? (value as (previous: unknown) => unknown)(replay.slots[index]) : value; }];
    },
}));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: (reduce: (state: ReviewState, action: ReviewAction) => ReviewState, initial: () => ReviewState) => {
    if (!replay.state) replay.state = initial();
    return [replay.state, { getState: () => replay.state, dispatch: (action: ReviewAction) => { replay.state = reduce(replay.state!, action); } }];
} }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "light" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./actions", () => ({ getProposalPublicationAction: vi.fn(), publishProposalAction: vi.fn(), retryProposalDeliveryAction: vi.fn(), saveProposalDraftAction: vi.fn(), suggestProposalWordingAction: vi.fn(), uploadPhotoAction: vi.fn() }));
import ReviewSendClient from "./review-send-client";
type Element = ReactElement<Record<string, unknown>>;
const sourceText = "Company message, in our own words.\nFor the contractor to review.";
function context(closing: string | null = null, message: string | null = sourceText): ReviewContext {
    const input = minimalInput();
    return { project: { ...input.project, closing_statement: closing }, profile: { ...input.profile, md_message: message }, estimate: input.estimate, nextVersion: 1 };
}
function view(current = context(), locked = false) {
    replay.cursor = 0;
    return ReviewSendClient({ context: current, caseStudies: [], publications: [], lockReason: locked ? "This proposal has been accepted." : null,
        estimateIssue: null, now: "2026-10-22T01:00:00Z", server: { save: replay.save, ask: replay.ask, publish: replay.publish, retry: vi.fn(), upload: vi.fn(), loadPublication: vi.fn() } });
}
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Element; return [node, ...nodes(node.props.children)];
}
function button(current = context(), locked = false) { return nodes(view(current, locked)).find(node => node.props["data-use-company-closing"])!.props; }
function closing(current = context()) { return nodes(view(current)).find(node => node.props.id === "wording-closing")!.props; }
function copy(current = context()) { (button(current).onClick as () => void)(); }
beforeEach(() => { replay.state = null; replay.slots = []; replay.cursor = 0; replay.save.mockReset().mockResolvedValue({ success: true }); replay.ask.mockReset(); replay.publish.mockReset(); });

describe("company closing source on the real proposal parent", () => {
    it("starts closed with actual source attribution and an empty draft, with no action call", () => {
        const source = nodes(view()).find(node => node.props["data-company-closing-source"])!;
        expect(source.type).toBe("details"); expect(source.props.open).toBeUndefined();
        const html = renderToStaticMarkup(source); expect(html).toContain("From your saved company profile."); expect(html).toContain("No new text is generated here."); expect(html).toContain(sourceText);
        expect(closing().value).toBe(""); expect(button().type).toBe("button");
        expect(replay.save).not.toHaveBeenCalled(); expect(replay.ask).not.toHaveBeenCalled(); expect(replay.publish).not.toHaveBeenCalled();
    });
    it("explicitly fills only the draft, allows contractor editing, then uses the existing Save handler", async () => {
        copy(); expect(closing().value).toBe(sourceText); expect(replay.save).not.toHaveBeenCalled();
        (closing().onChange as (event: unknown) => void)({ target: { value: "Job-specific closing" } });
        const form = nodes(view()).find(node => node.type === "form")!;
        (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} }); await Promise.resolve(); await Promise.resolve();
        expect(replay.save).toHaveBeenCalledOnce(); expect(replay.save).toHaveBeenCalledWith(expect.objectContaining({ closing: "Job-specific closing" }));
        expect(replay.ask).not.toHaveBeenCalled(); expect(replay.publish).not.toHaveBeenCalled();
    });
    it("protects typing from a source click captured before the latest edit", () => {
        const staleClick = button().onClick as () => void;
        (closing().onChange as (event: unknown) => void)({ target: { value: "Newer proposal wording" } });
        staleClick(); expect(closing().value).toBe("Newer proposal wording"); expect(button().disabled).toBe(true); expect(replay.save).not.toHaveBeenCalled();
    });
    it("keeps saved proposal overrides and remains disabled after an unsaved clear", () => {
        const current = context("Saved job-specific closing"); expect(button(current).disabled).toBe(true);
        (closing(current).onChange as (event: unknown) => void)({ target: { value: "" } });
        copy(current); expect(closing(current).value).toBe(""); expect(replay.save).not.toHaveBeenCalled();
    });
    it("does not refill legacy null or empty closings until the contractor explicitly chooses to use source text", () => {
        view(context(null)); expect(closing(context(null)).value).toBe("");
        view(context("", "Updated profile message")); expect(closing(context("", "Updated profile message")).value).toBe(""); expect(replay.save).not.toHaveBeenCalled();
    });
    it("reopening after normalized-null saved blank does not silently refill from md_message", () => {
        const normalizedNull = context(null, sourceText);
        view(normalizedNull);
        expect(closing(normalizedNull).value).toBe("");
        replay.state = null;
        view(normalizedNull);
        expect(closing(normalizedNull).value).toBe("");
        expect(button(normalizedNull).disabled).toBe(false);
        expect(replay.save).not.toHaveBeenCalled();
    });
    it("does not update an already-copied draft when the profile changes", () => {
        copy(); view(context(null, "A newer company message"));
        expect(closing(context(null, "A newer company message")).value).toBe(sourceText); expect(replay.save).not.toHaveBeenCalled();
    });
    it("refuses a source click during a pending Save, including a stale enabled button", async () => {
        const staleClick = button().onClick as () => void;
        replay.save.mockReturnValueOnce(new Promise(() => {}));
        const form = nodes(view()).find(node => node.type === "form")!;
        (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} }); await Promise.resolve();
        staleClick(); expect(closing().value).toBe(""); expect(button().disabled).toBe(true); expect(replay.save).toHaveBeenCalledOnce();
    });
    it("does not copy into a locked proposal", () => {
        expect(button(context(), true).disabled).toBe(true); (button(context(), true).onClick as () => void)();
        expect(replay.state!.draft.closing).toBe(""); expect(replay.save).not.toHaveBeenCalled();
    });
    it("omits the source control when no message exists and refuses an overlong source without shortening it", () => {
        expect(nodes(view(context(null, null))).some(node => node.props["data-company-closing-source"])).toBe(false);
        const long = context(null, "x".repeat(20001)); expect(button(long).disabled).toBe(true); copy(long);
        expect(closing(long).value).toBe(""); expect(replay.save).not.toHaveBeenCalled();
    });
    it("escapes company text rather than rendering it as markup", () => {
        const source = nodes(view(context(null, "<script>unsafe()</script>"))).find(node => node.props["data-company-closing-source"])!;
        const html = renderToStaticMarkup(source); expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;");
    });
});
