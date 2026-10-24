import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLaunchLandingPath } from "@/lib/launch-profile";

const state = vi.hoisted(() => ({
    slots: [] as unknown[], cursor: 0,
    signIn: vi.fn(), signUp: vi.fn(), push: vi.fn(), refresh: vi.fn(),
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
    createClient: () => ({ auth: { signInWithPassword: state.signIn, signUp: state.signUp } }),
}));
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
    for (const mock of [state.signIn, state.signUp, state.push, state.refresh]) mock.mockReset();
    state.signIn.mockResolvedValue({ error: null });
    state.signUp.mockResolvedValue({ error: null });
    vi.stubGlobal("location", { origin: "https://constructa.example.invalid" });
});
afterEach(() => vi.unstubAllGlobals());

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

    it("keeps the exact signup payload and confirmation message after acceptance", async () => {
        signup(); accept(true); await submit();
        expect(state.signUp).toHaveBeenCalledExactlyOnceWith({
            email: "contractor@example.invalid", password: "not-a-real-password",
            options: { emailRedirectTo: "https://constructa.example.invalid/auth/callback" },
        });
        expect(html()).toContain("Account created. Check your email for the confirmation link — once confirmed, sign in to get started.");
        expect(html()).not.toContain("Please accept the platform terms");
        expect(state.signIn).not.toHaveBeenCalled();
        expect(state.push).not.toHaveBeenCalled();
        expect(state.refresh).not.toHaveBeenCalled();
    });

    it("preserves provider refusal and permits an explicit accepted retry", async () => {
        signup(); await submit(); accept(true);
        state.signUp.mockResolvedValueOnce({ error: { message: "Synthetic signup refused" } });
        await submit();
        expect(html()).toContain("Synthetic signup refused");
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
        let release!: (result: { error: null }) => void;
        state.signUp.mockReturnValue(new Promise(resolve => { release = resolve; }));
        const pending = submit();
        expect(input("platform-terms").props.disabled).toBe(true);
        expect(html()).toContain("Processing...");
        release({ error: null }); await pending;
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
});
