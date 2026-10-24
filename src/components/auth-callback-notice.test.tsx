import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The actual notice component under the existing useState slot shim, with
// effects recorded so the after-hydration read can be driven offline. The
// browser address is a stub; no DOM, router or network is used.
const state = vi.hoisted(() => ({
    slots: [] as unknown[], cursor: 0,
    effects: [] as Array<() => void | (() => void)>,
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

import AuthCallbackNotice, { AUTH_CALLBACK_NOTICE, isAuthCallbackFailure } from "./auth-callback-notice";

const listeners = new Map<string, () => void>();
const address = { search: "" };
function render() { state.cursor = 0; return AuthCallbackNotice() as ReactElement<Record<string, unknown>> | null; }
function hydrate() {
    render();
    const cleanups = state.effects.splice(0).map(effect => effect());
    return () => cleanups.forEach(cleanup => cleanup?.());
}

beforeEach(() => {
    state.slots = []; state.cursor = 0; state.effects = [];
    listeners.clear();
    address.search = "";
    vi.stubGlobal("window", {
        location: address,
        addEventListener: (name: string, listener: () => void) => { listeners.set(name, listener); },
        removeEventListener: (name: string, listener: () => void) => { if (listeners.get(name) === listener) listeners.delete(name); },
    });
});
afterEach(() => vi.unstubAllGlobals());

describe("recognising the auth callback's failure value", () => {
    it.each([
        ["?error=auth-code-error", true],
        ["error=auth-code-error", true],
        ["?next=%2Fdashboard&error=auth-code-error", true],
        ["", false],
        ["?error=", false],
        ["?error=other", false],
        ["?error=AUTH-CODE-ERROR", false],
        ["?error=auth-code-error%20extra", false],
        ["?error=auth-code-error&error=auth-code-error", false],
        ["?error=%3Cscript%3Ealert(1)%3C%2Fscript%3E", false],
        ["?message=auth-code-error", false],
    ])("%j is %s", (search, expected) => {
        expect(isAuthCallbackFailure(search)).toBe(expected);
    });

    it.each([undefined, null, 1, {}])("rejects non-text %j", value => {
        expect(isAuthCallbackFailure(value)).toBe(false);
    });
});

describe("the notice on the sign-in page", () => {
    it("renders nothing before hydration, so server and first browser render match", () => {
        address.search = "?error=auth-code-error";
        expect(render()).toBeNull();
        expect(renderToStaticMarkup(<AuthCallbackNotice />)).toBe("");
    });

    it("shows only the fixed words after hydration for the exact callback value", () => {
        address.search = "?error=auth-code-error";
        hydrate();
        const notice = render()!;
        expect(notice.props).toMatchObject({ role: "alert", "data-auth-callback-notice": true, children: AUTH_CALLBACK_NOTICE });
        expect(AUTH_CALLBACK_NOTICE).toBe("We couldn't confirm that sign-in link. Try signing in, or request a new link.");
    });

    it.each(["", "?error=other", "?error=%3Cb%3Eprovider%20detail%3C%2Fb%3E", "?error=auth-code-error&error=x"])(
        "shows nothing, and none of the address, for %j", search => {
            address.search = search;
            hydrate();
            expect(render()).toBeNull();
        });

    it("follows back and forward between addresses without keeping the notice anywhere", () => {
        address.search = "";
        const cleanup = hydrate();
        expect(render()).toBeNull();
        address.search = "?error=auth-code-error";
        listeners.get("popstate")!();
        expect(render()!.props.children).toBe(AUTH_CALLBACK_NOTICE);
        address.search = "?next=%2Fdashboard";
        listeners.get("popstate")!();
        expect(render()).toBeNull();
        cleanup();
        expect(listeners.has("popstate")).toBe(false);
    });
});
