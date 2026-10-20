import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const current = vi.hoisted(() => ({ theme: "dark" }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: current.theme }) }));
vi.mock("./project-board", () => ({ default: ({ projects }: { projects: unknown[] }) => <div data-pipeline-board data-count={projects.length} /> }));
vi.mock("./project-list", () => ({ default: () => <div data-pipeline-list /> }));
import DashboardClient from "./dashboard-client";

const project = { id: "job", name: "Example kitchen", client_name: "Test client", project_type: "Kitchen", status: "Lead", potential_value: 1000, created_at: "2026-10-19T00:00:00Z" };
const props = { projects: [project], financials: { job: 1000 }, companyName: "Test builders", metrics: { totalPipelineValue: 1000, proposalsSent: 0, wonThisMonth: 0, activeJobs: 0, winRate: 0, winRateSampleSize: 0, totalRevenueSigned: 0 } };
const render = (projects = props.projects, launchNotice = false) => renderToStaticMarkup(<DashboardClient {...props} projects={projects} launchNotice={launchNotice} />);
beforeEach(() => { current.theme = "dark"; vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-19T09:00:00Z")); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("cohort dashboard placeholder presentation", () => {
    it.each(["dark", "system-c"])("hides both future panels in the %s cohort view", theme => {
        current.theme = theme; vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
        const html = render();
        for (const text of ["Resource Management", "Financial Dashboard", "Notify me", "coming in a future update"]) expect(html).not.toContain(text);
        expect(html).toContain("Pipeline Value"); expect(html).toContain("£1k");
        expect(html).toContain("data-pipeline-board"); expect(html).toContain('data-count="1"');
    });
    it.each([undefined, "unknown"])("keeps the existing safe cohort fallback for %s", profile => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", profile);
        expect(render()).not.toContain("Resource Management"); expect(render()).not.toContain("Financial Dashboard");
    });
    it.each(["dark", "system-c"])("retains both complete, disabled placeholder panels for full %s profile", theme => {
        current.theme = theme; vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "full");
        const html = render();
        expect(html).toContain("Resource Management"); expect(html).toContain("Financial Dashboard");
        expect(html.match(/coming in a future update/g)).toHaveLength(2);
        expect(html.match(/>Notify me<\/button>/g)).toHaveLength(2);
        expect(html.match(/<button disabled=""/g)).toHaveLength(2);
        expect(html).toContain("Labour allocation, plant scheduling and subcontractor management");
        expect(html).toContain("P&amp;L by project, cash flow, margin analysis and management accounts");
    });
    it.each(["cohort", "full"])("keeps the zero-project first-job path for %s", profile => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", profile);
        const html = render([]);
        expect(html).toContain("Test builders"); expect(html).toContain("/dashboard/projects/new");
        expect(html).not.toContain("Resource Management"); expect(html).not.toContain("Financial Dashboard");
    });
    it("retains the unavailable-module notice and real pipeline without adding a fake metric", () => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
        const html = render(props.projects, true);
        expect(html).toContain("That module is retained for a later Constructa release.");
        for (const label of ["Proposals Sent", "Projects Won", "Active Jobs", "Win Rate", "Revenue Signed"]) expect(html).toContain(label);
        expect(html).toContain('data-count="1"');
    });
});
