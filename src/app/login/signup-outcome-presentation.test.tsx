import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AccountConfirmation from "@/components/account-confirmation";

// The actual LoginPage (with the A023-CONFIRMATION-OUTCOME-1948 hunks) shows
// the typed signup outcome honestly: only confirmation-required asks for email
// confirmation. Same hook harness as account-presentation.test.tsx; the signup
// action is the mocked server boundary. Offline React output only.
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

const CONFIRMATION_MESSAGE = "Account created. Check your email for the confirmation link — once confirmed, sign in to get started.";
const RECORDED_MESSAGE = "Account created and your acceptance of the platform terms is recorded. Sign in to get started.";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function render() { state.cursor = 0; return LoginPage(); }
const html = () => renderToStaticMarkup(render());
const text = (markup: string) => markup.replace(/&#x27;/g, "'");
function choose(mode: "signup" | "signin") {
    const control = nodes(render()).find(e => e.type === "button" && e.props.children === (mode === "signup" ? "Get started" : "Sign in") && "aria-pressed" in e.props);
    (control!.props.onClick as () => void)();
}
function fill(id: string, value: string) {
    const input = nodes(render()).find(e => e.type === "input" && e.props.id === id);
    (input!.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
}
function acceptTerms() {
    const input = nodes(render()).find(e => e.type === "input" && e.props.id === "platform-terms")!;
    (input.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: true } });
}
async function submit() {
    const form = nodes(render()).find(e => e.type === "form")!;
    const preventDefault = vi.fn();
    await (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
}
async function signup(result: unknown) {
    state.signUp.mockResolvedValueOnce(result);
    choose("signup");
    fill("email", "contractor@example.invalid");
    fill("password", "not-a-real-password");
    fill("confirm", "not-a-real-password");
    acceptTerms();
    await submit();
}
const confirmation = () => nodes(render()).find(e => e.type === AccountConfirmation);
const heading = () => nodes(render()).find(e => e.type === "h1")!.props.children;

beforeEach(() => {
    state.slots = []; state.cursor = 0;
    for (const mock of [state.signIn, state.signUp, state.browserSignUp, state.push, state.refresh]) mock.mockReset();
});
afterEach(() => {
    // Presenting an outcome never navigates, signs in or calls the browser signup.
    expect(state.push).not.toHaveBeenCalled();
    expect(state.refresh).not.toHaveBeenCalled();
    expect(state.signIn).not.toHaveBeenCalled();
    expect(state.browserSignUp).not.toHaveBeenCalled();
});

describe("signup success follows the typed server outcome", () => {
    it("asks for email confirmation only when the server says confirmation is required", async () => {
        await signup({ ok: true, outcome: "confirmation-required" });
        const markup = text(html());
        expect(heading()).toBe("Check your inbox.");
        expect(markup).toContain("Confirm your email, then sign in to get started.");
        expect(markup).toContain(CONFIRMATION_MESSAGE);
        expect(markup).toContain("Already confirmed? Sign in with the email and password you used here.");
        expect(confirmation()!.props.footnote).toBeUndefined();
        expect(state.signUp).toHaveBeenCalledTimes(1);
    });

    it("shows a created and recorded account without any email-confirmation step", async () => {
        await signup({ ok: true, outcome: "created-and-recorded", userId: "synthetic-user" });
        const markup = text(html());
        expect(heading()).toBe("Account created.");
        expect(markup).toContain("Sign in with your email and password to get started.");
        expect(markup).toContain(RECORDED_MESSAGE);
        expect(markup).toContain("Sign in with the email and password you used here.");
        for (const claim of ["Check your inbox", "Confirm your email", "confirmation link", "Already confirmed"]) expect(markup).not.toContain(claim);
        expect(markup).not.toContain('role="alert"');
        expect(state.signUp).toHaveBeenCalledTimes(1);
    });

    it("clears the recorded presentation on the way back to sign in, keeping the entered email and password", async () => {
        await signup({ ok: true, outcome: "created-and-recorded", userId: "synthetic-user" });
        (confirmation()!.props.onSignIn as () => void)();
        expect(confirmation()).toBeUndefined();
        expect(text(html())).not.toContain("Account created");
        expect(heading()).not.toBe("Account created.");
        const inputs = nodes(render()).filter(e => e.type === "input");
        expect(inputs.find(e => e.props.id === "email")!.props.value).toBe("contractor@example.invalid");
        expect(inputs.find(e => e.props.id === "password")!.props.value).toBe("not-a-real-password");
        expect(inputs.some(e => e.props.id === "platform-terms")).toBe(false);

        // A later confirmation-required result is shown as such, not as the earlier recorded one.
        await signup({ ok: true, outcome: "confirmation-required" });
        expect(heading()).toBe("Check your inbox.");
        expect(text(html())).toContain("Already confirmed?");
        expect(state.signUp).toHaveBeenCalledTimes(2);
    });

    it.each([
        ["a typed refusal", () => state.signUp.mockResolvedValueOnce({ ok: false, code: "signup-failed" }), "We couldn't create your account. Please try again."],
        ["a transport failure", () => state.signUp.mockRejectedValueOnce(new Error("synthetic transport")), "We couldn't confirm whether your account was created. Please try signing in before creating another account."],
    ])("after a recorded success, %s on a new attempt shows no success heading", async (_label, arrange, message) => {
        await signup({ ok: true, outcome: "created-and-recorded", userId: "synthetic-user" });
        (confirmation()!.props.onSignIn as () => void)();
        arrange();
        choose("signup");
        fill("confirm", "not-a-real-password");
        acceptTerms();
        await submit();
        const markup = text(html());
        expect(markup).toContain(message);
        expect(confirmation()).toBeUndefined();
        expect(heading()).not.toBe("Account created.");
        expect(heading()).not.toBe("Check your inbox.");
        expect(markup).not.toContain("transport");
        expect(state.signUp).toHaveBeenCalledTimes(2);
    });
});
