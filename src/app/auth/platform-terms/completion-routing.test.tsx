import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLaunchLandingPath } from "@/lib/launch-profile";
import { PLATFORM_TERMS_CURRENT_REVISION } from "@/lib/platform-terms";
import { PLATFORM_TERMS_COMPLETION_MESSAGES, PLATFORM_TERMS_COMPLETION_PATH } from "@/lib/platform-terms-completion";

// Reachability of the completion page:
//   - the unchanged auth callback follows the server-owned `next` from the
//     confirmation email, keeps recovery and the ordinary landing, and never
//     records consent;
//   - the login page (with the A023-COMPLETION-1845 integration hunks) returns
//     a deliberate sign-in only to the exact completion page, and links the
//     consent-not-stored notice to it;
//   - the completion client treats a failed request as unconfirmed.
// Offline React output and Response objects only; no browser or provider.
const state = vi.hoisted(() => ({
    slots: [] as unknown[], cursor: 0,
    exchange: vi.fn(), verifyOtp: vi.fn(), serverFrom: vi.fn(),
    signIn: vi.fn(), browserSignUp: vi.fn(), signupAction: vi.fn(), push: vi.fn(), refresh: vi.fn(),
    complete: vi.fn(),
}));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = state.cursor++;
        if (!(index in state.slots)) state.slots[index] = initial;
        return [state.slots[index], (value: unknown) => { state.slots[index] = value; }];
    },
}));
vi.mock("@/lib/supabase/server", () => ({
    createClient: async () => ({ auth: { exchangeCodeForSession: state.exchange, verifyOtp: state.verifyOtp }, from: state.serverFrom }),
}));
vi.mock("@/lib/supabase/client", () => ({
    createClient: () => ({ auth: { signInWithPassword: state.signIn, signUp: state.browserSignUp } }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push, refresh: state.refresh }) }));
vi.mock("@/lib/platform-signup-action", () => ({ platformSignupAction: state.signupAction }));
// Stands in for the browser-to-server request only, to reach the client's thrown-request path.
vi.mock("@/lib/platform-terms-completion-action", () => ({ completePlatformTermsAcceptanceAction: state.complete }));

