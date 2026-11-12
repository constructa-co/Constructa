import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { fakeSupabase, type Row } from "@/lib/__fixtures__/fake-supabase";
import { minimalInput } from "@/lib/__fixtures__/proposal";
import type { ReviewAction, ReviewContext, ReviewProject, ReviewState } from "@/lib/proposal-review";
import { reviewSaveStatus } from "@/lib/proposal-review";

const journeyAuth = vi.hoisted(() => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: journeyAuth.requireAuth }));

const replay = vi.hoisted(() => ({
    state: null as ReviewState | null,
    slots: [] as unknown[],
    cursor: 0,
    save: vi.fn(),
    ask: vi.fn(),
    publish: vi.fn(),
}));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useEffect: () => undefined,
    useMemo: (calculate: () => unknown) => calculate(),
    useRef: (initial: unknown) => ({ current: initial }),
    useState: (initial: unknown) => {
        const index = replay.cursor++;
        if (!(index in replay.slots)) {
            replay.slots[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
        }
        return [
            replay.slots[index],
            (value: unknown) => {
                replay.slots[index] = typeof value === "function"
                    ? (value as (previous: unknown) => unknown)(replay.slots[index])
                    : value;
            },
        ];
    },
}));
vi.mock("@/lib/use-reducer-store", () => ({
    useReducerStore: (reduce: (state: ReviewState, action: ReviewAction) => ReviewState, initial: () => ReviewState) => {
        if (!replay.state) replay.state = initial();
        return [replay.state, {
            getState: () => replay.state,
            dispatch: (action: ReviewAction) => { replay.state = reduce(replay.state!, action); },
        }];
    },
}));
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

import { createBlankProjectAction } from "@/app/dashboard/projects/new/actions";
import ReviewSendClient from "./review-send-client";

type Element = ReactElement<Record<string, unknown>>;

const JOURNEY_USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOURNEY_REQUEST = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function journeyFormData() {
    const fd = new FormData();
    fd.set("requestId", JOURNEY_REQUEST);
    fd.set("name", "New journey job");
    fd.set("client", "Journey Client");
    return fd;
}

function installA069CreateRpc(db: ReturnType<typeof fakeSupabase>, userId: string) {
    const committed = new Map<string, string>();
    db.onRpc((name, args) => {
        if (name !== "create_phase1_project_graph") return { data: null, error: null };
        const requestId = String(args.p_request_id);
        if (committed.has(requestId)) {
            return { data: [{ project_id: committed.get(requestId), estimate_ids: [] }], error: null };
        }
        const profile = (db.tables.profiles ?? []).find(row => row.id === userId);
        const md = typeof profile?.md_message === "string" ? profile.md_message : null;
        const closing = md && md.trim() ? md : null;
        const payload = args.p_project as Row;
        const projectId = `project-${(db.tables.projects?.length ?? 0) + 1}`;
        db.tables.projects = db.tables.projects ?? [];
        db.tables.projects.push({
            id: projectId,
            user_id: userId,
            name: payload.name,
            client_name: payload.client_name,
            closing_statement: closing,
            payment_schedule: [],
            programme_phases: [],
        });
        committed.set(requestId, projectId);
        return { data: [{ project_id: projectId, estimate_ids: [] }], error: null };
    });
}

async function createProjectRow(mdMessage: string | null) {
    const db = fakeSupabase({
        profiles: [{ id: JOURNEY_USER, md_message: mdMessage }],
        projects: [],
    });
    installA069CreateRpc(db, JOURNEY_USER);
    journeyAuth.requireAuth.mockResolvedValue({ supabase: db.client });
    const created = await createBlankProjectAction(journeyFormData());
    expect(created.success).toBe(true);
    if (!created.success) throw new Error("create failed");
    const { data, error } = await db.client.from("projects").select().eq("id", created.projectId).eq("user_id", JOURNEY_USER).single();
    expect(error).toBeNull();
    return { row: data as unknown as ReviewProject, db, projectId: created.projectId };
}

function reviewContext(project: ReviewProject, mdMessage: string | null): ReviewContext {
    const input = minimalInput();
    return {
        project: { ...input.project, ...project, id: project.id, name: project.name, client_name: project.client_name, closing_statement: project.closing_statement },
        profile: { ...input.profile, md_message: mdMessage },
        estimate: input.estimate,
        nextVersion: 1,
    };
}

function view(current: ReviewContext, locked = false) {
    replay.cursor = 0;
    return ReviewSendClient({
        context: current,
        caseStudies: [],
        publications: [],
        lockReason: locked ? "This proposal has been accepted." : null,
        estimateIssue: null,
        now: "2026-10-22T01:00:00Z",
        server: {
            save: replay.save,
            ask: replay.ask,
            publish: replay.publish,
            retry: vi.fn(),
            upload: vi.fn(),
            loadPublication: vi.fn(),
        },
    });
}

function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Element;
    return [node, ...nodes(node.props.children)];
}

