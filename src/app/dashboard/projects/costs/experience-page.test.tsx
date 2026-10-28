import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";
const mocks = vi.hoisted(() => ({ client: vi.fn(), library: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/case-library/gate", () => ({ caseLibraryEnabled: () => false }));
vi.mock("@/lib/case-library/proposal-read", () => ({ readProposalLibrary: mocks.library }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw Error("REDIRECT:" + path); } }));
vi.mock("@/components/project-navbar", () => ({ default: () => null }));
vi.mock("./estimate-client", () => ({ default: () => null }));
import { dashboardRouteShellBody } from "@/lib/__fixtures__/dashboard-route-shell-page";
import EstimatingPage from "./page";
let db: ReturnType<typeof fakeSupabase>;
beforeEach(() => {
    db = fakeSupabase({ projects: [{ id: "job", user_id: "owner", name: "Saved job", selected_case_study_ids: ["missing"], brief_scope: "Work" }],
        estimates: [], profiles: [{ id: "owner", case_studies: [{ id: "past", projectName: "Actual saved job" }] }] });
    mocks.client.mockResolvedValue({ ...db.client, auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) } }); mocks.library.mockClear();
});
describe("actual pricing page owned experience source wiring", () => {
    it("loads existing selection and only the signed-in owner's profile,without activating library", async () => {
        const page = await EstimatingPage({ searchParams: Promise.resolve({ projectId: "job" }) });
        const source = dashboardRouteShellBody(page).props.project.experience;
        expect(source.selected).toEqual(["missing"]); expect(source.retained).toEqual(["missing"]);
        expect(source.options).toEqual([{ tick: "past", title: "Actual saved job", detail: "" }]);
        expect(mocks.library).not.toHaveBeenCalled(); expect(db.updates).toEqual([]);
    });
    it("does not load profile sources before a project has been resolved", async () => {
        await EstimatingPage({ searchParams: Promise.resolve({}) });
        expect(db.log.some(entry => entry.endsWith(":profiles"))).toBe(false); expect(db.updates).toEqual([]);
    });
    it("does not substitute a different profile or an empty catalog if the owner profile is unreadable", async () => {
        db.tables.profiles[0].id = "other";
        const page = await EstimatingPage({ searchParams: Promise.resolve({ projectId: "job" }) });
        expect(dashboardRouteShellBody(page).props.project.experience).toBeNull(); expect(db.updates).toEqual([]);
    });
});
