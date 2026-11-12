import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { profileUpdateFromForm } from "@/lib/profile-update";

// A030: the actual ProfileForm accreditation editor through the same
// controlled-hook seam as the A031 trade tests. Each step calls the rendered
// control's own handler and reads the rendered hidden input, which is what the
// browser posts as `accreditations`.
const current = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, save: vi.fn(), guard: vi.fn() }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = typeof initial === "function" ? (initial as () => unknown)() : initial;
        return [current.slots[i], (next: unknown) => { current.slots[i] = typeof next === "function" ? (next as (v: unknown) => unknown)(current.slots[i]) : next; }];
    },
    useRef: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = { current: initial };
        return current.slots[i];
    },
    useEffect: () => undefined,
}));
vi.mock("./actions", () => ({ updateProfileAction: current.save, rewriteWithAIAction: vi.fn(), rewriteMdMessageAction: vi.fn() }));
vi.mock("@/app/storage/actions", () => ({ uploadProfileImageAction: vi.fn() }));
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: current.guard }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import ProfileForm from "./profile-form";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function text(value: unknown): string {
    if (Array.isArray(value)) return value.map(text).join("");
    if (typeof value === "string" || typeof value === "number") return String(value);
    return value && typeof value === "object" && "props" in value ? text((value as Element).props.children) : "";
}
let profile: Record<string, unknown> = {};
function view() {
    current.cursor = 0;
    const tree = nodes(ProfileForm({ profile: profile as never, userEmail: "sam@example.invalid" }));
    const editor = tree.find(e => e.props["data-profile-accreditations"] !== undefined)!;
    const inside = nodes(editor.props.children);
    const posted = tree.filter(e => e.props.name === "accreditations");
    return {
        inside,
        posted,
        value: String(posted[0]!.props.value),
        entries: inside.filter(e => e.type === "li").map(li => text(nodes(li.props.children).find(e => e.type === "span")!.props.children)),
        box: inside.find(e => e.type === "input" && e.props.id === "company-accreditations")!,
        notice: text(inside.find(e => e.props["aria-live"] === "polite")!.props.children),
    };
}
const type = (value: string) => (view().box.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
const add = () => (view().inside.find(e => e.type === "button" && text(e.props.children).trim() === "Add accreditation")!.props.onClick as () => void)();
const enter = () => {
    const preventDefault = vi.fn();
    (view().box.props.onKeyDown as (event: unknown) => void)({ key: "Enter", nativeEvent: { isComposing: false }, preventDefault });
    return preventDefault;
};
const remove = (entry: string) => (view().inside.find(e => e.type === "button" && e.props["aria-label"] === `Remove ${entry}`)!.props.onClick as () => void)();
/** What the profile action stores from the posted value. */
const stored = () => {
    const data = new FormData();
    for (const input of view().posted) data.append("accreditations", String(input.props.value));
    return profileUpdateFromForm("user-1", data).accreditations;
};

beforeEach(() => { current.slots = []; current.cursor = 0; current.save.mockReset(); });

describe("A030 accreditations list editor", () => {
    it("labels the add box, uses button controls, and posts exactly one accreditations value", () => {
        profile = { company_name: "Example", accreditations: null };
        const v = view();
        expect(v.posted).toHaveLength(1);
        expect(v.posted[0]!.props.type).toBe("hidden");
        expect(v.box.props.name).toBeUndefined();
        expect(v.box.props["aria-describedby"]).toBe("company-accreditations-hint");
        expect(v.inside.find(e => e.type === "label")!.props.htmlFor).toBe("company-accreditations");
        for (const button of v.inside.filter(e => e.type === "button")) expect(button.props.type).toBe("button");
        expect(v.entries).toEqual([]);
        expect(v.value).toBe("");
    });

    it("keeps a legacy comma-containing value as one entry and posts it back exactly while untouched", () => {
        profile = { company_name: "Example", accreditations: "CITB, FMB Member, NHBC Registered" };
        const v = view();
        expect(v.entries).toEqual(["CITB, FMB Member, NHBC Registered"]);
        expect(v.value).toBe("CITB, FMB Member, NHBC Registered");
        expect(stored()).toBe("CITB, FMB Member, NHBC Registered");
    });

    it("posts untouched raw stored text byte for byte, including its own spacing and line breaks", () => {
        const raw = " Register A;\r\n(member text) \n\n";
        profile = { company_name: "Example", accreditations: raw };
        const v = view();
        expect(v.entries).toEqual(["Register A;", "(member text)"]);
        expect(v.value).toBe(raw);
        expect(stored()).toBe(raw);
    });

    it("adds one, then another, by button and by Enter, keeping punctuation and wording as typed", () => {
        profile = { company_name: "Example", accreditations: "CITB, FMB Member" };
        type("  NHBC Registered  ");
        add();
        expect(view().box.props.value).toBe("");
        type("Gas Safe (reg. 123), member – Level 3");
        const preventDefault = enter();
        expect(preventDefault).toHaveBeenCalledOnce();
        const v = view();
        expect(v.entries).toEqual(["CITB, FMB Member", "NHBC Registered", "Gas Safe (reg. 123), member – Level 3"]);
        expect(v.value).toBe("CITB, FMB Member\nNHBC Registered\nGas Safe (reg. 123), member – Level 3");
        expect(v.notice).toBe("Added Gas Safe (reg. 123), member – Level 3. 3 in the list.");
        expect(stored()).toBe("CITB, FMB Member\nNHBC Registered\nGas Safe (reg. 123), member – Level 3");
        expect(current.save).not.toHaveBeenCalled();
    });

    it("removes the chosen entry only, and posts an empty value once all are removed", () => {
        profile = { company_name: "Example", accreditations: "One\nTwo, with comma\nThree" };
        remove("Two, with comma");
        expect(view().entries).toEqual(["One", "Three"]);
        expect(view().value).toBe("One\nThree");
        expect(view().notice).toBe("Removed Two, with comma.");
        remove("One");
        remove("Three");
        expect(view().entries).toEqual([]);
        expect(view().value).toBe("");
        expect(stored()).toBe("");
    });

    it("does not add a blank entry and says why, leaving the stored text untouched", () => {
        profile = { company_name: "Example", accreditations: " Legacy  text " };
        type("   ");
        add();
        expect(enter()).toHaveBeenCalledOnce();
        const v = view();
        expect(v.entries).toEqual(["Legacy  text"]);
        expect(v.value).toBe(" Legacy  text ");
        expect(v.notice).toBe("Type an accreditation in the box first, then add it.");
    });

    it("saves text left in the add box with the list, so nothing visible is silently dropped", () => {
        profile = { company_name: "Example", accreditations: "CITB, FMB Member" };
        type("Not yet added, but visible");
        expect(view().value).toBe("CITB, FMB Member\nNot yet added, but visible");
        expect(stored()).toBe("CITB, FMB Member\nNot yet added, but visible");
        // Pressing Add afterwards posts the same value.
        add();
        expect(view().value).toBe("CITB, FMB Member\nNot yet added, but visible");
        // Clearing the box with the list untouched returns to the exact stored text.
        profile = { company_name: "Example", accreditations: " raw " };
        current.slots = [];
        type("x");
        type("");
        expect(view().value).toBe(" raw ");
    });
});