function closingField(current: ReviewContext) {
    return nodes(view(current)).find(node => node.props.id === "wording-closing")!.props;
}

function useCompanyButton(current: ReviewContext) {
    return nodes(view(current)).find(node => node.props["data-use-company-closing"])!.props;
}

async function submitSave(current: ReviewContext) {
    const form = nodes(view(current)).find(node => node.type === "form")!;
    (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
    await Promise.resolve();
    await Promise.resolve();
}

beforeEach(() => {
    journeyAuth.requireAuth.mockReset();
    replay.state = null;
    replay.slots = [];
    replay.cursor = 0;
    replay.save.mockReset().mockResolvedValue({ success: true });
    replay.ask.mockReset();
    replay.publish.mockReset();
});

describe("A069 closing editor journey (create action → ReviewSendClient handlers)", () => {
    const prefilledRaw = "  We look forward to working with you.\n\nAlex, managing director";

    it("shows RPC-persisted closing verbatim in the real wording field and starts saved", async () => {
        const { row } = await createProjectRow(prefilledRaw);
        const current = reviewContext(row, prefilledRaw);
        expect(closingField(current).value).toBe(prefilledRaw);
        expect(reviewSaveStatus(replay.state!)).toBe("saved");
        expect(useCompanyButton(current).disabled).toBe(true);
        expect(replay.save).not.toHaveBeenCalled();
    });

    it("preserves leading spaces in the draft field while save uses the existing trim-on-save rule", async () => {
        const { row } = await createProjectRow(prefilledRaw);
        const current = reviewContext(row, prefilledRaw);
        const edited = prefilledRaw + "\n\nEdited tail";
        (closingField(current).onChange as (event: unknown) => void)({ target: { value: edited } });
        expect(closingField(current).value).toBe(edited);
        await submitSave(current);
        expect(replay.save).toHaveBeenCalledOnce();
        expect(replay.save).toHaveBeenCalledWith(expect.objectContaining({ closing: edited.trim() }));
    });

    it("does not refill after the contractor saves an explicit blank clearing", async () => {
        const { row, db, projectId } = await createProjectRow(prefilledRaw);
        let current = reviewContext(row, prefilledRaw);
        (closingField(current).onChange as (event: unknown) => void)({ target: { value: "" } });
        await submitSave(current);
        expect(replay.save).toHaveBeenCalledWith(expect.objectContaining({ closing: "" }));

        const stored = db.tables.projects!.find(p => p.id === projectId)!;
        stored.closing_statement = null;
        db.tables.profiles![0]!.md_message = "Profile message after explicit blank save";
        replay.state = null;
        current = reviewContext(stored as unknown as ReviewProject, "Profile message after explicit blank save");
        expect(closingField(current).value).toBe("");
        expect(useCompanyButton(current).disabled).toBe(false);
        expect(replay.save).toHaveBeenCalledOnce();
    });

    it("keeps persisted closing when the profile message changes later", async () => {
        const { row, db } = await createProjectRow(prefilledRaw);
        const current = reviewContext(row, "Completely different profile text");
        expect(closingField(current).value).toBe(prefilledRaw);
        db.tables.profiles![0]!.md_message = "Yet another profile message";
        replay.state = null;
        const remount = reviewContext(row, db.tables.profiles![0]!.md_message as string);
        expect(closingField(remount).value).toBe(prefilledRaw);
        expect(replay.save).not.toHaveBeenCalled();
    });

    it("preserves draft closing on refused save and acknowledges a successful retry", async () => {
        const { row } = await createProjectRow(prefilledRaw);
        const current = reviewContext(row, prefilledRaw);
        const edited = prefilledRaw + "\n\nPlease confirm dates.";
        (closingField(current).onChange as (event: unknown) => void)({ target: { value: edited } });

        replay.save.mockResolvedValueOnce({ success: false, error: "Save not confirmed" });
        await submitSave(current);
        expect(closingField(current).value).toBe(edited);
        expect(reviewSaveStatus(replay.state!)).toBe("failed");
        expect(nodes(view(current)).some(node => node.props["data-review-save-error"])).toBe(true);

        replay.save.mockResolvedValueOnce({ success: true });
        await submitSave(current);
        expect(replay.save).toHaveBeenCalledTimes(2);
        expect(replay.save).toHaveBeenLastCalledWith(expect.objectContaining({ closing: edited.trim() }));
        expect(reviewSaveStatus(replay.state!)).toBe("saved");
    });

    it("leaves closing empty when creation did not seed a blank-eligible profile message", async () => {
        const blankEligible = "\u00A0\uFEFF";
        const { row } = await createProjectRow(blankEligible);
        const current = reviewContext(row, blankEligible);
        expect(row.closing_statement).toBeNull();
        expect(closingField(current).value).toBe("");
        expect(nodes(view(current)).some(node => node.props["data-use-company-closing"])).toBe(false);
    });
});
