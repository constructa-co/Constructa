import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Where the actual LoginPage (with the A023-CALLBACK-NOTICE-2145 hunks) places
// the callback failure notice. Same hook harness as account-presentation.test.tsx;
// the notice's own after-hydration behaviour is covered in auth-callback-notice.test.tsx.
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

import AuthCallbackNotice from "@/components/auth-callback-notice";
import LoginPage from "./page";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function render() { state.cursor = 0; return LoginPage(); }
const notices = () => nodes(render()).filter(e => e.type === AuthCallbackNotice);
function choose(mode: "signup" | "signin") {
    const control = nodes(render()).find(e => e.type === "button" && e.props.children === (mode === "signup" ? "Get started" : "Sign in") && "aria-pressed" in e.props);
    (control!.props.onClick as () => void)();
}
function fill(id: string, value: string) {
    (nodes(render()).find(e => e.type === "input" && e.props.id === id)!.props.onChange as (event: { target: { value: string } }) => void)({ target: { value } });
}

beforeEach(() => {
    state.slots = []; state.cursor = 0;
    for (const mock of [state.signIn, state.signUp, state.browserSignUp, state.push, state.refresh]) mock.mockReset();
});

describe("callback failure notice placement", () => {
    it("sits once, ahead of the account controls, in both sign-in and sign-up", () => {
        for (const mode of ["signin", "signup"] as const) {
            if (mode === "signup") choose("signup");
            expect(notices(), mode).toHaveLength(1);
            const elements = nodes(render());
            const notice = elements.findIndex(e => e.type === AuthCallbackNotice);
            const toggle = elements.findIndex(e => e.props.role === "group" && e.props["aria-label"] === "Account mode");
            expect(notice).toBeGreaterThan(-1);
            expect(notice).toBeLessThan(toggle);
        }
    });

    it("adds nothing to the server render, so hydration is unchanged and no alert is shown", () => {
        const html = renderToStaticMarkup(render());
        expect(html).not.toContain("data-auth-callback-notice");
        expect(html).not.toContain('role="alert"');
        expect(html).toContain("Welcome back.");
    });

    it("is not shown beside a signup confirmation", async () => {
        state.signUp.mockResolvedValue({ ok: true, outcome: "confirmation-required" });
        choose("signup");
        fill("email", "contractor@example.invalid");
        fill("password", "not-a-real-password");
        fill("confirm", "not-a-real-password");
        (nodes(render()).find(e => e.type === "input" && e.props.id === "platform-terms")!.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: true } });
        await (nodes(render()).find(e => e.type === "form")!.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({ preventDefault: () => {} });
        expect(renderToStaticMarkup(render())).toContain("Check your inbox.");
        expect(notices()).toHaveLength(0);
        expect(state.push).not.toHaveBeenCalled();
        expect(state.signIn).not.toHaveBeenCalled();
    });
});
