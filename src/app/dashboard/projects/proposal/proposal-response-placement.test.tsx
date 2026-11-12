import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// Static rendering uses React's own hooks. In replay mode the component is
// called as a function with slot-backed hooks over a real review store, so the
// existing radio handler can be called and the result rendered again.
const harness = vi.hoisted(() => ({ replay: false, slots: [] as unknown[], cursor: 0, store: null as unknown as { getState: () => unknown; dispatch: (action: unknown) => void } }));
vi.mock("react", async original => {
    const react = await original<typeof import("react")>();
    return {
        ...react,
        useState: (initial: unknown) => {
            if (!harness.replay) return react.useState(initial);
            const i = harness.cursor++;
            if (!(i in harness.slots)) harness.slots[i] = typeof initial === "function" ? (initial as () => unknown)() : initial;
            return [harness.slots[i], (next: unknown) => { harness.slots[i] = typeof next === "function" ? (next as (v: unknown) => unknown)(harness.slots[i]) : next; }];
        },
        useRef: (initial: unknown) => {
            if (!harness.replay) return react.useRef(initial);
            const i = harness.cursor++;
            if (!(i in harness.slots)) harness.slots[i] = { current: initial };
            return harness.slots[i];
        },
        useMemo: (fn: () => unknown, deps: unknown[]) => harness.replay ? fn() : react.useMemo(fn, deps),
        useEffect: (fn: () => void, deps?: unknown[]) => harness.replay ? undefined : react.useEffect(fn, deps),
    };
});
vi.mock("@/lib/use-reducer-store", async original => {
    const actual = await original<typeof import("@/lib/use-reducer-store")>();
    return { useReducerStore: (reducer: never, initial: never) => harness.replay ? [harness.store.getState(), harness.store] : actual.useReducerStore(reducer, initial) };
});
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: () => undefined }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "light" }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("./actions", () => ({
    getProposalPublicationAction: vi.fn(),
    publishProposalAction: vi.fn(),
    retryProposalDeliveryAction: vi.fn(),
    saveProposalDraftAction: vi.fn(),
    suggestProposalWordingAction: vi.fn(),
    uploadPhotoAction: vi.fn(),
}));

import { representativeInput } from "@/lib/__fixtures__/proposal";
import { responseWording } from "@/lib/proposal-response";
import { draftFromProject, initialReviewState, reviewReducer, savedDraftFromProject, type ReviewContext, type ReviewState } from "@/lib/proposal-review";
import ReviewSendClient, { type ReviewServer } from "./review-send-client";

const input = representativeInput();
const LOCK = "This proposal has been accepted. Record later scope or price changes as variations.";
const LEGEND = "What do you want your client to do?";
const NOTICE = "Neither option is acceptance. A proposal sent here cannot be accepted as a binding contract online.";

function context(): ReviewContext {
    return { project: { ...input.project, validity_days: 30, client_email: "alex@example.test" }, profile: input.profile, estimate: input.estimate, nextVersion: 1 };
}
function server() {
    return { save: vi.fn(), ask: vi.fn(), publish: vi.fn(), retry: vi.fn(), upload: vi.fn(), loadPublication: vi.fn() };
}
const props = (lockReason: string | null, api = server(), ctx = context()) => ({
    context: ctx, caseStudies: [], lockReason, estimateIssue: null, publications: [], server: api as unknown as ReviewServer, now: "2026-10-05T09:00:00.000Z",
});
function markup(lockReason: string | null = null, api = server()) {
    harness.replay = false;
    return renderToStaticMarkup(createElement(ReviewSendClient, props(lockReason, api)))
        .replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/<!-- -->/g, "");
}
/** The part of the page from one marker up to the next section marker. */
function section(html: string, marker: string) {
    const start = html.indexOf(marker);
    expect(start, marker).toBeGreaterThan(-1);
    const next = ["data-review-response", "data-review-preview", "data-review-send"]
        .map((m) => html.indexOf(m, start + marker.length)).filter((i) => i > -1);
    return html.slice(start, next.length ? Math.min(...next) : undefined);
}

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const e = value as Element; return [e, ...nodes(e.props.children)];
}
function replay(api = server()) {
    const ctx = context();
    const positional = () => { let n = 0; return () => `saved-${n++}`; };
    let state: ReviewState = initialReviewState(draftFromProject(ctx.project, positional()), savedDraftFromProject(ctx.project, positional()));
    harness.store = { getState: () => state, dispatch: (action) => { state = reviewReducer(state, action as never); } };
    harness.replay = true; harness.slots = [];
    const render = () => { harness.cursor = 0; return nodes(ReviewSendClient(props(null, api, ctx))); };
    return { render, state: () => state, api };
}
afterEach(() => { harness.replay = false; });

