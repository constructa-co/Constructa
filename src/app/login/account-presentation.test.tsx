import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLaunchLandingPath } from "@/lib/launch-profile";

const state = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, signIn: vi.fn(), signUp: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = state.cursor++;
        if (!(index in state.slots)) state.slots[index] = initial;
        return [state.slots[index], (value: unknown) => { state.slots[index] = value; }];
    },
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signInWithPassword: state.signIn, signUp: state.signUp } }) }));
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

beforeEach(() => {
    state.slots = []; state.cursor = 0;
    for (const mock of [state.signIn, state.signUp, state.push, state.refresh]) mock.mockReset();
    state.signIn.mockResolvedValue({ error: null }); state.signUp.mockResolvedValue({ error: null });
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
