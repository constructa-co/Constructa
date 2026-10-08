import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAuth: vi.fn(), createAdminClient: vi.fn(), sessionReader: vi.fn(), revalidatePath: vi.fn(), order: [] as string[] }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/case-library/store", async (original) => ({ ...(await original<typeof import("@/lib/case-library/store")>()), sessionReader: mocks.sessionReader }));

import { fakeLibrary } from "@/lib/case-library/__fixtures__/fake-library";
import { newDraft } from "@/lib/case-library/content";
import { CASE_LIBRARY_VARIABLE } from "@/lib/case-library/gate";
import { LIBRARY_MESSAGES as M } from "@/lib/case-library/messages";
import {
    approveCaseStudyAction, archiveCaseStudyAction, archiveDisciplineAction, checkCaseStudyAction, createCaseStudyAction,
    saveCaseStudyAction, saveDisciplineAction, startFromOlderCaseStudyAction,
} from "./library-actions";

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ID = "00000000-0000-4000-8000-000000000001";
const good = { ...newDraft("Kitchen"), delivered: "We refitted it." };
let db: ReturnType<typeof fakeLibrary>;

/** Every action, called with input that is valid in shape. */
const ACTIONS: Array<[string, () => Promise<{ status: string }>]> = [
    ["create", () => createCaseStudyAction({ content: good, disciplineIds: [] })],
    ["save", () => saveCaseStudyAction({ id: ID, revision: 1, content: good, disciplineIds: [] })],
    ["check", () => checkCaseStudyAction(ID)],
    ["approve", () => approveCaseStudyAction({ id: ID, revision: 1, confirmed: true })],
    ["archive", () => archiveCaseStudyAction({ id: ID, revision: 1, archived: true })],
    ["save a kind of work", () => saveDisciplineAction({ id: null, revision: 0, label: "Kitchens" })],
    ["archive a kind of work", () => archiveDisciplineAction({ id: ID, revision: 1, archived: true })],
    ["start from an older case study", () => startFromOlderCaseStudyAction({ index: 0 })],
];

