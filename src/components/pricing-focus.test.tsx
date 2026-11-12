import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replay = vi.hoisted(() => ({ slots: [] as { current: unknown }[], cursor: 0, effects: [] as (() => unknown)[] }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
    useRef: (initial: unknown) => {
        const index = replay.cursor++;
        if (!(index in replay.slots)) replay.slots[index] = { current: initial };
        return replay.slots[index];
    },
    useEffect: (callback: () => unknown) => { replay.effects.push(callback); },
}));
import PricingFocus from "./pricing-focus";

class Element {
    isConnected = true;
    invalid = false;
    disabled = false;
    focus = vi.fn();
    getAttribute(name: string) { return name === "aria-invalid" && this.invalid ? "true" : null; }
    matches(selector: string) { return selector === ":disabled" ? this.disabled : false; }
}
class Form extends Element {
    elements: Element[] = [];
    querySelector() { return null; }
}
let rootListeners: Record<string, (event: unknown) => void>;
let documentListeners: Record<string, (event: unknown) => void>;
let next: Element;
beforeEach(() => {
    replay.slots = []; replay.cursor = 0; replay.effects = [];
    rootListeners = {}; documentListeners = {}; next = new Element();
    vi.stubGlobal("HTMLElement", Element); vi.stubGlobal("HTMLFormElement", Form);
    const body = new Element();
    vi.stubGlobal("document", { body, activeElement: body,
        addEventListener: (name: string, callback: (event: unknown) => void) => { documentListeners[name] = callback; }, removeEventListener: vi.fn(),
    });
    const tree = PricingFocus({ revision: "draft" });
    (tree.props.ref as { current: unknown }).current = { parentElement: {
        contains: () => true, querySelector: () => next,
        addEventListener: (name: string, callback: (event: unknown) => void) => { rootListeners[name] = callback; }, removeEventListener: vi.fn(),
    } };
    replay.effects[0]();
});
afterEach(() => vi.unstubAllGlobals());

describe("pricing form-associated field focus", () => {
    it("focuses the first invalid control owned by the submitted form, even outside its DOM subtree", () => {
        const external = new Element(); external.invalid = true;
        const form = new Form(); form.elements = [new Element(), external];
        rootListeners.submit({ target: form }); replay.effects[1]();
        expect(external.focus).toHaveBeenCalledExactlyOnceWith();
        expect(next.focus).not.toHaveBeenCalled();
    });
    it("does not focus disabled invalid controls", () => {
        const disabled = new Element(); disabled.invalid = true; disabled.disabled = true;
        const editable = new Element(); editable.invalid = true;
        const form = new Form(); form.elements = [disabled, editable];
        rootListeners.submit({ target: form }); replay.effects[1]();
        expect(disabled.focus).not.toHaveBeenCalled(); expect(editable.focus).toHaveBeenCalledOnce();
    });
    it("retains the next-row focus fallback when a saved or cancelled input is removed", () => {
        const previous = new Element(); previous.isConnected = false;
        documentListeners.focusin({ target: previous }); replay.effects[1]();
        expect(next.focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    });
});
