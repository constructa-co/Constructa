import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ createClient: vi.fn(), reads: [] as string[] }));
vi.mock("@/lib/supabase/server", () => ({ createClient: state.createClient }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw Error(url); } }));
vi.mock("@/components/project-navbar", () => ({ default: () => null }));
vi.mock("./brief/brief-client", () => ({ default: () => null }));
vi.mock("./costs/estimate-client", () => ({ default: () => null }));
vi.mock("./schedule/simple-programme-client", () => ({ default: () => null }));
vi.mock("./proposal/review-send-client", () => ({ default: () => null }));
vi.mock("@/lib/case-library/gate", () => ({ caseLibraryEnabled: () => false }));
import BriefPage from "./brief/page";
import EstimatingPage from "./costs/page";
import SchedulePage from "./schedule/page";
import ProposalPage from "./proposal/page";

const project = { id: "job-1", name: "Actual server name <North> & client", user_id: "owner", brief_scope: "Retained work" };
type Element = ReactElement<{ children: Element[]; projectId: string; projectName: string; project?: typeof project; context?: { project: typeof project } }>;
beforeEach(() => {
    state.reads = [];
    state.createClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
        from: (table: string) => {
            const filters: Record<string, unknown> = {};
            const result = () => { state.reads.push(table); return { data: table === "projects" ? [project] : [] }; };
            const query = {
                select: () => query,
                eq: (key: string, value: unknown) => { filters[key] = value; return query; },
                order: async () => result(),
                single: async () => { state.reads.push(table); return { data: table === "profiles" ? { company_name: "Saved company" } : filters.id === project.id ? project : null }; },
                then: (resolve: (v: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
            };
            return query;
        },
    });
});
describe.each([["brief", BriefPage], ["estimating", EstimatingPage], ["programme", SchedulePage], ["proposal", ProposalPage]] as const)("%s job-context header", (_name, Page) => {
    it("uses the editor's actual server project identity and exact name with existing reads only", async () => {
        const page = await Page({ searchParams: Promise.resolve({ projectId: project.id }) }) as Element;
        const [header, editor] = page.props.children;
        expect(header.props.projectId).toBe(project.id); expect(header.props.projectName).toBe(project.name);
        expect(editor.key).toBe(project.id);
        expect((editor.props.project ?? editor.props.context?.project)?.name).toBe(project.name);
        expect(state.reads.every(table => ["projects", "estimates", "profiles", "proposal_publications"].includes(table))).toBe(true);
    });
});
