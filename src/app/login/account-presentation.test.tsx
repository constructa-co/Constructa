import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLaunchLandingPath } from "@/lib/launch-profile";
import { PLATFORM_TERMS_CURRENT_REVISION } from "@/lib/platform-terms";
import type { PlatformSignupResult } from "@/lib/platform-signup-action";

const state = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, signIn: vi.fn(), signUp: vi.fn(), browserSignUp: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = state.cursor++;
        if (!(index in state.slots)) state.slots[index] = initial;
        return [state.slots[index], (value: unknown) => { state.slots[index] = value; }];
    },
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signInWithPassword: state.signIn, signUp: state.browserSignUp } }) }));
vi.mock("@/lib/platform-signup-action", () => ({ platformSignupAction: state.signUp }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push, refresh: state.refresh }) }));
import LoginPage from "./page";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function render() { state.cursor = 0; return LoginPage(); }
function choose(mode: "signup" | "signin") {
    const control = nodes(render()).find(e => e.type === "button" && e.props.children === (mode === "signup" ? "Get started" : "Sign in") && "aria-pressed" in e.props);
    (control!.props.onClick as () => void)();
}
function fill(id: string, value: string) {
    const input = nodes(render()).find(e => e.type === "input" && e.props.id === id);
    (input!.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
}
async function submit() {
    const form = nodes(render()).find(e => e.type === "form")!;
    const preventDefault = vi.fn();
    await (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
}
const html = () => renderToStaticMarkup(render());

function acceptTerms(checked: boolean) {
    const input = nodes(render()).find(e => e.type === "input" && e.props.id === "platform-terms")!;
    (input.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked } });
}
function fillSignup() {
    choose("signup");
    fill("email", "contractor@example.invalid");
    fill("password", "not-a-real-password");
    fill("confirm", "not-a-real-password");
}

beforeEach(() => {
    state.slots = []; state.cursor = 0;
    for (const mock of [state.signIn, state.signUp, state.browserSignUp, state.push, state.refresh]) mock.mockReset();
    state.signIn.mockResolvedValue({ error: null });
    state.signUp.mockResolvedValue({ ok: true, outcome: "confirmation-required" });
});
afterEach(() => expect(state.browserSignUp).not.toHaveBeenCalled());

describe("actual signup platform terms acceptance", () => {
    beforeEach(() => vi.stubGlobal("location", { origin: "https://constructa.example.invalid" }));
    afterEach(() => vi.unstubAllGlobals());

    it("offers a native required unchecked checkbox and a separate named full-terms link only in signup", () => {
        expect(nodes(render()).some(e => e.props.id === "platform-terms")).toBe(false);
        fillSignup();
        const elements = nodes(render());
        const checkbox = elements.find(e => e.type === "input" && e.props.id === "platform-terms")!;
        expect(checkbox.props.type).toBe("checkbox");
        expect(checkbox.props.required).toBe(true);
        expect(checkbox.props.checked).toBe(false);
        const label = elements.find(e => e.type === "label" && e.props.htmlFor === "platform-terms")!;
        expect(renderToStaticMarkup(label)).toContain("I accept Constructa&#x27;s platform terms of service.");
        const link = elements.find(e => e.props.href === "/terms-of-service")!;
        expect(link.props.children).toBe("Read the full platform terms (opens in a new tab)");
        expect(link.props.target).toBe("_blank");
        expect(link.props.rel).toBe("noopener noreferrer");
        expect(nodes(label).some(e => e.props.href === "/terms-of-service")).toBe(false);
        expect(html()).not.toMatch(/id="platform-terms"[^>]*checked/);
        expect(state.signUp).not.toHaveBeenCalled();
    });

    it.each([false, true])("rejects synthetic submission without acceptance, previously checked: %s", async previouslyChecked => {
        fillSignup();
        if (previouslyChecked) { acceptTerms(true); acceptTerms(false); }
        await submit();
        expect(state.signUp).not.toHaveBeenCalled();
        expect(state.signIn).not.toHaveBeenCalled();
        expect(state.push).not.toHaveBeenCalled();
        expect(state.refresh).not.toHaveBeenCalled();
        expect(html()).toContain('role="alert"');
        expect(html()).toContain("Please accept the platform terms of service before creating an account.");
        expect(nodes(render()).find(e => e.type === "form")?.props["aria-busy"]).toBe(false);
    });

    it("uses the explicit server consent payload and preserves the confirmation contract", async () => {
        fillSignup(); acceptTerms(true); await submit();
        expect(state.signUp).toHaveBeenCalledExactlyOnceWith({
            email: "contractor@example.invalid",
            password: "not-a-real-password",
            acceptance: true, revision: PLATFORM_TERMS_CURRENT_REVISION,
        });
        expect(html()).toContain("Account created. Check your email for the confirmation link — once confirmed, sign in to get started.");
        expect(html()).toContain("Check your inbox.");
        expect(html()).not.toContain('role="alert"');
        expect(state.push).not.toHaveBeenCalled();
        expect(state.refresh).not.toHaveBeenCalled();
        expect(state.signIn).not.toHaveBeenCalled();
    });

    it("shows typed signup errors and clears a prior acceptance error on accepted resubmission", async () => {
        fillSignup(); await submit();
        state.signUp.mockResolvedValue({ ok: false, code: "signup-failed" });
        acceptTerms(true); await submit();
        expect(state.signUp).toHaveBeenCalledOnce();
        expect(html()).toContain('role="alert"');
        expect(html()).toContain("We couldn&#x27;t create your account. Please try again.");
        expect(html()).not.toContain("Please accept the platform terms");
        expect(html()).not.toContain("Check your inbox.");
        expect(nodes(render()).find(e => e.type === "form")?.props["aria-busy"]).toBe(false);
        expect(state.push).not.toHaveBeenCalled();
        expect(state.refresh).not.toHaveBeenCalled();
    });

    it("resets acceptance on deliberate mode changes without changing signin or entered credentials", async () => {
        fillSignup(); acceptTerms(true); choose("signup");
        expect(nodes(render()).find(e => e.props.id === "platform-terms")?.props.checked).toBe(true);
        choose("signin");
        expect(nodes(render()).some(e => e.props.id === "platform-terms")).toBe(false);
        await submit();
        expect(state.signIn).toHaveBeenCalledExactlyOnceWith({ email: "contractor@example.invalid", password: "not-a-real-password" });
        expect(state.push).toHaveBeenCalledExactlyOnceWith(getLaunchLandingPath());
        expect(state.refresh).toHaveBeenCalledOnce();
        choose("signup");
        expect(nodes(render()).find(e => e.props.id === "platform-terms")?.props.checked).toBe(false);
        fill("confirm", "not-a-real-password"); await submit();
        expect(state.signUp).not.toHaveBeenCalled();
        expect(html()).toContain("Please accept the platform terms");
    });

    it("disables the acceptance checkbox with the existing pending signup controls", async () => {
        fillSignup(); acceptTerms(true);
        let release!: (value: PlatformSignupResult) => void;
        state.signUp.mockReturnValue(new Promise(resolve => { release = resolve; }));
        const pending = submit();
        expect(nodes(render()).filter(e => e.type === "input").every(e => e.props.disabled)).toBe(true);
        expect(html()).toContain('aria-busy="true"');
        expect(html()).toContain("Processing...");
        release({ ok: true, outcome: "confirmation-required" }); await pending;
    });
});

