import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FORGOT_PASSWORD_PATH } from "@/lib/auth-recovery-link-failure";

const state = vi.hoisted(() => ({
    slots: [] as unknown[],
    cursor: 0,
    effects: [] as Array<() => void | (() => void)>,
    createClient: vi.fn(),
    setSession: vi.fn(),
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
    createClient: state.createClient,
}));
vi.mock("@/lib/launch-profile", () => ({
    getLaunchLandingPath: () => "/fake-landing",
}));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: state.replace }),
}));

import AuthConfirmPage from "./page";

const FIXED_MESSAGE = "We could not verify this link. Please request a new link or sign in.";

function render() { state.cursor = 0; return AuthConfirmPage(); }
function hydrate() {
    render();
    state.effects.splice(0).forEach(effect => effect());
}
const html = () => renderToStaticMarkup(render());
const settle = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
};

const address = { hash: "" };

beforeEach(() => {
    state.slots = [];
    state.cursor = 0;
    state.effects = [];
    state.setSession.mockReset();
    state.replace.mockReset();
    state.createClient.mockReset();
    state.createClient.mockImplementation(() => ({
        auth: { setSession: state.setSession },
    }));
    state.setSession.mockResolvedValue({ error: null });
    address.hash = "#access_token=fake-access&refresh_token=fake-refresh";
    vi.stubGlobal("window", { location: address });
});
afterEach(() => vi.unstubAllGlobals());

describe("auth confirm page", () => {
    it("fails closed with a fixed safe message when setSession rejects", async () => {
        state.setSession.mockRejectedValue(new Error("fake-raw-server-detail fake-access"));
        hydrate();
        await settle();

        const markup = html();
        expect(markup).toContain(FIXED_MESSAGE);
        expect(markup).toContain(`href="${FORGOT_PASSWORD_PATH}"`);
        expect(markup).toContain('href="/login"');
        expect(markup).not.toContain("Verifying...");
        expect(markup).not.toContain("fake-raw-server-detail");
        expect(markup).not.toContain("fake-access");
        expect(markup).not.toContain("fake-refresh");
        expect(state.setSession).toHaveBeenCalledTimes(1);
        expect(state.replace).not.toHaveBeenCalled();
    });

    it("fails closed with the same safe message when client initialization throws", async () => {
        state.createClient.mockImplementation(() => {
            throw new Error("fake-init-detail");
        });
        hydrate();
        await settle();

        const markup = html();
        expect(markup).toContain(FIXED_MESSAGE);
        expect(markup).not.toContain("fake-init-detail");
        expect(markup).not.toContain("Verifying...");
        expect(state.setSession).not.toHaveBeenCalled();
        expect(state.replace).not.toHaveBeenCalled();
    });

    it("routes a successful recovery session to the reset-password page", async () => {
        address.hash = "#access_token=fake-access&refresh_token=fake-refresh&type=recovery";
        hydrate();
        await settle();

        expect(state.setSession).toHaveBeenCalledWith({
            access_token: "fake-access",
            refresh_token: "fake-refresh",
        });
        expect(state.replace).toHaveBeenCalledWith("/auth/reset-password");
        expect(html()).toContain("Verifying...");
    });

    it("routes a successful non-recovery session to the launch landing path", async () => {
        hydrate();
        await settle();

        expect(state.replace).toHaveBeenCalledWith("/fake-landing");
    });

    it("keeps the existing returned-error and missing-token messages", async () => {
        state.setSession.mockResolvedValue({ error: { message: "Fake returned error" } });
        hydrate();
        await settle();
        expect(html()).toContain("Fake returned error");
        expect(state.replace).not.toHaveBeenCalled();

        state.slots = [];
        state.setSession.mockReset();
        address.hash = "";
        hydrate();
        await settle();
        expect(html()).toContain("Missing authentication tokens. Please request a new password reset link.");
        expect(state.setSession).not.toHaveBeenCalled();
    });
});
