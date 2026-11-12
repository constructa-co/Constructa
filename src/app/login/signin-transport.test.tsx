import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLaunchLandingPath } from "@/lib/launch-profile";
import { PLATFORM_TERMS_COMPLETION_PATH } from "@/lib/platform-terms-completion";

// Sign-in transport (Rob 21:05) — actual LoginPage handleSignIn cases for a
// returned provider error and a rejected signInWithPassword promise. Follows
// the existing actual-component test pattern (platform-signup-transport.test.tsx):
// real page module, mocked react useState, browser client and navigation.

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
function input(id: string) {
    return nodes(render()).find(e => e.type === "input" && e.props.id === id)!;
}
function fill(id: string, value: string) {
    (input(id).props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
}
function credentials() {
    fill("email", "contractor@example.invalid");
    fill("password", "not-a-real-password");
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

describe("sign-in transport recovery in the actual login page", () => {
    it("redacts a returned raw provider error and clears pending", async () => {
        credentials();
        state.signIn.mockResolvedValue({
            error: { message: "Invalid login credentials hunter2 auth-key User not found" },
        });

        await submit();

        expect(html()).toContain("We couldn&#x27;t confirm sign-in. Check your details and try again.");
        expect(html()).toContain('role="alert"');
        expect(html()).not.toContain("hunter2");
        expect(html()).not.toContain("Invalid login credentials");
        expect(html()).not.toContain("auth-key");
        expect(html()).not.toContain("User not found");
        expect(html()).not.toContain("Processing...");
        expect(input("email").props.disabled).toBe(false);
        expect(input("password").props.disabled).toBe(false);
        expect(nodes(render()).find(e => e.type === "form")?.props["aria-busy"]).toBe(false);
        expect(input("email").props.value).toBe("contractor@example.invalid");
        expect(input("password").props.value).toBe("not-a-real-password");
        expect(html()).toContain("Welcome back.");
        expect(html()).not.toContain('id="confirm"');
        expect(state.signIn).toHaveBeenCalledTimes(1);
        expect(state.signIn).toHaveBeenCalledExactlyOnceWith({
            email: "contractor@example.invalid",
            password: "not-a-real-password",
        });
        expect(state.push).not.toHaveBeenCalled();
        expect(state.refresh).not.toHaveBeenCalled();
        expect(state.signupAction).not.toHaveBeenCalled();
    });

    it("clears pending after a rejected request and retains email, password and sign-in mode", async () => {
        credentials();
        let rejectTransport!: (reason: Error) => void;
        state.signIn.mockReturnValue(new Promise((_, reject) => { rejectTransport = reject; }));

        const pending = submit();
        expect(input("email").props.disabled).toBe(true);
        expect(input("password").props.disabled).toBe(true);
        expect(html()).toContain("Processing...");
        expect(html()).toContain('aria-busy="true"');

        rejectTransport(new Error("gateway timeout auth-key hunter2 internal"));
        await pending;

        expect(html()).toContain("We couldn&#x27;t confirm sign-in. Check your details and try again.");
        expect(html()).not.toContain("Processing...");
        expect(input("email").props.disabled).toBe(false);
        expect(input("password").props.disabled).toBe(false);
        expect(nodes(render()).find(e => e.type === "form")?.props["aria-busy"]).toBe(false);
        expect(input("email").props.value).toBe("contractor@example.invalid");
        expect(input("password").props.value).toBe("not-a-real-password");
        expect(html()).toContain("Welcome back.");
        expect(html()).not.toContain('id="confirm"');
        expect(html()).not.toContain('aria-label="Getting started"');
        expect(html()).not.toContain("hunter2");
        expect(html()).not.toContain("gateway timeout");
        expect(html()).not.toContain("auth-key");
        expect(html()).not.toContain("internal");
        expect(state.signIn).toHaveBeenCalledTimes(1);
        expect(state.push).not.toHaveBeenCalled();
        expect(state.refresh).not.toHaveBeenCalled();
        expect(state.signupAction).not.toHaveBeenCalled();
    });

    it("preserves default launch landing routing on successful sign-in", async () => {
        credentials();

        await submit();

        expect(state.signIn).toHaveBeenCalledExactlyOnceWith({
            email: "contractor@example.invalid",
            password: "not-a-real-password",
        });
        expect(state.push).toHaveBeenCalledExactlyOnceWith(getLaunchLandingPath());
        expect(state.refresh).toHaveBeenCalledOnce();
        expect(state.signupAction).not.toHaveBeenCalled();
        expect(html()).not.toContain('role="alert"');
        expect(html()).not.toContain("Processing...");
        expect(nodes(render()).find(e => e.type === "form")?.props["aria-busy"]).toBe(false);
    });

    it("preserves exact platform terms completion routing on successful sign-in", async () => {
        vi.stubGlobal("location", { search: "?next=/auth/platform-terms" });
        credentials();

        await submit();

        expect(state.signIn).toHaveBeenCalledExactlyOnceWith({
            email: "contractor@example.invalid",
            password: "not-a-real-password",
        });
        expect(state.push).toHaveBeenCalledExactlyOnceWith(PLATFORM_TERMS_COMPLETION_PATH);
        expect(state.refresh).toHaveBeenCalledOnce();
        expect(state.signupAction).not.toHaveBeenCalled();
        expect(html()).not.toContain('role="alert"');
        expect(html()).not.toContain("Processing...");
        expect(nodes(render()).find(e => e.type === "form")?.props["aria-busy"]).toBe(false);
    });
});
