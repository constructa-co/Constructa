import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "./page";
import { SidebarBrand } from "@/components/sidebar-brand";
import { RECOVERY_LINK_EXPIRED_MESSAGE } from "@/lib/auth-recovery-link-failure";

const auth = vi.hoisted(() => ({
    createClient: vi.fn(),
    resetPasswordForEmail: vi.fn(),
}));
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

const address = { search: "", origin: "https://example.test" };
const history = { replaceState: vi.fn() };

beforeEach(() => {
    state.slots = [];
    state.cursor = 0;
    state.effects = [];
    address.search = "";
    history.replaceState.mockReset();
    auth.createClient.mockReset();
    auth.resetPasswordForEmail.mockReset();
    auth.createClient.mockReturnValue({
        auth: { resetPasswordForEmail: auth.resetPasswordForEmail },
    });
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

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function html() {
    state.cursor = 0;
    return renderToStaticMarkup(ForgotPasswordPage());
}
function emailInput() {
    state.cursor = 0;
    return nodes(ForgotPasswordPage()).find(e => e.type === "input" && e.props.id === "email")!;
}
function fillEmail(value: string) {
    (emailInput().props.onChange as (event: { target: { value: string } }) => void)({
        target: { value },
    });
}
function submitForgot() {
    state.cursor = 0;
    const form = nodes(ForgotPasswordPage()).find(e => e.type === "form")!;
    return (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
        preventDefault: vi.fn(),
    });
}

describe("forgot-password submitted-address confirmation (A091)", () => {
    it("confirms the trimmed address from submit time after a deferred success, not a later edit", async () => {
        fillEmail("  request-a@example.invalid  ");
        let resolveReset!: (value: { error: null }) => void;
        auth.resetPasswordForEmail.mockReturnValue(
            new Promise(resolve => {
                resolveReset = resolve;
            }),
        );

        const pending = submitForgot();
        fillEmail("draft-b@example.invalid");

        resolveReset({ error: null });
        await pending;

        expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("request-a@example.invalid", {
            redirectTo: "https://example.test/auth/reset-password",
        });
        expect(html()).toContain("request-a@example.invalid");
        expect(html()).not.toContain("draft-b@example.invalid");
        expect(state.slots[0]).toBe("draft-b@example.invalid");
    });

    it("keeps a later edit and stays on the form when the deferred request returns an error", async () => {
        fillEmail("request-a@example.invalid");
        let resolveReset!: (value: { error: { message: string } }) => void;
        auth.resetPasswordForEmail.mockReturnValue(
            new Promise(resolve => {
                resolveReset = resolve;
            }),
        );

        const pending = submitForgot();
        fillEmail("draft-b@example.invalid");

        resolveReset({ error: { message: "rate limited" } });
        await pending;

        expect(html()).not.toContain("Check your email");
        expect(html()).toContain("rate limited");
        expect(emailInput().props.value).toBe("draft-b@example.invalid");
        expect(emailInput().props.disabled).toBeFalsy();
    });

    it("keeps a later edit and releases busy state when the deferred request rejects", async () => {
        fillEmail("request-a@example.invalid");
        let rejectReset!: (reason: Error) => void;
        auth.resetPasswordForEmail.mockReturnValue(
            new Promise((_, reject) => {
                rejectReset = reject;
            }),
        );

        const pending = submitForgot();
        fillEmail("draft-b@example.invalid");

        rejectReset(new Error("transport failure"));
        await pending;

        expect(html()).not.toContain("Check your email");
        expect(html()).toContain("transport failure");
        expect(emailInput().props.value).toBe("draft-b@example.invalid");
        expect(emailInput().props.disabled).toBeFalsy();
    });
});
