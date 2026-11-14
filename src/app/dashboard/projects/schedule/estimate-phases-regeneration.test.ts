import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";

const mocks = vi.hoisted(() => ({ requireProjectAccess: vi.fn() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ ...mocks, requireAuth: vi.fn() }));
vi.mock("@/lib/supabase/project-resource-access", () => ({ requireEditableProjectAccess: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/cohort-ai/programme-update", () => ({ PROGRAMME_NOT_SAVED: "not saved", writeProgrammeUpdate: vi.fn() }));
vi.mock("@/lib/cohort-ai/shared", () => ({ COHORT_AI_UNAVAILABLE: "unavailable" }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { estimateSuggestedPhases } from "@/lib/planner-phases";
import { getEstimatePhasesAction } from "./actions";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
// 2 November 2026 is a Monday.
const MONDAY = "2026-11-02";

const sixHourDays = {
    version: 2 as const,
    timezone: "Europe/London",
    weekdays: [1, 2, 3, 4, 5],
    intervals: [1, 2, 3, 4, 5].map(weekday => ({ weekday, startMinute: 480, endMinute: 840 })),
    standardMinutesPerDay: 360,
    productivityPct: 100,
};

const lines = (quantity: number | null, hours: number) => [
    { trade_section: "Tiling", quantity, estimate_line_components: [{ total_manhours: hours }] },
];

function setup(estimateLines: unknown[], pattern: unknown = null) {
    const db = fakeSupabase({
        estimates: [{ id: "est-1", project_id: PROJECT_ID, is_active: true, created_at: 1, estimate_lines: estimateLines }],
        projects: [{ id: PROJECT_ID, user_id: USER_ID, start_date: MONDAY, programme_working_pattern: pattern }],
    });
    mocks.requireProjectAccess.mockResolvedValue({ user: { id: USER_ID }, supabase: db.client });
    return db;
}

beforeEach(() => vi.clearAllMocks());

describe("getEstimatePhasesAction uses the same suggestions as the planner", () => {
    it("sizes stages on the job's productive day, not a fixed eight hours", async () => {
        setup(lines(1, 24), sixHourDays);
        const [stage] = await getEstimatePhasesAction(PROJECT_ID);
        // 24 hours at 6 productive hours a day is 4 days; the old path gave 3.
        expect(stage).toMatchObject({ name: "Tiling", calculatedDays: 4, manhours: 24 });
    });

    it("keeps eight-hour days for a job with no explicit capacity", async () => {
        setup(lines(1, 24));
        const [stage] = await getEstimatePhasesAction(PROJECT_ID);
        expect(stage.calculatedDays).toBe(3);
    });

    it("treats an explicit quantity of 0 as no work, flagged for review", async () => {
        setup(lines(0, 12), sixHourDays);
        const [stage] = await getEstimatePhasesAction(PROJECT_ID);
        // The old path counted quantity 0 as 1 and invented a two day stage.
        expect(stage).toMatchObject({ name: "Tiling", calculatedDays: 0, manualDays: null, manhours: 0, needsReview: true });
    });

    it("still treats a missing quantity as one", async () => {
        setup(lines(null, 16), sixHourDays);
        const [stage] = await getEstimatePhasesAction(PROJECT_ID);
        expect(stage.calculatedDays).toBe(3);
        expect(stage.needsReview).toBeUndefined();
    });

    it("matches what the planner suggests on open for the same estimate", async () => {
        const estimateLines = lines(2, 10);
        setup(estimateLines, sixHourDays);
        const regenerated = await getEstimatePhasesAction(PROJECT_ID);
        expect(regenerated).toEqual(estimateSuggestedPhases({ estimate_lines: estimateLines }, 5, MONDAY, sixHourDays));
    });

    it("refuses an unreadable saved calendar instead of falling back to eight-hour days", async () => {
        setup(lines(1, 24), { version: 3 });
        await expect(getEstimatePhasesAction(PROJECT_ID)).rejects.toThrow("working days");
    });

    it("still offers placeholder stages when no line has labour hours", async () => {
        setup([{ trade_section: "Drawing items", quantity: 4, estimate_line_components: [] }]);
        const [stage] = await getEstimatePhasesAction(PROJECT_ID);
        expect(stage).toMatchObject({ name: "Drawing items", calculatedDays: 5, manhours: 0 });
    });
});
