import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    PIPELINE_STATUS_FILTER_OPTIONS,
    pipelineStageDisplayLabel,
} from "./pipeline-stage-display";

const DASHBOARD_CLIENT = path.join(process.cwd(), "src/app/dashboard/dashboard-client.tsx");

const current = vi.hoisted(() => ({ theme: "dark" }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: current.theme }) }));
vi.mock("./project-board", () => ({
    default: ({ projects }: { projects: unknown[] }) => (
        <div data-pipeline-board data-count={projects.length} />
    ),
}));
vi.mock("./project-list", () => ({
    default: ({ projects }: { projects: unknown[] }) => (
        <div data-pipeline-list data-count={projects.length} />
    ),
}));
import DashboardClient from "./dashboard-client";

afterEach(() => vi.unstubAllEnvs());

const metrics = {
    totalPipelineValue: 0,
    proposalsSent: 0,
    wonThisMonth: 0,
    activeJobs: 0,
    winRate: 0,
    winRateSampleSize: 0,
    totalRevenueSigned: 0,
};

function renderDashboard() {
    current.theme = "dark";
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T09:00:00Z"));
    const html = renderToStaticMarkup(
        <DashboardClient
            projects={[
                {
                    id: "job",
                    name: "Kitchen",
                    status: "Lead",
                    project_type: "Kitchen",
                    created_at: "2026-10-19T00:00:00Z",
                },
            ]}
            financials={{ job: 5000 }}
            companyName="Test builders"
            metrics={metrics}
        />,
    );
    vi.useRealTimers();
    return html;
}

describe("A016/A018 dashboard clarity", () => {
    it("defaults to list view while keeping board available in the toggle", () => {
        const html = renderDashboard();
        expect(html).toContain("data-pipeline-list");
        expect(html).toContain('data-count="1"');
        expect(html).not.toContain("data-pipeline-board");
        expect(html).toMatch(/>\s*List\s*</);
        expect(html).toMatch(/>\s*Board\s*</);
    });

    it("exposes accessible view controls with aria-pressed on the active list mode", () => {
        const html = renderDashboard();
        expect(html).toMatch(/data-project-views[^>]*role="group"[^>]*aria-label="Pipeline view"/);
        expect(html).toMatch(/type="button"[^>]*aria-pressed="true"[^>]*>[\s\S]*?List/);
        expect(html).toMatch(/type="button"[^>]*aria-pressed="false"[^>]*>[\s\S]*?Board/);
    });

    it("keeps canonical stage values in filters while showing display labels", () => {
        const html = renderDashboard();
        const stageSelect = html.match(/<select[^>]*aria-label="Filter by stage"[\s\S]*?<\/select>/)?.[0];
        expect(stageSelect).toBeDefined();
        for (const status of PIPELINE_STATUS_FILTER_OPTIONS) {
            expect(stageSelect).toContain(`value="${status}"`);
        }
        expect(stageSelect).toContain(">Enquiries</option>");
        expect(stageSelect).toContain(">Preparing estimate</option>");
        expect(stageSelect).toContain('value="all" selected=""');
        expect(stageSelect?.match(/<option[^>]*>([^<]+)<\/option>/g)?.map(o => o.replace(/<[^>]+>/g, "")))
            .toEqual([
                "All Stages",
                ...PIPELINE_STATUS_FILTER_OPTIONS.map(pipelineStageDisplayLabel),
            ]);
    });

    it("retains list-first default in source wiring", () => {
        const source = readFileSync(DASHBOARD_CLIENT, "utf8");
        expect(source).toMatch(/useState<"board" \| "list">\("list"\)/);
    });

    it("retains A115 operational legend language on board-only stage hints", () => {
        const source = readFileSync(DASHBOARD_CLIENT, "utf8");
        expect(source).not.toMatch(/Auto: when proposal is sent/i);
        expect(source).toMatch(/operational/i);
        expect(source).toMatch(/view === "board"/);
    });
});
