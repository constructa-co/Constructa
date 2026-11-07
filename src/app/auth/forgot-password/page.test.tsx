import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "./page";
import { SidebarBrand } from "@/components/sidebar-brand";
import { RECOVERY_LINK_EXPIRED_MESSAGE } from "@/lib/auth-recovery-link-failure";

const auth = vi.hoisted(() => ({ createClient: vi.fn() }));
const state = vi.hoisted(() => ({
    slots: [] as unknown[],
    cursor: 0,
    effects: [] as Array<() => void | (() => void)>,
}));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = state.cursor++;
        if (!(index in state.slots)) state.slots[index] = initial;
        return [state.slots[index], (value: unknown) => { state.slots[index] = value; }];
    },
    useEffect: (effect: () => void | (() => void)) => { state.effects.push(effect); },
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: auth.createClient }));

const address = { search: "" };
const history = { replaceState: vi.fn() };

beforeEach(() => {
    state.slots = [];
    state.cursor = 0;
    state.effects = [];
    address.search = "";
    history.replaceState.mockReset();
    vi.stubGlobal("window", { location: address, history });
});
afterEach(() => vi.unstubAllGlobals());

function renderForgot() {
    state.cursor = 0;
    return ForgotPasswordPage();
}
function hydrateForgot() {
    renderForgot();
    state.effects.splice(0).forEach(effect => effect());
}

describe("password recovery brand (A002)", () => {
    it("uses the shared wordmark while retaining the reset form and making no auth request", () => {
        const html = renderToStaticMarkup(renderForgot());
        const brand = renderToStaticMarkup(<SidebarBrand />);

        expect(html).toContain(brand);
        expect(html).not.toMatch(/>\s*CONSTRUCTA\s*</);
        expect(html).toContain(`<a class="text-3xl font-bold tracking-tight" href="/">${brand}</a>`);
        expect(html).toContain("Reset your password");
        expect(html).toContain('type="email"');
        expect(html).toContain("Send reset link");
        expect(auth.createClient).not.toHaveBeenCalled();
    });

    it("shows the expired-link notice after hydration when the proxy normalises the address", () => {
        address.search = "?notice=link-expired";
        hydrateForgot();
        const html = renderToStaticMarkup(renderForgot());
        expect(html).toContain(RECOVERY_LINK_EXPIRED_MESSAGE);
        expect(html).toContain('role="alert"');
        expect(history.replaceState).toHaveBeenCalledWith(null, "", "/auth/forgot-password");
    });
});