beforeEach(() => {
    mocks.order.length = 0;
    for (const mock of [mocks.requireAuth, mocks.createAdminClient, mocks.sessionReader, mocks.revalidatePath]) mock.mockReset();
    db = fakeLibrary({ olderByUser: { [ME]: [{ projectName: "Older kitchen" }] } });
    mocks.requireAuth.mockImplementation(async () => { mocks.order.push("auth"); return { user: { id: ME }, supabase: { session: "contractor" } }; });
    mocks.sessionReader.mockImplementation(() => { mocks.order.push("own-session reader"); return db.reader; });
    mocks.createAdminClient.mockImplementation(() => { mocks.order.push("privileged client"); return db.admin; });
    vi.unstubAllEnvs();
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe.each(ACTIONS)("%s", (_name, run) => {
    it("signed out: refused, with no reader, no privileged client and no database function", async () => {
        vi.stubEnv(CASE_LIBRARY_VARIABLE, "1");
        mocks.requireAuth.mockRejectedValue(new Error("Unauthorized: No user found."));
        expect(await run()).toEqual({ status: "signed-out", message: M.signedOut });
        expect(mocks.sessionReader).not.toHaveBeenCalled();
        expect(mocks.createAdminClient).not.toHaveBeenCalled();
        expect(db.rpcCalls).toEqual([]);
        expect(db.readCalls).toEqual([]);
    });

    it.each([undefined, "", "0", "true", "on", "1 "])("switched off (%j): refused after sign-in, before anything else", async (value) => {
        if (value !== undefined) vi.stubEnv(CASE_LIBRARY_VARIABLE, value);
        expect(await run()).toEqual({ status: "off", message: M.off });
        expect(mocks.order).toEqual(["auth"]);
        expect(db.rpcCalls).toEqual([]);
        expect(db.readCalls).toEqual([]);
    });

    it("switched on: who is asking is settled first, and any privileged client comes after", async () => {
        vi.stubEnv(CASE_LIBRARY_VARIABLE, "1");
        await run();
        expect(mocks.order[0]).toBe("auth");
        const privileged = mocks.order.indexOf("privileged client");
        if (privileged >= 0) expect(privileged).toBeGreaterThan(mocks.order.indexOf("auth"));
        for (const call of db.rpcCalls) expect(call.args.p_user_id).toBe(ME);
        expect(mocks.sessionReader).toHaveBeenCalledWith({ session: "contractor" });
    });
});

describe("with the library switched on", () => {
    beforeEach(() => vi.stubEnv(CASE_LIBRARY_VARIABLE, "1"));

    it.each([
        ["create with no job name", () => createCaseStudyAction({ content: { ...good, title: " " }, disciplineIds: [] })],
        ["create with nonsense", () => createCaseStudyAction(null as never)],
        ["save with a bad id", () => saveCaseStudyAction({ id: "../../etc", revision: 1, content: good, disciplineIds: [] })],
        ["save with too many kinds of work", () => saveCaseStudyAction({ id: ID, revision: 1, content: good, disciplineIds: Array.from({ length: 7 }, () => ID) })],
        ["approve without the tick", () => approveCaseStudyAction({ id: ID, revision: 1, confirmed: false })],
        ["archive with a bad id", () => archiveCaseStudyAction({ id: 7, revision: 1, archived: true })],
        ["a kind of work with no name", () => saveDisciplineAction({ id: null, revision: 0, label: "" })],
        ["archive a kind of work with a bad id", () => archiveDisciplineAction({ id: "x", revision: 1, archived: true })],
        ["start from a bad place", () => startFromOlderCaseStudyAction({ index: 1.5 })],
    ])("invalid input (%s) stops before the privileged client", async (_label, run) => {
        const result = await run();
        expect(["invalid", "not-found", "unconfirmed", "legacy-missing", "conflict"]).toContain(result.status);
        expect(mocks.createAdminClient).not.toHaveBeenCalled();
        expect(db.rpcCalls).toEqual([]);
    });

    it("no action can be pointed at another contractor: an id slipped into the input is ignored", async () => {
        const created = await createCaseStudyAction({ content: { ...good, user_id: OTHER }, disciplineIds: [], userId: OTHER, p_user_id: OTHER } as never);
        expect(created.status).toBe("saved");
        expect(db.studies[0].user_id).toBe(ME);
        await saveCaseStudyAction({ id: created.id, revision: 1, content: { ...good, title: "Edited" }, disciplineIds: [], userId: OTHER, p_user_id: OTHER } as never);
        await saveDisciplineAction({ id: null, revision: 0, label: "Kitchens", user_id: OTHER } as never);
        for (const call of db.rpcCalls) expect(call.args.p_user_id).toBe(ME);
        expect(db.disciplines[0].user_id).toBe(ME);
    });

    it("a full pass: add, save, check, approve, each telling the page to refresh", async () => {
        const created = await createCaseStudyAction({ content: good, disciplineIds: [] });
        const saved = await saveCaseStudyAction({ id: created.id, revision: created.revision, content: { ...good, delivered: "Edited." }, disciplineIds: [] });
        expect(saved).toMatchObject({ status: "saved", revision: 2 });
        const check = await checkCaseStudyAction(created.id);
        expect(check.status).toBe("ok");
        const approved = await approveCaseStudyAction({ id: created.id, revision: 2, confirmed: true });
        expect(approved).toMatchObject({ status: "approved", message: M.approved });
        expect(db.studies[0].approved).toMatchObject({ delivered: "Edited.", client_display: "hidden", disciplines: [] });
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/settings/case-studies");
    });

    it("something unforeseen is 'not known', never 'nothing changed'", async () => {
        mocks.sessionReader.mockImplementation(() => ({ ...db.reader, study: async () => { throw new Error("boom"); }, disciplines: async () => { throw new Error("boom"); } }));
        const result = await saveCaseStudyAction({ id: ID, revision: 1, content: good, disciplineIds: [] });
        expect(result).toEqual({ status: "unknown", message: M.unknown });
    });

    it("tables or functions missing: 'not available', and nothing is claimed to have been saved", async () => {
        db.setUnavailable(true);
        for (const [name, run] of ACTIONS) expect((await run()).status, name).toBe("unavailable");
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
});