import { GET } from "../../auth/callback/route";
import LoginPage from "../../login/page";
import PlatformTermsCompletion from "./completion-client";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
let view: () => Element = () => LoginPage() as Element;
function render() { state.cursor = 0; return view(); }
const find = (test: (e: Element) => boolean) => nodes(render()).find(test);
function call(handler: unknown, event: unknown) { return (handler as (value: unknown) => unknown)(event); }
async function submit() {
    const preventDefault = vi.fn();
    await call(find(e => e.type === "form")!.props.onSubmit, { preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
}
const fill = (id: string, value: string) => call(find(e => e.type === "input" && e.props.id === id)!.props.onChange, { target: { value } });
const tick = (id: string) => call(find(e => e.type === "input" && e.props.id === id)!.props.onChange, { target: { checked: true } });
const ORIGIN = "https://constructa.example.invalid";
const callback = (query: string) => GET(new Request(`${ORIGIN}/auth/callback?${query}`));

beforeEach(() => {
    vi.resetAllMocks();
    state.slots = []; state.cursor = 0;
    view = () => LoginPage() as Element;
    state.exchange.mockResolvedValue({ error: null });
    state.verifyOtp.mockResolvedValue({ error: null });
    state.signIn.mockResolvedValue({ error: null });
});
afterEach(() => {
    expect(state.serverFrom).not.toHaveBeenCalled();
    expect(state.browserSignUp).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
});

describe("unchanged auth callback with the confirmation email's completion destination", () => {
    it.each([
        ["code=synthetic&next=%2Fauth%2Fplatform-terms", "/auth/platform-terms"],
        ["token_hash=synthetic&type=signup&next=%2Fauth%2Fplatform-terms", "/auth/platform-terms"],
        ["code=synthetic&type=recovery&next=%2Fauth%2Fplatform-terms", "/auth/reset-password"],
        ["token_hash=synthetic&type=recovery", "/auth/reset-password"],
        ["code=synthetic", "/dashboard"],
    ])("redirects %s to %s without recording consent", async (query, path) => {
        const response = await callback(query);
        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(`${ORIGIN}${path}`);
    });

    it("keeps a failed exchange on the existing sign-in error", async () => {
        state.exchange.mockResolvedValue({ error: { message: "synthetic" } });
        const response = await callback("code=synthetic&next=%2Fauth%2Fplatform-terms");
        expect(response.headers.get("location")).toBe(`${ORIGIN}/login?error=auth-code-error`);
    });
});

describe("deliberate sign-in returns only to the exact completion page", () => {
    it.each([
        ["?next=%2Fauth%2Fplatform-terms", PLATFORM_TERMS_COMPLETION_PATH],
        ["?next=https%3A%2F%2Fevil.example", getLaunchLandingPath()],
        ["?next=%2F%2Fevil.example", getLaunchLandingPath()],
        ["?next=%2Fdashboard%2Fsettings", getLaunchLandingPath()],
        ["", getLaunchLandingPath()],
    ])("search %j lands on %s, records nothing and creates no account", async (search, landing) => {
        vi.stubGlobal("location", { origin: ORIGIN, search });
        fill("email", "contractor@example.invalid");
        fill("password", "not-a-real-password");
        await submit();
        expect(state.signIn).toHaveBeenCalledExactlyOnceWith({ email: "contractor@example.invalid", password: "not-a-real-password" });
        expect(state.push).toHaveBeenCalledExactlyOnceWith(landing);
        expect(state.signupAction).not.toHaveBeenCalled();
    });

    it("keeps a refused sign-in on the page with no navigation", async () => {
        vi.stubGlobal("location", { origin: ORIGIN, search: "?next=%2Fauth%2Fplatform-terms" });
        state.signIn.mockResolvedValue({ error: { message: "Synthetic signin refused" } });
        await submit();
        expect(state.push).not.toHaveBeenCalled();
    });
});

describe("consent-not-stored notice", () => {
    async function signupResult(result: unknown) {
        state.signupAction.mockResolvedValue(result);
        call(find(e => e.type === "button" && "aria-pressed" in e.props && e.props.children === "Get started")!.props.onClick, undefined);
        fill("email", "contractor@example.invalid");
        fill("password", "not-a-real-password");
        fill("confirm", "not-a-real-password");
        tick("platform-terms");
        await submit();
        expect(state.signupAction).toHaveBeenCalledExactlyOnceWith({
            email: "contractor@example.invalid", password: "not-a-real-password",
            acceptance: true, revision: PLATFORM_TERMS_CURRENT_REVISION,
        });
        return find(e => e.props.href === PLATFORM_TERMS_COMPLETION_PATH);
    }

    it("links to the completion page without navigating or retrying", async () => {
        const link = await signupResult({ ok: false, code: "consent-not-stored" });
        expect(link!.props.children).toBe("Complete platform terms acceptance");
        expect(state.push).not.toHaveBeenCalled();
    });

    it.each([
        [{ ok: false, code: "signup-failed" }],
        [{ ok: false, code: "signup-disabled" }],
        [{ ok: true, outcome: "confirmation-required" }],
    ])("does not offer completion for %j", async result => {
        expect(await signupResult(result)).toBeUndefined();
        expect(state.push).not.toHaveBeenCalled();
    });
});

describe("completion client request failure", () => {
    it("reports an unconfirmed result, keeps the ticked box and does not retry", async () => {
        view = () => PlatformTermsCompletion({ revision: PLATFORM_TERMS_CURRENT_REVISION }) as Element;
        state.complete.mockRejectedValue(new Error("synthetic network detail"));
        tick("platform-terms-completion");
        await submit();
        expect(state.complete).toHaveBeenCalledExactlyOnceWith({ acceptance: true, revision: PLATFORM_TERMS_CURRENT_REVISION });
        const markup = renderToStaticMarkup(render());
        expect(markup).toContain(PLATFORM_TERMS_COMPLETION_MESSAGES.unconfirmed.replace(/'/g, "&#x27;"));
        expect(markup).not.toContain("synthetic network detail");
        expect(markup).not.toContain(PLATFORM_TERMS_COMPLETION_MESSAGES.recorded.replace(/'/g, "&#x27;"));
        expect(markup).not.toContain(PLATFORM_TERMS_COMPLETION_MESSAGES["already-recorded"].replace(/'/g, "&#x27;"));
        expect(find(e => e.props.href === getLaunchLandingPath())).toBeUndefined();
        expect(find(e => e.type === "input" && e.props.id === "platform-terms-completion")!.props).toMatchObject({ checked: true, disabled: false });
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(state.complete).toHaveBeenCalledTimes(1);
    });
});
