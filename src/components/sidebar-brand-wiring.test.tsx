import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// KIMI A002 wiring regression (Rob15:05+16:15 authority). Intended canonical
// path: src/components/sidebar-brand-wiring.test.tsx (relative imports resolve
// there). Unlike sidebar-brand.test.tsx, which SSR-renders the pure SidebarBrand
// in isolation, this case mounts the ACTUAL SidebarNav and proves the A002
// wiring end to end: the desktop brand is the lowercase/no-dot wordmark, the
// phone header keeps its labelled /dashboard link with a decorative mark only,
// and the real "Open menu" callback renders the full wordmark in the overlay
// without touching selection, routes or storage. Same controlled
// hook/router/theme/storage seam as sidebar-readability.test.tsx; no new
// harness or dependencies.
const current = vi.hoisted(() => ({
    slots: [] as unknown[],
    cursor: 0,
    theme: "dark",
    setItem: vi.fn(),
    removeItem: vi.fn(),
    push: vi.fn(),
}));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useEffect: () => undefined,
    useState: (initial: unknown) => {
        const index = current.cursor++;
        if (!(index in current.slots)) current.slots[index] = typeof initial === "function" ? initial() : initial;
        return [current.slots[index], (value: unknown) => { current.slots[index] = typeof value === "function" ? value(current.slots[index]) : value; }];
    },
    useRef: (initial: unknown) => {
        const index = current.cursor++;
        if (!(index in current.slots)) current.slots[index] = { current: initial };
        return current.slots[index];
    },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: current.push }), usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: current.theme, setTheme: vi.fn() }) }));
import SidebarNav from "./sidebar-nav";
import { SidebarBrand } from "./sidebar-brand";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const e = value as Element;
    // Expand only the actual pure brand, not mocked router or hook components.
    if (e.type === SidebarBrand) return [e, ...nodes(SidebarBrand({ markOnly: e.props.markOnly as boolean | undefined }))];
    return [e, ...nodes(e.props.children)];
}
function text(value: unknown): string {
    if (Array.isArray(value)) return value.map(text).join(" ");
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (!value || typeof value !== "object" || !("props" in value)) return "";
    const e = value as Element;
    return text(e.type === SidebarBrand ? SidebarBrand({ markOnly: e.props.markOnly as boolean | undefined }) : e.props.children);
}
function view() { current.cursor = 0; return SidebarNav({ user: {}, projects: [] }); }
const wordmark = (root: Element) => nodes(root).some(e => e.type === "span" && e.props.children === "constructa");
const decorativeMark = (root: Element) => nodes(root).some(e => e.type === "span" && e.props.children === "C" && e.props["aria-hidden"] === "true");

beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
    current.slots = []; current.cursor = 0;
    current.setItem.mockReset(); current.removeItem.mockReset(); current.push.mockReset();
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: current.setItem, removeItem: current.removeItem });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("A002 SidebarBrand wiring inside the actual SidebarNav", () => {
    it("desktop brand is lowercase with no dot, the phone header keeps its labelled /dashboard link with a decorative mark, and opening the real menu renders the full wordmark without changing selection, routes or storage", () => {
        const closed = nodes(view());

        // Desktop aside: the /dashboard brand link carries the full lowercase
        // wordmark (no capital C wordmark, no trailing period) and the
        // aria-hidden decorative C mark.
        const desktopLink = closed
            .filter(e => e.props.href === "/dashboard" && !e.props["aria-label"])
            .find(e => wordmark(e))!;
        expect(desktopLink).toBeDefined();
        expect(wordmark(desktopLink)).toBe(true);
        expect(decorativeMark(desktopLink)).toBe(true);
        expect(text(desktopLink)).not.toMatch(/Constructa|\./);

        // Phone top bar: the /dashboard link keeps its explicit label and
        // shows the decorative mark only — the full wordmark stays out of the
        // header by design.
        const phoneLink = closed.find(e => e.props.href === "/dashboard" && e.props["aria-label"] === "Constructa pipeline")!;
        expect(phoneLink).toBeDefined();
        expect(decorativeMark(phoneLink)).toBe(true);
        expect(wordmark(phoneLink)).toBe(false);

        // The real "Open menu" callback renders the overlay with the full
        // wordmark; selection, routes and storage are untouched.
        const opener = closed.find(e => e.props["aria-label"] === "Open menu")!;
        (opener.props.onClick as () => void)();
        const opened = nodes(view());
        const overlay = opened.find(e => e.props.role === "dialog" && e.props["aria-label"] === "Menu")!;
        expect(overlay).toBeDefined();
        expect(wordmark(overlay)).toBe(true);
        expect(decorativeMark(overlay)).toBe(true);
        expect(current.push).not.toHaveBeenCalled();
        expect(current.setItem).not.toHaveBeenCalled();
        expect(current.removeItem).not.toHaveBeenCalled();
        expect(opened.find(e => e.props.id === "phone-active-project")!.props.value).toBe("");
    });
});
