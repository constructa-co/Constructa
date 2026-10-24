import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLaunchLandingPath } from "@/lib/launch-profile";
import { PLATFORM_TERMS_CURRENT_REVISION } from "@/lib/platform-terms";
import type { PlatformSignupResult } from "@/lib/platform-signup-action";

const state = vi.hoisted(() => ({
    slots: [] as unknown[], cursor: 0,
    signIn: vi.fn(), signUp: vi.fn(), browserSignUp: vi.fn(), push: vi.fn(), refresh: vi.fn(),
}));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = state.cursor++;
        if (!(index in state.slots)) state.slots[index] = initial;
        return [state.slots[index], (value: unknown) => { state.slots[index] = value; }];
    },
}));
vi.mock("@/lib/supabase/client", () => ({
    createClient: () => ({ auth: { signInWithPassword: state.signIn, signUp: state.browserSignUp } }),
}));
// The page calls the action; its real gate/auth/recorder contract has separate offline coverage.
vi.mock("@/lib/platform-signup-action", () => ({ platformSignupAction: state.signUp }));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: state.push, refresh: state.refresh }),
}));
import LoginPage from "./page";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function render() { state.cursor = 0; return LoginPage(); }
const html = () => renderToStaticMarkup(render());
function choose(mode: "signup" | "signin") {
    const buttons = nodes(render()).filter(e => e.type === "button" && e.props.type === "button");
    const control = buttons.find(e => "aria-pressed" in e.props &&
        e.props.children === (mode === "signup" ? "Get started" : "Sign in")) ??
        buttons.find(e => e.props.children === (mode === "signup" ? "Sign up" : "Sign in"));
    expect(control).toBeDefined();
    (control!.props.onClick as () => void)();
}
function input(id: string) {
    return nodes(render()).find(e => e.type === "input" && e.props.id === id)!;
}
function fill(id: string, value: string) {
    (input(id).props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
}
function accept(checked: boolean) {
    (input("platform-terms").props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked } });
}
function signup() {
    choose("signup");
    fill("email", "contractor@example.invalid");
    fill("password", "not-a-real-password");
    fill("confirm", "not-a-real-password");
}
async function submit() {
    const form = nodes(render()).find(e => e.type === "form")!;
    const preventDefault = vi.fn();
    await (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
}

beforeEach(() => {
    state.slots = []; state.cursor = 0;
    for (const mock of [state.signIn, state.signUp, state.browserSignUp, state.push, state.refresh]) mock.mockReset();
    state.signIn.mockResolvedValue({ error: null });
    state.signUp.mockResolvedValue({ ok: true, outcome: "confirmation-required" });
    vi.stubGlobal("location", { origin: "https://constructa.example.invalid" });
});
afterEach(() => {
    expect(state.browserSignUp).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
});

describe("platform terms contract in the actual login layout", () => {
    it("offers a required unchecked signup-only checkbox with a separate full-terms link", () => {
        expect(input("platform-terms")).toBeUndefined();
        signup();
        expect(input("platform-terms").props).toMatchObject({ type: "checkbox", required: true, checked: false });
        const elements = nodes(render());
        const label = elements.find(e => e.type === "label" && e.props.htmlFor === "platform-terms")!;
        expect(renderToStaticMarkup(label)).toContain("I accept Constructa&#x27;s platform terms of service.");
        const link = elements.find(e => e.props.href === "/terms-of-service")!;
        expect(link.props).toMatchObject({
            children: "Read the full platform terms (opens in a new tab)",
            target: "_blank", rel: "noopener noreferrer",
        });
        expect(nodes(label).some(e => e.props.href === "/terms-of-service")).toBe(false);
        expect(html()).not.toMatch(/id="platform-terms"[^>]*checked/);
        expect(state.signUp).not.toHaveBeenCalled();
    });

    it.each([false, true])("refuses synthetic submission without acceptance after prior acceptance %s", async prior => {
        signup();
        if (prior) { accept(true); accept(false); }
        await submit();
        expect(html()).toContain("Please accept the platform terms of service before creating an account.");
        expect(state.signUp).not.toHaveBeenCalled();
        expect(state.signIn).not.toHaveBeenCalled();
        expect(state.push).not.toHaveBeenCalled();
        expect(state.refresh).not.toHaveBeenCalled();
        expect(input("platform-terms").props.disabled).toBe(false);
    });

    it("passes explicit acceptance and trusted revision to the action and retains confirmation honesty", async () => {
        signup(); accept(true); await submit();
        expect(state.signUp).toHaveBeenCalledExactlyOnceWith({
            email: "contractor@example.invalid", password: "not-a-real-password",
            acceptance: true, revision: PLATFORM_TERMS_CURRENT_REVISION,
        });
        expect(html()).toContain("Account created. Check your email for the confirmation link — once confirmed, sign in to get started.");
        expect(html()).not.toContain("Please accept the platform terms");
        expect(state.signIn).not.toHaveBeenCalled();
        expect(state.push).not.toHaveBeenCalled();
        expect(state.refresh).not.toHaveBeenCalled();
    });

    it("shows typed action refusal and permits an explicit accepted retry", async () => {
        signup(); await submit(); accept(true);
        state.signUp.mockResolvedValueOnce({ ok: false, code: "signup-failed" });
        await submit();
        expect(html()).toContain("We couldn&#x27;t create your account. Please try again.");
        expect(html()).not.toContain("Please accept the platform terms");
        expect(input("platform-terms").props.disabled).toBe(false);
        await submit();
        expect(state.signUp).toHaveBeenCalledTimes(2);
        expect(html()).toContain("Account created.");
        expect(state.push).not.toHaveBeenCalled();
    });

    it("clears acceptance on mode changes while preserving credentials and the signin contract", async () => {
        signup(); accept(true); choose("signin");
        expect(input("platform-terms")).toBeUndefined();
        await submit();
        expect(state.signIn).toHaveBeenCalledExactlyOnceWith({
            email: "contractor@example.invalid", password: "not-a-real-password",
        });
        expect(state.push).toHaveBeenCalledExactlyOnceWith(getLaunchLandingPath());
        expect(state.refresh).toHaveBeenCalledOnce();
        choose("signup");
        expect(input("platform-terms").props.checked).toBe(false);
        expect(input("confirm").props.value).toBe("");
        fill("confirm", "not-a-real-password"); await submit();
        expect(state.signUp).not.toHaveBeenCalled();
    });

    it.each([["short", "short", "at least 8"], ["not-a-real-password", "different", "match"]])(
        "retains existing password validation for %s", async (password, confirm, message) => {
            signup(); fill("password", password); fill("confirm", confirm); await submit();
            expect(html()).toContain(message);
            expect(state.signUp).not.toHaveBeenCalled();
        },
    );

    it("disables only the added checkbox with the existing pending state", async () => {
        signup(); accept(true);
        let release!: (result: PlatformSignupResult) => void;
        state.signUp.mockReturnValue(new Promise(resolve => { release = resolve; }));
        const pending = submit();
        expect(input("platform-terms").props.disabled).toBe(true);
        expect(html()).toContain("Processing...");
        release({ ok: true, outcome: "confirmation-required" }); await pending;
    });

    it("retains signin errors and never invokes signup from signin mode", async () => {
        state.signIn.mockResolvedValue({ error: { message: "Synthetic signin refused" } });
        await submit();
        expect(html()).toContain("Synthetic signin refused");
        expect(input("platform-terms")).toBeUndefined();
        expect(state.signUp).not.toHaveBeenCalled();
        expect(state.push).not.toHaveBeenCalled();
        expect(state.refresh).not.toHaveBeenCalled();
    });

    it("shows the disabled server gate without claiming an account or consent exists", async () => {
        state.signUp.mockResolvedValue({ ok: false, code: "signup-disabled" });
        signup(); accept(true); await submit();
        expect(state.signUp).toHaveBeenCalledTimes(1);
        expect(html()).toContain("Sign-up is currently disabled.");
        expect(html()).not.toContain("Account created");
        expect(state.push).not.toHaveBeenCalled();
    });

    it("reports unstored consent without silent signup retry or a success banner", async () => {
        state.signUp.mockResolvedValue({ ok: false, code: "consent-not-stored" });
        signup(); accept(true); await submit();
        expect(state.signUp).toHaveBeenCalledTimes(1);
        expect(html()).toContain("Your account was created, but we couldn&#x27;t record your terms acceptance.");
        expect(html()).not.toContain("your acceptance of the platform terms is recorded");
        expect(html()).toContain('role="alert"');
        expect(state.push).not.toHaveBeenCalled();
    });

    it("claims recorded acceptance only after the action explicitly acknowledges it", async () => {
        state.signUp.mockResolvedValue({ ok: true, outcome: "created-and-recorded", userId: "synthetic-user" });
        signup(); accept(true); await submit();
        expect(html()).toContain("Account created and your acceptance of the platform terms is recorded.");
        expect(state.signUp).toHaveBeenCalledTimes(1);
        expect(state.push).not.toHaveBeenCalled();
    });
});