describe("actual sign-in/signup presentation boundary", () => {
    it("does not present account setup as sign-in progress", () => {
        const view = html();
        expect(view).toContain("Welcome back.");
        expect(view).not.toContain('aria-label="Getting started"');
        expect(view).not.toContain('aria-current="step"');
        expect(view).toMatch(/autocomplete="current-password"/i);
        expect(nodes(render()).find(e => e.props.id === "password")?.props.autoComplete).toBe("current-password");
        expect(view).toContain('href="/auth/forgot-password"');
        expect(state.signIn).not.toHaveBeenCalled(); expect(state.signUp).not.toHaveBeenCalled();
    });

    it("shows the existing account step only when signup is deliberately selected", () => {
        choose("signup"); const view = html();
        expect(view).toContain('aria-label="Getting started"');
        expect(view).toMatch(/<li aria-current="step"><span aria-hidden="true">1<\/span>Account<\/li>/);
        expect(view).toContain("The essentials"); expect(view).toContain("Your workspace");
        expect(view).toContain('id="confirm"'); expect(view).toMatch(/autocomplete="new-password"/i);
        expect(nodes(render()).find(e => e.props.id === "password")?.props.autoComplete).toBe("new-password");
        expect(state.signUp).not.toHaveBeenCalled();
    });

    it("removes signup progress again on return to sign-in without dropping entered credentials", () => {
        fill("email", "contractor@example.invalid"); fill("password", "not-a-real-password");
        choose("signup"); fill("confirm", "different"); choose("signin");
        const view = html(); expect(view).not.toContain('aria-label="Getting started"');
        expect(view).toContain('value="contractor@example.invalid"'); expect(view).toContain('value="not-a-real-password"');
        expect(view).not.toContain('id="confirm"');
        choose("signup"); expect(html()).toMatch(/id="confirm"[^>]*value=""/);
    });

    it("retains the existing sign-in request and landing route", async () => {
        fill("email", "contractor@example.invalid"); fill("password", "not-a-real-password");
        await submit();
        expect(state.signIn).toHaveBeenCalledExactlyOnceWith({ email: "contractor@example.invalid", password: "not-a-real-password" });
        expect(state.push).toHaveBeenCalledExactlyOnceWith(getLaunchLandingPath());
        expect(state.refresh).toHaveBeenCalledOnce(); expect(state.signUp).not.toHaveBeenCalled();
    });

    it("keeps sign-in failure visible without a setup indicator or navigation", async () => {
        state.signIn.mockResolvedValue({ error: { message: "Test sign-in refused" } });
        await submit(); const view = html();
        expect(view).toContain('role="alert"'); expect(view).toContain("Test sign-in refused");
        expect(view).not.toContain('aria-label="Getting started"'); expect(state.push).not.toHaveBeenCalled();
    });

    it.each([["short", "short", "at least 8"], ["not-a-real-password", "different-password", "match"]])("retains signup validation for %s", async (password, confirm, message) => {
        choose("signup"); fill("password", password); fill("confirm", confirm); await submit();
        expect(html()).toContain(message); expect(state.signUp).not.toHaveBeenCalled();
        expect(html()).toContain('aria-label="Getting started"');
    });

    it("retains pending control disabling without showing setup progress", async () => {
        let release!: (value: { error: null }) => void;
        state.signIn.mockReturnValue(new Promise(resolve => { release = resolve; }));
        const pending = submit(); const view = html();
        expect(view).toContain('aria-busy="true"'); expect(view).toContain("Processing...");
        expect(nodes(render()).filter(e => e.type === "input").every(e => e.props.disabled)).toBe(true);
        expect(view).not.toContain('aria-label="Getting started"');
        release({ error: null }); await pending;
    });
});
