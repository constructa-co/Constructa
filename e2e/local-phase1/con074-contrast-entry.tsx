/**
 * CON-074 browser contrast leg: actual DashboardClient (selected This Month +
 * List pills) and EstimateClient (sticky estimate total bar) under the real
 * ThemeProvider, compiled Tailwind, and CSS modules. Synthetic data only;
 * transports refused.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../../src/lib/theme-context";
import DashboardClient from "../../src/app/dashboard/dashboard-client";
import EstimateClient from "../../src/app/dashboard/projects/costs/estimate-client";
import type { Estimate } from "../../src/app/dashboard/projects/costs/types";
import type { EstimatingServer } from "../../src/lib/simple-estimate";

type Theme = "system-c" | "dark";

export interface LocalCon074ContrastFixture {
    calls: string[];
    pathname: string;
    searchParams: Record<string, string>;
    router: { push: (href: string) => void; refresh: () => void };
}

declare global {
    interface Window {
        __con074ContrastOptions?: { theme: Theme; region?: "both" | "pipeline" | "estimate" };
        __con074ContrastLocal: LocalCon074ContrastFixture;
    }
}

const memoryStorage = (): Storage => {
    const values = new Map<string, string>();
    return {
        get length() { return values.size; },
        clear: () => values.clear(),
        key: (index: number) => [...values.keys()][index] ?? null,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(String(key), String(value)); },
        removeItem: (key: string) => { values.delete(key); },
    };
};
Object.defineProperty(window, "localStorage", { value: memoryStorage() });
Object.defineProperty(window, "sessionStorage", { value: memoryStorage() });

const options = window.__con074ContrastOptions ?? { theme: "system-c" as Theme, region: "both" as const };
const region = options.region ?? "both";

const fixture: LocalCon074ContrastFixture = {
    calls: [],
    pathname: "/dashboard",
    searchParams: {},
    router: {
        push: href => { fixture.calls.push(`router.push:${href}`); },
        refresh: () => { fixture.calls.push("router.refresh"); },
    },
};
window.__con074ContrastLocal = fixture;

const PROJECT_ID = "local-con074-job";
const ESTIMATE_ID = "local-con074-estimate";

const now = new Date().toISOString();
const projects = [{
    id: PROJECT_ID,
    name: "TEST DATA - Block driveway",
    client_name: "TEST DATA - Synthetic client",
    status: "Lead",
    project_type: "Driveway",
    created_at: now,
    is_archived: false,
}];

const estimates: Estimate[] = [{
    id: ESTIMATE_ID,
    project_id: PROJECT_ID,
    version_name: "Estimate v1",
    prelims_pct: 10,
    overhead_pct: 10,
    risk_pct: 5,
    profit_pct: 15,
    discount_pct: 0,
    discount_reason: "",
    total_cost: 1250,
    is_active: true,
    estimate_lines: [{
        id: "local-con074-line",
        estimate_id: ESTIMATE_ID,
        description: "Block paving",
        quantity: 25,
        unit: "m²",
        unit_rate: 50,
        line_total: 1250,
        trade_section: "General",
        line_type: "general",
        pricing_mode: "simple",
        estimate_line_components: [],
    }],
}];

const refuseSimple = (name: string) => async () => {
    fixture.calls.push(`REFUSED.simple:${name}`);
    return { ok: false as const, success: false as const, error: "Local CON-074 fixture: price saves excluded." };
};
const server = {
    saveLine: refuseSimple("saveLine"),
    updateLine: refuseSimple("updateLine"),
    deleteLine: refuseSimple("deleteLine"),
    saveAdjustments: refuseSimple("saveAdjustments"),
} as unknown as EstimatingServer;

const buildUpLocal = {
    actionCalls: [] as { name: string; args: unknown[] }[],
    script: { addComponent: [] as Array<"ack" | "refuse">, applyRate: [] as Array<"refuse"> },
    async answer(name: string, _args: unknown[]) {
        throw new Error(`Local CON-074 fixture does not answer ${name}`);
    },
};
(window as unknown as { __buildUpLocal: typeof buildUpLocal }).__buildUpLocal = buildUpLocal;

createRoot(document.getElementById("app")!).render(
    <ThemeProvider initialTheme={options.theme}>
        <div className="space-y-10 p-4">
            {(region === "both" || region === "pipeline") && (
                <section data-con074-region="pipeline" aria-label="Pipeline contrast fixture">
                    <DashboardClient
                        projects={projects}
                        financials={{ [PROJECT_ID]: 1250 }}
                        companyName="TEST DATA - Example Builders"
                        metrics={{
                            totalPipelineValue: 1250,
                            proposalsSent: 0,
                            wonThisMonth: 0,
                            activeJobs: 0,
                            winRate: 0,
                            winRateSampleSize: 0,
                            totalRevenueSigned: 0,
                        }}
                    />
                </section>
            )}
            {(region === "both" || region === "estimate") && (
                <section data-con074-region="estimate" aria-label="Estimate total bar contrast fixture">
                    <EstimateClient
                        estimates={estimates}
                        project={{
                            id: PROJECT_ID,
                            name: "TEST DATA - Block driveway",
                            client_name: "TEST DATA - Synthetic client",
                            brief_scope: "Replace driveway with block paving.",
                        }}
                        server={server}
                        loadAdvancedData={async () => ({
                            ok: true,
                            data: { orgId: "local-con074-org", costLibrary: [], rateBuildups: [], labourRates: [], preferredTrades: [] },
                        })}
                    />
                </section>
            )}
        </div>
    </ThemeProvider>,
);