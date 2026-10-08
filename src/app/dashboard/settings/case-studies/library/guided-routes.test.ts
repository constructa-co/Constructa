import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: null as { id: string } | null, createClient: vi.fn(), sessionReader: vi.fn(), createAdminClient: vi.fn(), order: [] as string[] }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT ${to}`); }, useRouter: () => ({}) }));
vi.mock("@/lib/case-library/store", async (original) => ({ ...(await original<typeof import("@/lib/case-library/store")>()), sessionReader: mocks.sessionReader }));
vi.mock("../library-actions", () => ({ createCaseStudyAction: vi.fn(), saveCaseStudyAction: vi.fn(), saveDisciplineAction: vi.fn() }));

import { fakeLibrary } from "@/lib/case-library/__fixtures__/fake-library";
import { newDraft } from "@/lib/case-library/content";
import { CASE_LIBRARY_VARIABLE } from "@/lib/case-library/gate";
import { LIBRARY_MESSAGES as M } from "@/lib/case-library/messages";
import { createStudy, saveDiscipline } from "@/lib/case-library/service";
import GuidedCapture from "./guided-capture";
import NewGuidedPage from "./new/guided/page";
import ExistingGuidedPage from "./[id]/guided/page";

/**
 * The two guided routes themselves: who is asking, then the switch, then a
 * read with the contractor's own session. The privileged client is never
 * made by a page.
 */
const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let db: ReturnType<typeof fakeLibrary>;

const open = (id: string) => ExistingGuidedPage({ params: Promise.resolve({ id }) });
const PAGES: Array<[string, () => Promise<ReactElement>]> = [["new", () => NewGuidedPage()], ["existing", () => open("00000000-0000-4000-8000-000000000001")]];

function find(node: ReactNode, match: (element: ReactElement) => boolean): ReactElement | null {
    if (Array.isArray(node)) { for (const child of node) { const found = find(child, match); if (found) return found; } return null; }
    if (!isValidElement(node)) return null;
    if (match(node)) return node;
    return find((node.props as { children?: ReactNode }).children, match);
}
const text = (node: ReactNode): string => (Array.isArray(node) ? node.map(text).join("") : isValidElement(node) ? text((node.props as { children?: ReactNode }).children) : typeof node === "string" ? node : "");
const screenIn = (page: ReactElement) => find(page, (element) => element.type === GuidedCapture);

beforeEach(async () => {
    mocks.order.length = 0;
    for (const mock of [mocks.createClient, mocks.sessionReader, mocks.createAdminClient]) mock.mockReset();
    db = fakeLibrary();
    mocks.user = { id: ME };
    mocks.createClient.mockImplementation(async () => { mocks.order.push("session"); return { auth: { getUser: async () => ({ data: { user: mocks.user } }) }, session: "contractor" }; });
    mocks.sessionReader.mockImplementation(() => { mocks.order.push("own-session reader"); return db.reader; });
    mocks.createAdminClient.mockImplementation(() => { throw new Error("a page must never make the privileged client"); });
    vi.unstubAllEnvs();
});

describe.each(PAGES)("the %s guided route", (_name, render) => {
    it("signed out: sent to sign in, and nothing is read", async () => {
        vi.stubEnv(CASE_LIBRARY_VARIABLE, "1");
        mocks.user = null;
        await expect(render()).rejects.toThrow("REDIRECT /login");
        expect(mocks.sessionReader).not.toHaveBeenCalled();
        expect(db.readCalls).toEqual([]);
    });

    it.each([undefined, "", "0", "true", "1 "])("switched off (%j): sent to the Case Studies page after sign-in, and nothing is read", async (value) => {
        if (value !== undefined) vi.stubEnv(CASE_LIBRARY_VARIABLE, value);
        await expect(render()).rejects.toThrow("REDIRECT /dashboard/settings/case-studies");
        expect(mocks.order).toEqual(["session"]);
        expect(db.readCalls).toEqual([]);
    });

    it("the library is not there: says so, and shows no questions", async () => {
        vi.stubEnv(CASE_LIBRARY_VARIABLE, "1");
        db.setUnavailable(true);
        const page = await render();
        expect(screenIn(page)).toBeNull();
        expect(text(page)).toContain(M.unavailable);
        expect(mocks.createAdminClient).not.toHaveBeenCalled();
    });
});

describe("with the library switched on", () => {
    const me = () => ({ userId: ME, reader: db.reader, admin: () => db.admin });
    beforeEach(() => vi.stubEnv(CASE_LIBRARY_VARIABLE, "1"));

    it("a new one is given the contractor's own kinds of work and nothing pre-filled", async () => {
        await saveDiscipline(me(), { id: null, revision: 0, label: "Kitchens" });
        await saveDiscipline({ userId: OTHER, reader: db.reader, admin: () => db.admin }, { id: null, revision: 0, label: "Someone else's trade" });
        const screen = screenIn(await NewGuidedPage())!;
        const props = screen.props as { initial: unknown; disciplines: Array<{ label: string }>; basePath: string; listHref: string; server?: unknown };
        expect(props.initial).toBeNull();
        expect(props.disciplines.map((entry) => entry.label)).toEqual(["Kitchens"]);
        expect(props).toMatchObject({ basePath: "/dashboard/settings/case-studies/library", listHref: "/dashboard/settings/case-studies" });
        // The real server actions are the default; a page never swaps them.
        expect(props.server).toBeUndefined();
        expect(mocks.sessionReader).toHaveBeenCalledWith(expect.objectContaining({ session: "contractor" }));
    });

    it("an existing one is opened from what is saved, read at one revision with the contractor's own session", async () => {
        const created = await createStudy(me(), { content: { ...newDraft("Kitchen"), delivered: "We refitted it.", work_type: "Refurbishment" }, disciplineIds: [] });
        db.readCalls.length = 0;
        const screen = screenIn(await open(created.id!))!;
        expect(db.readCalls).toEqual(["revision", "study", "disciplines", "revision"]);
        expect((screen.props as { initial: unknown }).initial).toMatchObject({ id: created.id, revision: 1, content: { title: "Kitchen", delivered: "We refitted it.", work_type: "Refurbishment" } });
    });

    it("another contractor's case study is 'not available': no questions, and nothing of theirs shown", async () => {
        const theirs = await createStudy({ userId: OTHER, reader: db.reader, admin: () => db.admin }, { content: { ...newDraft("Their secret job"), delivered: "Theirs." }, disciplineIds: [] });
        const page = await open(theirs.id!);
        expect(screenIn(page)).toBeNull();
        expect(text(page)).toContain(M.notFound);
        expect(text(page)).not.toContain("Their secret job");
    });

    it.each(["not-an-id", "../../etc/passwd", "00000000-0000-4000-8000-00000000ffff"])("an id that is not one of theirs (%s) is 'not available'", async (id) => {
        const page = await open(id);
        expect(screenIn(page)).toBeNull();
        expect(text(page)).toContain(M.notFound);
    });

    it("being changed at that moment: says so and shows no questions, never a mixture", async () => {
        const created = await createStudy(me(), { content: newDraft("Kitchen"), disciplineIds: [] });
        const real = db.reader.revision;
        db.reader.revision = async (user, id) => { db.studies[0].revision += 1; return real(user, id); };
        const page = await open(created.id!);
        expect(screenIn(page)).toBeNull();
        expect(text(page)).toContain(M.changingOnOpen);
    });

    it("an archived one is not opened for questions", async () => {
        const created = await createStudy(me(), { content: newDraft("Kitchen"), disciplineIds: [] });
        db.studies[0].archived = true;
        const page = await open(created.id!);
        expect(screenIn(page)).toBeNull();
        expect(text(page)).toContain("This case study is archived. Bring it back on the Case Studies page first.");
    });

    it("no page makes the privileged client or runs a database function", async () => {
        const created = await createStudy(me(), { content: newDraft("Kitchen"), disciplineIds: [] });
        db.rpcCalls.length = 0;
        await NewGuidedPage();
        await open(created.id!);
        expect(mocks.createAdminClient).not.toHaveBeenCalled();
        expect(db.rpcCalls).toEqual([]);
    });
});
