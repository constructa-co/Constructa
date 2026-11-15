import { createElement, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
import { draftFromProject, initialReviewState, reviewReducer, savedDraftFromProject, type ReviewContext, type ReviewState } from "@/lib/proposal-review";
import ReviewSendClient, { type ReviewServer } from "./review-send-client";

const input = representativeInput();
function context(): ReviewContext {
    return { project: { ...input.project, validity_days: 30, client_email: "alex@example.test" }, profile: input.profile, estimate: input.estimate, nextVersion: 1 };
}
function server() {
    return {
        save: vi.fn(async () => ({ success: true })),
        ask: vi.fn(),
        publish: vi.fn(async () => ({
            success: true,
            url: "https://app.example.test/proposal/" + "a".repeat(64),
            versionNumber: 1,
            publicationId: "pub-1",
            delivery: { status: "not_requested" as const },
            contentHash: "b".repeat(64),
        })),
        retry: vi.fn(),
        upload: vi.fn(),
        loadPublication: vi.fn(),
    };
}
const props = (api = server(), ctx = context()) => ({
    context: ctx, caseStudies: [], lockReason: null, estimateIssue: null, publications: [], server: api as unknown as ReviewServer, now: "2026-10-05T09:00:00.000Z",
});

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const e = value as Element;
    return [e, ...nodes(e.props.children)];
}

function replay(api = server()) {
    const ctx = context();
    const positional = () => { let n = 0; return () => `saved-${n++}`; };
    let state: ReviewState = initialReviewState(draftFromProject(ctx.project, positional()), savedDraftFromProject(ctx.project, positional()));
    state = reviewReducer(state, { type: "confirm/set", confirmed: true });
    harness.store = { getState: () => state, dispatch: (action) => { state = reviewReducer(state, action as never); } };
    harness.replay = true;
    harness.slots = [];
    const render = () => { harness.cursor = 0; return nodes(ReviewSendClient(props(api, ctx))); };
  return { render, api };
}

function find(tree: Element[], dataKey: string) {
    return tree.find((e) => e.props[dataKey] !== undefined);
}

afterEach(() => { harness.replay = false; });

describe("recipient email confirmation", () => {
    it("does not call publish when email is opted in but the recipient is not confirmed", async () => {
        const api = server();
        const { render } = replay(api);
        const optIn = find(render(), "data-deliver-by-email")!;
        (optIn.props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: true } });
        const sendButton = find(render(), "data-send-button")!;
        expect(sendButton.props.disabled).toBe(true);
        (sendButton.props.onClick as () => void)();
        await vi.waitFor(() => expect(api.publish).not.toHaveBeenCalled());
    });

    it("calls publish without email when only the preview is confirmed", async () => {
        const api = server();
        const { render } = replay(api);
        const sendButton = find(render(), "data-send-button")!;
        expect(sendButton.props.disabled).toBe(false);
        (sendButton.props.onClick as () => void)();
        await vi.waitFor(() => expect(api.publish).toHaveBeenCalledWith(expect.objectContaining({ deliverByEmail: false })));
        const firstCall = (api.publish as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0] as
            { deliverByEmail: boolean; emailRecipientConfirmed?: boolean };
        expect(firstCall.deliverByEmail).toBe(false);
        expect(firstCall.emailRecipientConfirmed).toBeUndefined();
    });
});