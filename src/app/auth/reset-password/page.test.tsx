import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    FORGOT_PASSWORD_PATH,
    RECOVERY_LINK_EXPIRED_MESSAGE,
} from "@/lib/auth-recovery-link-failure";

const state = vi.hoisted(() => ({
    slots: [] as unknown[],
    cursor: 0,
    effects: [] as Array<() => void | (() => void)>,
    setSession: vi.fn(),
    getSession: vi.fn(),
    replace: vi.fn(),
}));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = state.cursor++;
        if (!(index in state.slots)) state.slots[index] = initial;
        return [state.slots[index], (value: unknown) => { state.slots[index] = value; }];
    },
    useEffect: (effect: () => void | (() => void)) => { state.effects.push(effect); },
}));
vi.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        auth: {
            setSession: state.setSession,
            getSession: state.getSession,
        },
    }),
}));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: state.replace }),
}));

import ResetPasswordPage from "./page";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function render() { state.cursor = 0; return ResetPasswordPage(); }
function hydrate() {
    render();
    state.effects.splice(0).forEach(effect => effect());
}
const html = () => renderToStaticMarkup(render());

const address = { search: "", hash: "" };
const history = { replaceState: vi.fn() };

beforeEach(() => {
    state.slots = [];
    state.cursor = 0;
    state.effects = [];
    state.setSession.mockReset();
    state.getSession.mockReset();
    state.replace.mockReset();
    history.replaceState.mockReset();
    address.search = "";
    address.hash = "";
    state.setSession.mockResolvedValue({ error: null });
    state.getSession.mockResolvedValue({ data: { session: null } });
    vi.stubGlobal("window", {
        location: address,
        history,
    });
});
afterEach(() => vi.unstubAllGlobals());

describe("reset password page", () => {
    it("renders the password form after a valid recovery hash establishes a session", async () => {
        address.hash = "#access_token=synthetic&refresh_token=synthetic&type=recovery";
        hydrate();
        await Promise.resolve();
        await Promise.resolve();

        const markup = html();
        expect(markup).toContain('id="password"');
        expect(markup).toContain('id="confirmPassword"');
        expect(markup).toContain("Update password");
        expect(state.setSession).toHaveBeenCalledWith({
            access_token: "synthetic",
            refresh_token: "synthetic",
        });
        expect(history.replaceState).toHaveBeenCalledWith(null, "", "/auth/reset-password");
    });

    it("shows an expired-link message with a forgot-password link for query failures", async () => {
        address.search = "?error=access_denied&error_code=otp_expired";
        hydrate();
        await Promise.resolve();

        const markup = html();
        expect(markup).toContain(RECOVERY_LINK_EXPIRED_MESSAGE);
        expect(markup).toContain(`href="${FORGOT_PASSWORD_PATH}"`);
        expect(markup).toContain("Request a new reset link");
        expect(markup).not.toContain('id="password"');
        expect(state.setSession).not.toHaveBeenCalled();
        expect(state.getSession).not.toHaveBeenCalled();
        expect(history.replaceState).toHaveBeenCalledWith(null, "", "/auth/reset-password");
    });

    it("refuses the password form for hash failures even when a session already exists", async () => {
        address.hash = "#error=access_denied&error_code=otp_expired";
        state.getSession.mockResolvedValue({
            data: { session: { user: { id: "existing-user" } } },
        });
        hydrate();
        await Promise.resolve();
        await Promise.resolve();

        const markup = html();
        expect(markup).toContain(RECOVERY_LINK_EXPIRED_MESSAGE);
        expect(markup).toContain(`href="${FORGOT_PASSWORD_PATH}"`);
        expect(markup).not.toContain('id="password"');
        expect(markup).not.toContain("Update password");
        expect(state.setSession).not.toHaveBeenCalled();
        expect(state.getSession).not.toHaveBeenCalled();
        expect(history.replaceState).toHaveBeenCalledWith(null, "", "/auth/reset-password");
    });

    it("shows the expired message when setSession rejects the recovery tokens", async () => {
        address.hash = "#access_token=bad&refresh_token=bad";
        state.setSession.mockResolvedValue({ error: { message: "provider detail" } });
        hydrate();
        await Promise.resolve();
        await Promise.resolve();

        const markup = html();
        expect(markup).toContain(RECOVERY_LINK_EXPIRED_MESSAGE);
        expect(markup).toContain(`href="${FORGOT_PASSWORD_PATH}"`);
        expect(markup).not.toContain("provider detail");
    });
});
