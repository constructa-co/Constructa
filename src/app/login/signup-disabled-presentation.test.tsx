import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
    slots: [] as unknown[], cursor: 0,
    signIn: vi.fn(), push: vi.fn(), refresh: vi.fn(),
}));

vi.mock("@/lib/platform-signup-policy", () => ({
    isPlatformSignupDisabled: () => true,
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
    platformSignupAction: vi.fn(),
    PLATFORM_TERMS_CURRENT_REVISION: "synthetic",
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

beforeEach(() => {
    state.slots = []; state.cursor = 0;
    state.signIn.mockReset();
    state.push.mockReset();
    state.refresh.mockReset();
});

describe("signup disabled in source", () => {
    it("does not offer Get started while the existing signup gate stays off", () => {
        const buttons = nodes(render()).filter(e => e.type === "button");
        expect(buttons.some(e => e.props.children === "Get started")).toBe(false);
        expect(html()).not.toContain("Don&#x27;t have an account?");
        expect(html()).not.toContain('aria-label="Getting started"');
        expect(html()).toContain("Welcome back.");
        expect(html()).not.toContain('aria-pressed="true"');
        expect(nodes(render()).find(e => e.type === "form")).toBeDefined();
    });
});