describe("client response choice sits in preparation, before the preview", () => {
    it("renders as its own section after the draft form and before Preview and Send", () => {
        const html = markup();
        const form = html.indexOf("</form>");
        const response = html.indexOf("data-review-response");
        expect(form).toBeGreaterThan(-1);
        expect(form).toBeLessThan(response);
        expect(response).toBeLessThan(html.indexOf("data-review-preview"));
        expect(html.indexOf("data-review-preview")).toBeLessThan(html.indexOf("data-review-send"));
        // Outside the draft form, so the form's own disabled fieldset never wraps it.
        expect(html.slice(html.indexOf("<form"), form)).not.toContain('name="response-kind"');
    });

    it("keeps exactly one choice with the existing legend, options, help, default and notice", () => {
        const html = markup();
        expect(html.match(/<legend[^>]*>What do you want your client to do\?<\/legend>/g)).toHaveLength(1);
        expect(html.match(/data-response-option="[^"]+"/g)).toEqual(['data-response-option="acknowledgement"', 'data-response-option="non_binding_intent"']);
        const radios = html.match(/<input[^>]*type="radio"[^>]*name="response-kind"[^>]*>/g) ?? [];
        expect(radios).toHaveLength(2);
        expect(radios[0]).toContain('checked=""'); expect(radios[1]).not.toContain("checked");
        for (const kind of ["acknowledgement", "non_binding_intent"] as const) {
            expect(html.match(new RegExp(responseWording(kind).optionLabel, "g"))).toHaveLength(1);
            expect(html).toContain(responseWording(kind).optionHelp);
        }
        expect(html.match(new RegExp(NOTICE.replace(/\./g, "\\."), "g"))).toHaveLength(1);
    });

    it("puts the whole choice in the new section and none of it under Send", () => {
        const html = markup();
        const response = section(html, "data-review-response");
        const send = section(html, "data-review-send");
        for (const part of [LEGEND, 'name="response-kind"', "data-response-option", NOTICE]) {
            expect(response, part).toContain(part);
            expect(send, part).not.toContain(part);
        }
        expect(response).toMatch(/^data-review-response="true">\s*<fieldset class="space-y-2">/);
        expect(html).toMatch(/<section class="[^"]*p-4 sm:p-6 space-y-5" data-review-response="true">/);
        expect(send).toContain("Send to your client");
        expect(send).toContain("data-send-confirm");
    });

    it("is not shown on a locked proposal, as before", () => {
        const html = markup(LOCK);
        expect(html).not.toContain("data-review-response");
        expect(html).not.toContain('name="response-kind"');
        expect(html).not.toContain(LEGEND);
    });

    it("rendering in either state calls no save, send, upload, wording or load action", () => {
        for (const lock of [null, LOCK]) {
            const api = server();
            markup(lock, api);
            for (const fn of Object.values(api)) expect(fn).not.toHaveBeenCalled();
        }
    });
});

describe("existing response behaviour, unchanged by the move", () => {
    it("choosing an option uses the existing handler: the kind changes, the tick comes off, nothing is sent or saved", () => {
        const app = replay();
        app.render();
        harness.store.dispatch({ type: "confirm/set", confirmed: true });
        expect(app.state().confirmed).toBe(true);
        const radio = app.render().find((e) => e.type === "input" && e.props.name === "response-kind" && e.props.checked === false)!;
        (radio.props.onChange as () => void)();
        expect(app.state().responseKind).toBe("non_binding_intent");
        expect(app.state().confirmed).toBe(false);
        const after = app.render().filter((e) => e.type === "input" && e.props.name === "response-kind");
        expect(after.map((e) => e.props.checked)).toEqual([false, true]);
        for (const fn of Object.values(app.api)) expect(fn).not.toHaveBeenCalled();
    });

    it("the preview's response wording follows the choice", () => {
        const app = replay();
        const heading = () => app.render().find((e) => e.type === "h2" && e.props.id === "doc-response")!.props.children;
        expect(heading()).toBe(responseWording("acknowledgement").heading);
        harness.store.dispatch({ type: "response/choose", kind: "non_binding_intent" });
        expect(heading()).toBe(responseWording("non_binding_intent").heading);
    });

    it("is disabled while sending, as before", () => {
        const app = replay();
        const fieldset = () => app.render().find((e) => e.type === "fieldset" && nodes(e.props.children).some((c) => c.props.name === "response-kind"))!;
        expect(fieldset().props.disabled).toBe(false);
        harness.store.dispatch({ type: "send/started" });
        expect(fieldset().props.disabled).toBe(true);
    });
});
