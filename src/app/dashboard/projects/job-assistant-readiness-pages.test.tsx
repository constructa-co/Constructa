import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// CQ-2210: the three real pages over the real activation point and ledger, with
// only the database answers and the page clients stood in for.
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), createAdminClient: vi.fn(), redirect: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useId: () => "panel-test", useSyncExternalStore: (_subscribe: unknown, read: () => unknown) => read() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/server/pricing-experience", () => ({ loadPricingExperienceSource: vi.fn(async () => null) }));
vi.mock("@/components/dashboard-route-shell", () => ({ default: function Shell() { return null; } }));
vi.mock("@/components/project-navbar", () => ({ default: function Nav() { return null; } }));
vi.mock("@/components/project-entry", () => ({ default: function Entry() { return null; } }));
vi.mock("./brief/brief-client", () => ({ default: function BriefClient() { return null; } }));
vi.mock("./costs/estimate-client", () => ({ default: function EstimateClient() { return null; } }));
vi.mock("./schedule/simple-programme-client", () => ({ default: function SimpleProgrammeClient() { return null; } }));

import BriefPage from "./brief/page";
import EstimatingPage from "./costs/page";
import SchedulePage from "./schedule/page";
import BriefConversationPanel from "@/components/brief-conversation-panel";
import PlanningConversationPanel from "@/components/planning-conversation-panel";
import PricingAssistantPanel from "@/components/pricing-assistant-panel";
import { createBriefConversation } from "@/lib/brief-conversation";
import { createPlanningConversation } from "@/lib/planning-conversation";
import { createPricingAssistantSession } from "@/lib/pricing-assistant-session";
import { workspaceStyles } from "@/lib/workspace-styles";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROJECT = "11111111-1111-4111-8111-111111111111";
const QA_URL = "https://umqtzfsnyoofmgfbnrgv.supabase.co";
const DISABLED = { enabled: false, max_attempt_pence: null, max_per_job_pence: null, max_monthly_pence: null };
const READY = { enabled: true, max_attempt_pence: 10, max_per_job_pence: 10, max_monthly_pence: 2000 };

type Props = Record<string, unknown>;
function pageDatabase(ownerId: string) {
    const row = { id: PROJECT, user_id: ownerId, name: "Job" };
    mocks.createClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: { id: USER } } }) },
        from: (table: string) => {
            const builder = {
                select: (columns?: string) => { if (table === "projects" && columns && columns !== "*" && columns !== "id, name") builder.columns = columns; return builder; },
                columns: "*", eq: () => builder, order: () => builder,
                single: async () => ({ data: builder.columns === "*" || builder.columns.split(/,\s*/).includes("user_id") ? row : { id: PROJECT, name: "Job" }, error: null }),
                then: (resolve: (value: unknown) => unknown) => resolve({ data: table === "projects" ? [row] : [], error: null }),
            };
            return builder;
        },
    });
}
function settings(row: unknown) {
    const read = vi.fn(async () => ({ data: row, error: null }));
    mocks.createAdminClient.mockImplementation(() => ({ rpc: vi.fn(), from: () => ({ select: () => ({ eq: () => ({ maybeSingle: read }) }) }) }));
    return read;
}
const clientProps = (page: unknown) => ((page as ReactElement<{ children: ReactElement<Props> }>).props.children).props;
const PAGES: [string, (input: never) => Promise<unknown>, string][] = [
    ["Brief", BriefPage as never, "briefAssistant"],
    ["Estimating", EstimatingPage as never, "pricingAssistant"],
    ["Programme", SchedulePage as never, "planningAssistant"],
];
const open = (page: (input: never) => Promise<unknown>) => page({ searchParams: Promise.resolve({ projectId: PROJECT }) } as never);

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", QA_URL);
    vi.stubEnv("DEEPSEEK_API_KEY", "test-placeholder-not-a-key");
    vi.stubEnv("CONSTRUCTA_AI_DISABLED", "");
});
afterEach(() => { vi.unstubAllEnvs(); });

describe.each(PAGES)("CQ-2210 %s page readiness", (_name, page, prop) => {
    it("tells the owner which prerequisite is missing when the ledger refuses the QA approval", async () => {
        pageDatabase(USER); settings(DISABLED);
        expect(clientProps(await open(page))).toMatchObject({ [`${prop}Enabled`]: false, [`${prop}OffReason`]: "ledger_disabled" });
    });

    it("gives no reason to a viewer who does not own the job, and no more availability", async () => {
        pageDatabase(OTHER); settings(DISABLED);
        const props = clientProps(await open(page));
        expect(props).toMatchObject({ [`${prop}Enabled`]: false });
        expect(props[`${prop}OffReason`]).toBeNull();
    });

    it("offers the assistant with no reason once every prerequisite is met", async () => {
        pageDatabase(USER); settings(READY);
        expect(clientProps(await open(page))).toMatchObject({ [`${prop}Enabled`]: true, [`${prop}OffReason`]: null });
    });

    it("leaves Production as it was: off, unexplained, no ledger read", async () => {
        vi.stubEnv("VERCEL_ENV", "production");
        pageDatabase(USER); const read = settings(READY);
        expect(clientProps(await open(page))).toMatchObject({ [`${prop}Enabled`]: false, [`${prop}OffReason`]: "not_approved" });
        expect(read).not.toHaveBeenCalled();
    });
});

describe("CQ-2210 panels", () => {
    const s = workspaceStyles(true);
    const brief = (generate?: never) => createBriefConversation(() => ({ project: { id: "job", saved: { work: "Replace the roof.", clientType: "domestic", trades: [] } as never }, hasOpenWork: false }), generate);
    const planning = (generate?: never) => createPlanningConversation(() => ({ project: { id: "job", name: "Job", start_date: "2026-11-02", programme_phases: [] }, hasOpenWork: false }), generate);
    const pricing = (generate?: never) => createPricingAssistantSession(() => ({ project: { id: "job", brief_scope: "x" }, estimate: null, hasOpenWork: false }), () => ({ ok: true }), generate);
    const PANELS: [string, (offReason?: never, generate?: never) => ReactElement][] = [
        ["Brief", (offReason, generate) => BriefConversationPanel({ session: brief(generate), blocked: false, offReason, s }) as ReactElement],
        ["Planning", (offReason, generate) => PlanningConversationPanel({ session: planning(generate), blocked: false, offReason, s }) as ReactElement],
        ["Pricing", (offReason, generate) => PricingAssistantPanel({ session: pricing(generate), blocked: false, offReason }) as ReactElement],
    ];

    it.each(PANELS)("%s names the missing prerequisite in the visible summary and the open panel", (_name, view) => {
        const html = renderToStaticMarkup(view("ledger_disabled" as never));
        expect(html).toMatch(/<summary[^>]*>.*Not enabled: usage ledger switched off.*<\/summary>/s);
        expect(html).toContain("The usage ledger is installed but switched off.");
        expect(html).not.toContain("<form");
    });

    it.each(PANELS)("%s keeps today's words for no reason and for no approval", (_name, view) => {
        const plain = renderToStaticMarkup(view());
        expect(renderToStaticMarkup(view("not_approved" as never))).toBe(plain);
        expect(plain).toContain("Not enabled");
        expect(plain).not.toMatch(/ledger|provider|Not enabled:/);
    });

    it.each(PANELS)("%s ignores a reason while the assistant is available", (_name, view) => {
        const html = renderToStaticMarkup(view("ledger_disabled" as never, vi.fn() as never));
        expect(html).toContain("Review before using");
        expect(html).not.toMatch(/ledger|Not enabled/);
    });
});
