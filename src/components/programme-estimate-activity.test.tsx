import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { workspaceStyles } from "@/lib/workspace-styles";

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, cleanup: [] as (() => void)[] }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
    useState: (initial: unknown) => { const i = hooks.cursor++; if (!(i in hooks.slots)) hooks.slots[i] = initial;
        return [hooks.slots[i], (next: unknown) => { hooks.slots[i] = next; }]; },
    useRef: (initial: unknown) => { const i = hooks.cursor++; if (!(i in hooks.slots)) hooks.slots[i] = { current: initial }; return hooks.slots[i]; },
    useEffect: (run: () => (() => void)) => { const i = hooks.cursor++; if (!(i in hooks.slots)) { hooks.slots[i] = true; hooks.cleanup.push(run()); } },
}));
import ProgrammeEstimateActivity from "./programme-estimate-activity";
type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Element; return [node, ...nodes(node.props.children)];
}
const copy = vi.fn();
function view(disabled = false, names = ["Kitchen", "Decoration"], dark = true) { hooks.cursor = 0; return ProgrammeEstimateActivity({ id: "stage-one", names, disabled, copy, s: workspaceStyles(dark) }); }
function select(name: string) { (nodes(view()).find(n => n.type === "select")!.props.onChange as (e: unknown) => void)({ target: { value: name } }); }
const use = (tree = view()) => nodes(tree).find(n => n.type === "button")!.props.onClick as () => void;
beforeEach(() => { hooks.slots = []; hooks.cursor = 0; hooks.cleanup = []; copy.mockReset(); copy.mockReturnValue(true); });
describe("reviewed saved activity name control", () => {
    it("starts closed and unselected; selecting only previews, then explicit use calls the draft callback", () => {
        expect(view().props.open).toBeUndefined(); expect(nodes(view()).find(n => n.type === "button")!.props.disabled).toBe(true);
        select("Kitchen"); expect(copy).not.toHaveBeenCalled(); expect(renderToStaticMarkup(view())).toContain("Review name:");
        use()(); expect(copy).toHaveBeenCalledExactlyOnceWith("Kitchen");
    });
    it("refuses a retained button after a different selection, pending work or unmount", () => {
        select("Kitchen"); const old = use(); select("Decoration"); old(); expect(copy).not.toHaveBeenCalled();
        use(view(true))(); expect(copy).not.toHaveBeenCalled();
        const current = use(); hooks.cleanup.forEach(cleanup => cleanup()); current(); expect(copy).not.toHaveBeenCalled();
    });
    it("keeps full overlong wording visible but does not truncate or copy it", () => {
        const long = "A".repeat(81); select(long); const tree = view(false, [long]);
        expect(renderToStaticMarkup(tree)).toContain(long); expect(renderToStaticMarkup(tree)).toContain("nothing has been shortened");
        expect(nodes(tree).find(n => n.type === "button")!.props.disabled).toBe(true); use(tree)(); expect(copy).not.toHaveBeenCalled();
    });
    it("explains a stale programme refusal instead of claiming it was saved", () => {
        select("Kitchen"); copy.mockReturnValue(false); use()();
        expect(renderToStaticMarkup(view())).toContain("nothing was replaced"); expect(copy).toHaveBeenCalledOnce();
    });
    it.each([true, false])("uses labelled controls, explicit non-submit button and escaped source in dark=%s", dark => {
        const html = renderToStaticMarkup(view(false, ["<script>wrong</script>"], dark));
        expect(html).toContain('for="stage-one-activity"'); expect(html).toContain('type="button"'); expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>");
        expect(html).toContain("Set its duration yourself"); expect(copy).not.toHaveBeenCalled();
    });
});
