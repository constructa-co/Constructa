import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A023 transport recovery (Rob 18:15) — actual LoginPage signup handler
// cases for a rejected server-action transport promise, which the action's
// own typed errors cannot represent. Follows the existing actual-component
// test pattern (platform-terms.test.tsx): real page module, mocked react
// useState, browser client, navigation and the server action's transport.

const state = vi.hoisted(() => ({
    slots: [] as unknown[], cursor: 0,
    signIn: vi.fn(), push: vi.fn(), refresh: vi.fn(),
    signupAction: vi.fn(),
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
    createClient: () => ({ auth: { signInWithPassword: state.signIn } }),
}));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: state.push, refresh: state.refresh }),
}));
vi.mock("@/lib/platform-signup-action", () => ({
    platformSignupAction: state.signupAction,
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
    accept(true);
}
function submit() {
    const form = nodes(render()).find(e => e.type === "form")!;
    return (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
        preventDefault: vi.fn(),
    });
}

beforeEach(() => {
    state.slots = []; state.cursor = 0;
    for (const mock of [state.signIn, state.push, state.refresh, state.signupAction]) mock.mockReset();
    state.signIn.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllGlobals());

describe("signup transport rejection recovery in the actual login page", () => {
    it("clears pending after a deferred transport rejection and preserves every draft input", async () => {
        signup();
        let rejectTransport!: (reason: Error) => void;
        state.signupAction.mockReturnValue(new Promise((_, reject) => { rejectTransport = reject; }));

        const pending = submit();
        // While the transport promise is unresolved the form stays pending
        // and the existing controls remain disabled.
        expect(input("platform-terms").props.disabled).toBe(true);
        expect(html()).toContain("Processing...");

        rejectTransport(new Error("synthetic transport failure"));
        await pending;

        // Pending cleared, fixed ambiguous-outcome copy shown.
        expect(input("platform-terms").props.disabled).toBe(false);
        expect(html()).toContain("We couldn&#x27;t confirm whether your account was created. Please try signing in before creating another account.");
        expect(html()).not.toContain("Processing...");
        // Draft state untouched: email, password, confirmation, acceptance.
        expect(input("email").props.value).toBe("contractor@example.invalid");
        expect(input("password").props.value).toBe("not-a-real-password");
        expect(input("confirm").props.value).toBe("not-a-real-password");
        expect(input("platform-terms").props.checked).toBe(true);
        // No success claim, exactly one action attempt, no sign-in shortcut.
        expect(html()).not.toContain("Account created.");
        expect(state.signupAction).toHaveBeenCalledTimes(1);
        expect(state.signIn).not.toHaveBeenCalled();
        expect(state.push).not.toHaveBeenCalled();
    });

    it("shows only fixed redacted copy when the rejection carries sensitive detail", async () => {
        signup();
        state.signupAction.mockRejectedValue(new Error("gateway timeout auth-key hunter2 internal"));

        await submit();

        expect(html()).toContain("We couldn&#x27;t confirm whether your account was created. Please try signing in before creating another account.");
        // Raw transport detail never reaches the UI.
        expect(html()).not.toContain("hunter2");
        expect(html()).not.toContain("gateway timeout");
        expect(html()).not.toContain("auth-key");
        expect(html()).not.toContain("internal");
        // No automatic retry: one action call, no Auth call.
        expect(state.signupAction).toHaveBeenCalledTimes(1);
        expect(state.signIn).not.toHaveBeenCalled();
        expect(html()).not.toContain("Account created.");
    });

    it("recovers from a synchronously thrown action boundary the same way", async () => {
        signup();
        state.signupAction.mockImplementationOnce(() => {
            throw new Error("synchronous action boundary explosion");
        });

        await submit();

        expect(html()).toContain("We couldn&#x27;t confirm whether your account was created. Please try signing in before creating another account.");
        expect(html()).not.toContain("synchronous action boundary explosion");
        expect(input("platform-terms").props.disabled).toBe(false);
        expect(state.signupAction).toHaveBeenCalledTimes(1);
        expect(state.signIn).not.toHaveBeenCalled();
    });
});
