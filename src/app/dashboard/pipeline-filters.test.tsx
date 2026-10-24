import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

const current = vi.hoisted(() => ({ theme: "dark" }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: current.theme }) }));
vi.mock("./project-board", () => ({ default: ({ projects }: { projects: unknown[] }) => <div data-pipeline-board data-count={projects.length} /> }));
vi.mock("./project-list", () => ({ default: () => <div data-pipeline-list /> }));
import DashboardClient from "./dashboard-client";

afterEach(() => vi.unstubAllEnvs());

it.each(["dark", "system-c"])("visibly identifies stage filtering as view-only in %s", theme => {
    current.theme = theme;
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
    const html = renderToStaticMarkup(<DashboardClient
        projects={[{ id: "job", name: "Kitchen", status: "Lead", project_type: "Kitchen" }]}
        financials={{}}
        companyName="Test builders"
        metrics={{ totalPipelineValue: 0, proposalsSent: 0, wonThisMonth: 0, activeJobs: 0, winRate: 0, winRateSampleSize: 0, totalRevenueSigned: 0 }}
    />);
    expect(html).toMatch(/data-project-filters[^>]*role="group"[^>]*aria-labelledby="pipeline-filters-heading"/);
    expect(html).toMatch(/<h2 id="pipeline-filters-heading"[^>]*>Filter jobs<\/h2>/);
    expect(html).toMatch(/<p id="pipeline-filters-help"[^>]*>View only: these filters do not change a job&#x27;s stage\.<\/p>/);
    const stageSelect = html.match(/<select[^>]*aria-label="Filter by stage"[\s\S]*?<\/select>/)?.[0];
    expect(stageSelect).toContain('aria-describedby="pipeline-filters-help"');
    expect(stageSelect?.match(/<option[^>]*>([^<]+)<\/option>/g)?.map(option => option.replace(/<[^>]+>/g, "")))
        .toEqual(["All Stages", "Lead", "Estimating", "Proposal Sent", "Active", "Won", "Completed", "Lost"]);
    expect(stageSelect).toContain('value="all" selected=""');
    expect(html).toContain('data-count="1"');
});
