import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLaunchLandingPath } from "@/lib/launch-profile";
import { PLATFORM_TERMS_CURRENT_REVISION, PLATFORM_TERMS_DOCUMENT_ID } from "@/lib/platform-terms";
import { PLATFORM_TERMS_COMPLETION_MESSAGES, PLATFORM_TERMS_COMPLETION_SIGN_IN } from "@/lib/platform-terms-completion";

// The actual completion page, client, action and recorder run together. Only
// the default cookie-bound server factory and Next's redirect are replaced.
// React output is inspected offline; no browser, native validation or
// assistive technology runs here.
const state = vi.hoisted(() => ({
    slots: [] as unknown[], cursor: 0,
    createClient: vi.fn(), getUser: vi.fn(), from: vi.fn(), insert: vi.fn(),
    redirect: vi.fn((url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { url }); }),
}));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = state.cursor++;
        if (!(index in state.slots)) state.slots[index] = initial;
        return [state.slots[index], (value: unknown) => { state.slots[index] = value; }];
    },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: state.createClient }));
vi.mock("next/navigation", () => ({ redirect: state.redirect }));

import PlatformTermsCompletionPage from "./page";
import PlatformTermsCompletion from "./completion-client";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
let revision = PLATFORM_TERMS_CURRENT_REVISION;
function render() { state.cursor = 0; return PlatformTermsCompletion({ revision }); }
const html = () => renderToStaticMarkup(render());
const find = (test: (e: Element) => boolean) => nodes(render()).find(test);
const checkbox = () => find(e => e.type === "input" && e.props.id === "platform-terms-completion")!;
const continueLink = () => find(e => e.props.href === getLaunchLandingPath() && e.props.className !== undefined);
function tick(checked: boolean) {
    (checkbox().props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked } });
}
function submit() {
    const form = find(e => e.type === "form")!;
    const preventDefault = vi.fn();
    const done = (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    return done;
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
// Static markup escapes apostrophes.
const shown = (text: string) => text.replace(/'/g, "&#x27;");

beforeEach(() => {
    vi.resetAllMocks();
    state.slots = []; state.cursor = 0; revision = PLATFORM_TERMS_CURRENT_REVISION;
    state.redirect.mockImplementation((url: string) => { throw Object.assign(new Error("NEXT_REDIRECT"), { url }); });
    state.createClient.mockResolvedValue({ auth: { getUser: state.getUser }, from: state.from });
    state.from.mockReturnValue({ insert: state.insert });
    state.getUser.mockResolvedValue({ data: { user: { id: "server-user" } }, error: null });
    state.insert.mockResolvedValue({ error: null });
});
afterEach(() => vi.restoreAllMocks());

describe("completion page access", () => {
    it.each([
        ["no session", () => state.getUser.mockResolvedValue({ data: { user: null }, error: null })],
        ["a session error", () => state.getUser.mockResolvedValue({ data: { user: { id: "server-user" } }, error: { message: "synthetic" } })],
        ["a thrown server client", () => state.createClient.mockRejectedValue(new Error("synthetic"))],
    ])("sends %s to sign-in with only the completion return, recording nothing", async (_label, arrange) => {
        arrange();
        await expect(PlatformTermsCompletionPage()).rejects.toMatchObject({ url: PLATFORM_TERMS_COMPLETION_SIGN_IN });
        expect(state.redirect).toHaveBeenCalledExactlyOnceWith("/login?next=%2Fauth%2Fplatform-terms");
        expect(state.from).not.toHaveBeenCalled();
    });

    it("shows a signed-in user the explicit form for the trusted current revision without recording on render", async () => {
        const page = await PlatformTermsCompletionPage() as Element;
        expect(page.type).toBe(PlatformTermsCompletion);
        expect(page.props).toEqual({ revision: PLATFORM_TERMS_CURRENT_REVISION });
        expect(state.redirect).not.toHaveBeenCalled();
        expect(state.from).not.toHaveBeenCalled();
        expect(state.insert).not.toHaveBeenCalled();
    });
});

describe("explicit acceptance on the completion page", () => {
    it("starts with a required unchecked box, a separate full-terms link and no recorded claim", () => {
        expect(checkbox().props).toMatchObject({ type: "checkbox", required: true, checked: false, disabled: false, "aria-describedby": "platform-terms-completion-link" });
        const elements = nodes(render());
        const label = elements.find(e => e.type === "label" && e.props.htmlFor === "platform-terms-completion")!;
        const link = elements.find(e => e.props.id === "platform-terms-completion-link")!;
        expect(link.props).toMatchObject({ href: "/terms-of-service", target: "_blank", rel: "noopener noreferrer", children: "Read the full platform terms (opens in a new tab)" });
        expect(nodes(label).some(e => e.props.href === "/terms-of-service")).toBe(false);
        expect(continueLink()).toBeUndefined();
        const markup = html();
        expect(markup).not.toContain('role="status"');
        expect(markup).not.toContain(shown(PLATFORM_TERMS_COMPLETION_MESSAGES.recorded));
        expect(markup).not.toContain(shown(PLATFORM_TERMS_COMPLETION_MESSAGES["already-recorded"]));
        expect(markup).not.toMatch(/id="platform-terms-completion"[^>]*checked/);
        expect(state.createClient).not.toHaveBeenCalled();
    });

    it("refuses an unchecked submit without consulting the server", async () => {
        await submit();
        expect(html()).toContain(shown(PLATFORM_TERMS_COMPLETION_MESSAGES.refused));
        expect(checkbox().props).toMatchObject({ "aria-invalid": true, "aria-describedby": "platform-terms-completion-error platform-terms-completion-link" });
        expect(state.createClient).not.toHaveBeenCalled();
        expect(continueLink()).toBeUndefined();
    });

    it("records once through the actual recorder and offers Continue only after its acknowledgement", async () => {
        let release!: (value: { error: null }) => void;
        state.insert.mockReturnValue(new Promise(resolve => { release = resolve; }));
        tick(true);
        const first = submit();
        await vi.waitFor(() => expect(state.insert).toHaveBeenCalledTimes(1));
        // Pending: no claim, no onward link, no second write.
        expect(checkbox().props.disabled).toBe(true);
        expect(html()).toContain("Recording...");
        expect(html()).not.toContain(shown(PLATFORM_TERMS_COMPLETION_MESSAGES.recorded));
        expect(html()).not.toContain(shown(PLATFORM_TERMS_COMPLETION_MESSAGES["already-recorded"]));
        expect(continueLink()).toBeUndefined();
        await submit();
        expect(state.insert).toHaveBeenCalledTimes(1);

        release({ error: null });
        await first;
        expect(state.insert).toHaveBeenCalledExactlyOnceWith({
            user_id: "server-user", terms_document: PLATFORM_TERMS_DOCUMENT_ID, accepted_revision: PLATFORM_TERMS_CURRENT_REVISION,
        });
        const markup = html();
        expect(markup).toContain(shown(PLATFORM_TERMS_COMPLETION_MESSAGES.recorded));
        expect(markup).toContain('role="status"');
        expect(continueLink()!.props.href).toBe(getLaunchLandingPath());
    });

    it("acknowledges an existing record as already recorded", async () => {
        state.insert.mockResolvedValue({ error: { code: "23505" } });
        tick(true);
        await submit();
        expect(html()).toContain(shown(PLATFORM_TERMS_COMPLETION_MESSAGES["already-recorded"]));
        expect(continueLink()).toBeDefined();
    });

    it.each([
        ["not-stored", () => state.insert.mockResolvedValue({ error: { code: "42P01", message: "synthetic relation detail" } })],
        ["not-stored", () => state.insert.mockRejectedValue(new Error("synthetic relation detail"))],
        ["unauthenticated", () => state.getUser.mockResolvedValue({ data: { user: null }, error: null })],
        ["unrecognized-revision", () => { revision = "platform-tos-2099-01"; }],
    ] as const)("shows fixed %s feedback, keeps the box ticked and never retries by itself", async (code, arrange) => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        arrange();
        tick(true);
        await submit();
        const writes = state.insert.mock.calls.length;
        expect(writes).toBeLessThanOrEqual(1);
        const markup = html();
        expect(markup).toContain(shown(PLATFORM_TERMS_COMPLETION_MESSAGES[code]));
        expect(markup).not.toContain("synthetic relation detail");
        expect(markup).not.toContain(shown(PLATFORM_TERMS_COMPLETION_MESSAGES.recorded));
        expect(markup).not.toContain(shown(PLATFORM_TERMS_COMPLETION_MESSAGES["already-recorded"]));
        expect(markup).not.toContain('role="status"');
        expect(continueLink()).toBeUndefined();
        expect(checkbox().props).toMatchObject({ checked: true, disabled: false });
        expect(checkbox().props["aria-invalid"]).toBeUndefined();
        if (code === "unauthenticated") expect(find(e => e.props.href === PLATFORM_TERMS_COMPLETION_SIGN_IN)).toBeDefined();
        await settle();
        expect(state.insert.mock.calls.length).toBe(writes);
    });
});
