import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Sign-in field help in the actual LoginPage: the show/hide password control,
// the phone keyboard hints, and the link from both fields to a refused sign-in.
// Same actual-component pattern as signin-transport.test.tsx.

const state = vi.hoisted(() => ({
    slots: [] as unknown[], cursor: 0,
    signIn: vi.fn(), push: vi.fn(), refresh: vi.fn(), signupAction: vi.fn(),
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
vi.mock("@/lib/platform-signup-action", () => ({ platformSignupAction: state.signupAction }));
import LoginPage from "./page";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function render() { state.cursor = 0; return LoginPage(); }
function input(id: string) {
    return nodes(render()).find(e => e.type === "input" && e.props.id === id)!;
}
function fill(id: string, value: string) {
    (input(id).props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
}
function choose(mode: "signup" | "signin") {
    const control = nodes(render()).find(e => e.type === "button" && "aria-pressed" in e.props
        && e.props.children === (mode === "signup" ? "Get started" : "Sign in"));
    (control!.props.onClick as () => void)();
}
function toggle() {
    return nodes(render()).find(e => e.type === "button" && "aria-controls" in e.props)!;
}
const toggleLabel = () => renderToStaticMarkup(toggle()).replace(/<[^>]+>/g, "");
const press = () => (toggle().props.onClick as () => void)();
function submit() {
    const form = nodes(render()).find(e => e.type === "form")!;
    return (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({ preventDefault: vi.fn() });
}

beforeEach(() => {
    state.slots = []; state.cursor = 0;
    for (const mock of [state.signIn, state.push, state.refresh, state.signupAction]) mock.mockReset();
    state.signIn.mockResolvedValue({ error: null });
});

describe("show or hide the password", () => {
    it("starts hidden, with a named control that is not a submit button", () => {
        expect(input("password").props.type).toBe("password");
        expect(toggle().props).toMatchObject({ type: "button", "aria-pressed": false, "aria-controls": "password" });
        expect(toggleLabel()).toBe("Show password");
    });

    it("shows and hides what was typed without changing it or sending anything", () => {
        fill("password", "not-a-real-password");
        press();
        expect(input("password").props).toMatchObject({ type: "text", value: "not-a-real-password", autoComplete: "current-password" });
        expect(toggle().props["aria-pressed"]).toBe(true);
        expect(toggleLabel()).toBe("Hide password");
        press();
        expect(input("password").props).toMatchObject({ type: "password", value: "not-a-real-password" });
        expect(state.signIn).not.toHaveBeenCalled();
        expect(state.signupAction).not.toHaveBeenCalled();
    });

    it("covers the confirmation field too when creating an account", () => {
        choose("signup");
        expect(toggle().props["aria-controls"]).toBe("password confirm");
        expect(input("confirm").props.type).toBe("password");
        press();
        expect(input("password").props.type).toBe("text");
        expect(input("confirm").props.type).toBe("text");
        expect(input("password").props.autoComplete).toBe("new-password");
    });

    it("still signs in with exactly what was typed while the password is shown", async () => {
        fill("email", "contractor@example.invalid"); fill("password", "not-a-real-password");
        press();
        await submit();
        expect(state.signIn).toHaveBeenCalledExactlyOnceWith({ email: "contractor@example.invalid", password: "not-a-real-password" });
    });
});

describe("sign-in field hints", () => {
    it("asks phones for an email keyboard and leaves both fields uncorrected", () => {
        expect(input("email").props).toMatchObject({ type: "email", inputMode: "email", autoCapitalize: "none", autoCorrect: "off", spellCheck: false });
        expect(input("password").props).toMatchObject({ autoCapitalize: "none", autoCorrect: "off", spellCheck: false });
    });

    it("marks neither field before a sign-in has been refused", () => {
        for (const id of ["email", "password"]) {
            expect(input(id).props["aria-invalid"]).toBeUndefined();
            expect(input(id).props["aria-describedby"]).toBeUndefined();
        }
    });

    it("points both fields at the refusal, which does not say which detail was wrong", async () => {
        fill("email", "contractor@example.invalid"); fill("password", "not-a-real-password");
        state.signIn.mockResolvedValue({ error: { message: "Test sign-in refused" } });
        await submit();
        expect(nodes(render()).find(e => e.props.role === "alert")!.props.id).toBe("login-error");
        for (const id of ["email", "password"]) {
            expect(input(id).props).toMatchObject({ "aria-invalid": true, "aria-describedby": "login-error" });
        }
        // Leaving sign-in clears the message, and with it the marks.
        choose("signup");
        expect(input("email").props["aria-invalid"]).toBeUndefined();
        expect(input("password").props["aria-describedby"]).toBe("password-help");
    });
});