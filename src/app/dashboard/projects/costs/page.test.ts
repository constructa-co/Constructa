import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw Error(`NEXT_REDIRECT:${path}`); } }));
vi.mock("@/components/project-navbar", () => ({ default: () => null }));
vi.mock("./estimate-client", () => ({ default: () => null }));

import { dashboardRouteShellBody } from "@/lib/__fixtures__/dashboard-route-shell-page";
import EstimatingPage from "./page";

// 12 October 2026 is a Monday. A and B overlap, so the span is 12 working days, not the 15 a sum would give.
const dated = [{ name: "A", calculatedDays: 5, startOffset: 0 }, { name: "B", calculatedDays: 10, startOffset: 2 }];
const projects = [
    { id: "job-a", name: "First job" }, { id: "job-b", name: "Empty job" }, { id: "job-vat", name: "Reverse charge job", is_vat_reverse_charge: true },
    { id: "job-dated", name: "Dated programme", start_date: "2026-10-12", programme_phases: dated },
    { id: "job-undated", name: "Phase with no start", start_date: null, programme_phases: dated },
    { id: "job-partial", name: "One stage cannot be dated", start_date: "2026-10-12", programme_phases: [...dated, { name: "C", calculatedDays: 0 }] },
    { id: "job-omitted", name: "Programme left out", start_date: "2026-10-12", programme_phases: [...dated, { programmeIntent: "omit", intent_version: 1 }] },
    { id: "job-bad-pattern", name: "Malformed pattern", start_date: "2026-10-12", programme_phases: dated, programme_working_pattern: { version: 9 } },
];
const saved = { id: "estimate-a", project_id: "job-a", estimate_lines: [{ id: "line-a", description: "First job only" }] };

async function editor(projectId?: string) {
    const page = await EstimatingPage({ searchParams: Promise.resolve({ projectId }) });
    return dashboardRouteShellBody(page);
}

describe("estimating project identity boundary", () => {
    beforeEach(() => {
        mocks.createClient.mockResolvedValue({
            auth: { getUser: async () => ({ data: { user: { id: "local-user" } } }) },
            from: (table: string) => {
                const filters: Record<string, string> = {};
                const query = {
                    select: () => query,
                    eq: (key: string, value: string) => { filters[key] = value; return query; },
                    single: async () => ({ data: projects.find(p => p.id === filters.id) }),
                    order: async () => ({ data: table === "projects" ? projects : filters.project_id === "job-a" ? [saved] : [] }),
                };
                return query;
            },
        });
    });

    it("remounts the pricing state for each loaded job", async () => {
        const first = await editor("job-a");
        const second = await editor("job-b");
        expect(first.key).toBe("job-a");
        expect(second.key).toBe("job-b");
        expect(first.type).toBe(second.type);
    });

    it("passes only the selected job's saved estimates, including an empty list", async () => {
        expect((await editor("job-a")).props.estimates[0].id).toBe("estimate-a");
        expect((await editor("job-b")).props.estimates).toEqual([]);
    });

    it("passes the job's saved reverse-charge setting to the editor, null when unset", async () => {
        expect((await editor("job-vat")).props.project.is_vat_reverse_charge).toBe(true);
        expect((await editor("job-a")).props.project.is_vat_reverse_charge).toBeNull();
    });

    it("passes the saved programme's own working-day span, counting overlapping stages once (D96 S6)", async () => {
        expect((await editor("job-dated")).props.project.programme_duration).toBe("12 working days");
    });

    it("passes no duration, rather than a guess, when none can be stated reliably (D96 S6)", async () => {
        for (const id of ["job-a", "job-undated", "job-partial", "job-omitted", "job-bad-pattern"]) {
            expect((await editor(id)).props.project.programme_duration, id).toBeNull();
        }
    });

    it("defers the no-ID editor until browser project memory has been resolved", async () => {
        const entry = await EstimatingPage({ searchParams: Promise.resolve({}) });
        expect(entry.props.path).toBe("/dashboard/projects/costs");
        expect(entry.props.projects).toEqual(projects);
    });
});
