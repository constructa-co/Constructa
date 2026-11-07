import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Programmatic relationships in the actual login component's React output.
// This does not execute a browser, native validation or assistive technology.
const state = vi.hoisted(() => ({
    slots: [] as unknown[], cursor: 0,
    signIn: vi.fn(), browserSignUp: vi.fn(), action: vi.fn(), push: vi.fn(), refresh: vi.fn(),
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
// Whichever signup path the page uses, these cases must never reach it.
vi.mock("@/lib/platform-signup-action", () => ({ platformSignupAction: state.action }));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: state.push, refresh: state.refresh }),
}));
import LoginPage from "./page";

const REFUSAL = "Please accept the platform terms of service before creating an account.";

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
    const control = nodes(render()).find(e => e.type === "button" && "aria-pressed" in e.props
        && e.props.children === (mode === "signup" ? "Get started" : "Sign in"));
    (control!.props.onClick as () => void)();
}
function input(id: string) {
    return nodes(render()).find(e => e.type === "input" && e.props.id === id);
}
function fill(id: string, value: string) {
    (input(id)!.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
}
function accept(checked: boolean) {
    (input("platform-terms")!.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked } });
}
function signup(password = "not-a-real-password", confirm = password) {
    choose("signup");
    fill("email", "contractor@example.invalid");
    fill("password", password);
    fill("confirm", confirm);
}
async function submit() {
    const form = nodes(render()).find(e => e.type === "form")!;
    const preventDefault = vi.fn();
    await (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
}
function alertBox() {
    return nodes(render()).find(e => e.props.role === "alert");
}
function relationships() {
    const props = input("platform-terms")!.props;
    return { describedBy: props["aria-describedby"], invalid: props["aria-invalid"], required: props.required, checked: props.checked };
}
const count = (markup: string, text: string) => markup.split(text).length - 1;

beforeEach(() => {
    state.slots = []; state.cursor = 0;
    for (const mock of [state.signIn, state.browserSignUp, state.action, state.push, state.refresh]) mock.mockReset();
});
afterEach(() => {
    expect(state.browserSignUp).not.toHaveBeenCalled();
    expect(state.action).not.toHaveBeenCalled();
    expect(state.signIn).not.toHaveBeenCalled();
    expect(state.push).not.toHaveBeenCalled();
    expect(state.refresh).not.toHaveBeenCalled();
});

describe("platform terms checkbox relationships in the actual login component", () => {
    it("is described by the separate full-terms link and is never invalid while unchecked or accepted without an error", () => {
        signup();
        expect(relationships()).toEqual({ describedBy: "platform-terms-link", invalid: undefined, required: true, checked: false });
        const elements = nodes(render());
        const link = elements.find(e => e.props.id === "platform-terms-link")!;
        expect(link.props).toMatchObject({ href: "/terms-of-service", target: "_blank", rel: "noopener noreferrer", children: "Read the full platform terms (opens in a new tab)" });
        const label = elements.find(e => e.type === "label" && e.props.htmlFor === "platform-terms")!;
        expect(nodes(label).some(e => e.props.id === "platform-terms-link")).toBe(false);
        expect(alertBox()).toBeUndefined();

        accept(true);
        expect(relationships()).toEqual({ describedBy: "platform-terms-link", invalid: undefined, required: true, checked: true });
        const markup = html();
        expect(count(markup, 'id="platform-terms-link"')).toBe(1);
        expect(markup).not.toContain("aria-invalid");
        expect(markup).not.toContain('role="alert"');
    });

    it("links the visible acceptance refusal to the unchecked checkbox, and drops it once accepted", async () => {
        signup();
        await submit();
        expect(alertBox()!.props).toMatchObject({ id: "login-error", children: REFUSAL });
        expect(relationships()).toEqual({ describedBy: "login-error platform-terms-link", invalid: true, required: true, checked: false });
        const refused = html();
        expect(count(refused, 'id="login-error"')).toBe(1);
        expect(count(refused, 'id="platform-terms-link"')).toBe(1);
        expect(refused).toMatch(/<input[^>]*id="platform-terms"[^>]*aria-describedby="login-error platform-terms-link"[^>]*aria-invalid="true"/);
        expect(input("platform-terms")!.props.disabled).toBe(false);

        accept(true);
        // The earlier refusal text stays until the next submit, but no longer describes an accepted box.
        expect(alertBox()!.props.children).toBe(REFUSAL);
        expect(relationships()).toEqual({ describedBy: "platform-terms-link", invalid: undefined, required: true, checked: true });
        expect(html()).not.toContain("aria-invalid");
    });

    it.each([
        ["a short password, unchecked", "short", "short", false, "Password must be at least 8 characters."],
        ["mismatched passwords, unchecked", "not-a-real-password", "different-password", false, "Passwords don't match."],
        ["a short password, accepted", "short", "short", true, "Password must be at least 8 characters."],
        ["mismatched passwords, accepted", "not-a-real-password", "different-password", true, "Passwords don't match."],
    ])("does not mark or describe the checkbox with an unrelated error: %s", async (_label, password, confirm, accepted, message) => {
        signup(password, confirm);
        if (accepted) accept(true);
        await submit();
        expect(alertBox()!.props).toMatchObject({ id: "login-error", children: message });
        expect(relationships()).toEqual({ describedBy: "platform-terms-link", invalid: undefined, required: true, checked: accepted });
        expect(html()).not.toContain("aria-invalid");
    });

    it("clears the refusal relationship with the existing mode reset", async () => {
        signup();
        await submit();
        expect(relationships().invalid).toBe(true);
        choose("signin");
        expect(input("platform-terms")).toBeUndefined();
        expect(alertBox()).toBeUndefined();
        choose("signup");
        expect(relationships()).toEqual({ describedBy: "platform-terms-link", invalid: undefined, required: true, checked: false });
        expect(alertBox()).toBeUndefined();
    });
});

