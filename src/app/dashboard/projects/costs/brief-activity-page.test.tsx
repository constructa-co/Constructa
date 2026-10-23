import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";
const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/case-library/gate", () => ({ caseLibraryEnabled: () => false }));
vi.mock("next/navigation", () => ({ redirect: (route: string) => { throw Error("REDIRECT:" + route); } }));
vi.mock("@/components/project-navbar", () => ({ default: () => null }));
vi.mock("./estimate-client", () => ({ default: () => null }));
import EstimatingPage from "./page";

let db: ReturnType<typeof fakeSupabase>;
let projections: string[];
beforeEach(() => {
    projections = [];
    db = fakeSupabase({ projects: [
        { id: "a", user_id: "owner", name: "Kitchen", brief_scope: "Saved work", brief_trade_sections: ["Protect kitchen", "Strip out cupboards"], selected_case_study_ids: null },
        { id: "b", user_id: "owner", name: "Roof", brief_scope: "Other work", brief_trade_sections: ["Roof repairs"], selected_case_study_ids: null },
    ], estimates: [], profiles: [{ id: "owner", case_studies: [] }] });
    mocks.client.mockResolvedValue({ ...db.client, auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
        from: (table: string) => {
            const query = db.client.from(table);
            return { ...query, select: (fields: string) => { if (table === "projects") projections.push(fields); return query; } };
        } });
});

describe("saved Brief activity source on the actual pricing page", () => {
    it("passes the current job's exact saved names using the same project read", async () => {
        const result = await EstimatingPage({ searchParams: Promise.resolve({ projectId: "a" }) });
        const project = result.props.children[1].props.project;
        expect(project.brief_trade_sections).toEqual(["Protect kitchen", "Strip out cupboards"]);
        expect(project.brief_scope).toBe("Saved work");
        expect(projections).toHaveLength(2);
        expect(projections[0]).toBe("id, name");
        expect(projections[1].split(", ")).toContain("brief_trade_sections");
        expect(db.updates).toEqual([]); expect(db.rpcCalls).toEqual([]);
    });

    it("does not carry another job's Brief names when switching resolved jobs", async () => {
        const first = await EstimatingPage({ searchParams: Promise.resolve({ projectId: "a" }) });
        const second = await EstimatingPage({ searchParams: Promise.resolve({ projectId: "b" }) });
        expect(first.props.children[1].key).toBe("a"); expect(second.props.children[1].key).toBe("b");
        expect(second.props.children[1].props.project.brief_trade_sections).toEqual(["Roof repairs"]);
        expect(db.updates).toEqual([]);
    });

    it("does not load Brief detail or mount an editor before URL identity resolves", async () => {
        const result = await EstimatingPage({ searchParams: Promise.resolve({}) });
        expect(result.props.path).toBe("/dashboard/projects/costs");
        expect(projections).toEqual(["id, name"]);
        expect(db.log).toEqual(["select:projects"]);
    });

    it.each([null, undefined])("keeps missing Brief names %j as an empty suggestion source", async value => {
        db.tables.projects[0].brief_trade_sections = value;
        const result = await EstimatingPage({ searchParams: Promise.resolve({ projectId: "a" }) });
        expect(result.props.children[1].props.project.brief_trade_sections).toEqual([]);
        expect(db.updates).toEqual([]);
    });
});
