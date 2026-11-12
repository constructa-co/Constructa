import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const current = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, theme: "dark", setItem: vi.fn() }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(), useEffect: () => undefined,
    useState: (initial: unknown) => {
        const index = current.cursor++;
        if (!(index in current.slots)) current.slots[index] = initial;
        return [current.slots[index], (value: unknown) => { current.slots[index] = typeof value === "function" ? value(current.slots[index]) : value; }];
    },
    useRef: (initial: unknown) => {
        const index = current.cursor++;
        if (!(index in current.slots)) current.slots[index] = { current: initial };
        return current.slots[index];
    },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: current.theme, setTheme: vi.fn() }) }));
import SidebarNav from "./sidebar-nav";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const e = value as Element; return [e, ...nodes(e.props.children)];
}
function view() { current.cursor = 0; return SidebarNav({ user: {}, projects: [] }); }
function section() {
    const e = nodes(view()).find(e => e.props.sectionKey === "company-profile")!;
    return (e.type as (props: Record<string, unknown>) => Element)(e.props);
}
beforeEach(() => {
    current.slots = []; current.cursor = 0; current.theme = "dark"; current.setItem.mockReset();
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: current.setItem, removeItem: vi.fn() });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("sidebar section readability and unchanged disclosure callback", () => {
    it.each(["dark", "system-c"])("exposes state and preserves the actual accordion action in %s", theme => {
        current.theme = theme; vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
        let button = nodes(section()).find(e => e.type === "button")!;
        expect(button.props.type).toBe("button"); expect(button.props["aria-expanded"]).toBe(false);
        expect(button.props.className).toContain("min-h-11"); expect(button.props.className).not.toContain("lg:min-h-0");
        expect(button.props.className).toContain("focus-visible:outline-[#c9efcf]");
        (button.props.onClick as () => void)();
        expect(current.setItem.mock.calls[0][0]).toBe("constructa_sidebar_collapsed");
        button = nodes(section()).find(e => e.type === "button")!;
        expect(button.props["aria-expanded"]).toBe(true);
        (button.props.onClick as () => void)();
        expect(nodes(section()).find(e => e.type === "button")!.props["aria-expanded"]).toBe(false);
    });
    it("uses readable labels and a larger decorative chevron in both states", () => {
        for (let n = 0; n < 2; n++) {
            const elements = nodes(section()), label = elements.find(e => e.type === "span")!;
            expect(label.props.className).toContain("text-xs leading-5"); expect(label.props.className).toContain("text-[#b7c8bb]");
            const chevron = elements.find(e => e.props.className && String(e.props.className).includes("transition-colors") && e.type !== "span")!;
            expect(chevron.props.className).toContain("w-4 h-4"); expect(chevron.props.className).toContain("text-[#b7c8bb]");
            expect(chevron.props["aria-hidden"]).toBe(true);
            (elements.find(e => e.type === "button")!.props.onClick as () => void)();
        }
    });
    it.each(["cohort", "full"])("uses the same label treatment in the actual phone menu for %s", profile => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", profile);
        const opener = nodes(view()).find(e => e.props["aria-label"] === "Open menu")!;
        (opener.props.onClick as () => void)();
        const elements = nodes(view());
        const label = elements.find(e => e.type === "label" && e.props.htmlFor === "phone-active-project")!;
        expect(label.props.className).toContain("text-xs leading-5");
        expect(label.props.className).toContain("text-[#b7c8bb]");
        const select = elements.find(e => e.props.id === "phone-active-project")!;
        expect(select.props.value).toBe(""); expect(typeof select.props.onChange).toBe("function");
    });
});
