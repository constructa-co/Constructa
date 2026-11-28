/**
 * D124 brand visual: actual HomeClient under ThemeProvider + compiled Tailwind.
 * Synthetic TEST DATA only; no Supabase, auth, or persistence.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../../src/lib/theme-context";
import HomeClient from "../../src/app/dashboard/home/home-client";

type Theme = "system-c" | "dark";

export interface LocalD124BrandHomeFixture {
    calls: string[];
    router: { push: (href: string) => void; refresh: () => void };
}

declare global {
    interface Window {
        __d124BrandHomeOptions?: { theme: Theme };
        __d124BrandHomeLocal: LocalD124BrandHomeFixture;
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

const fixture: LocalD124BrandHomeFixture = {
    calls: [],
    router: {
        push: href => { fixture.calls.push(`router.push:${href}`); },
        refresh: () => { fixture.calls.push("router.refresh"); },
    },
};
window.__d124BrandHomeLocal = fixture;

const now = "2026-11-28T12:00:00.000Z";
const projectActive = {
    id: "local-d124-active",
    name: "TEST DATA - Bathroom refit",
    client_name: "TEST DATA - Synthetic client",
    status: "Active",
    potential_value: 18_000,
    proposal_status: "sent",
    proposal_sent_at: now,
    created_at: now,
    start_date: "2026-12-01",
    programme_phases: [{ name: "Strip out", manualDays: 5, startOffset: 0 }],
    validity_days: 30,
    is_archived: false,
};
const projectLead = {
    id: "local-d124-lead",
    name: "TEST DATA - Driveway",
    client_name: "TEST DATA - Synthetic client",
    status: "Lead",
    potential_value: 9_500,
    proposal_status: null,
    created_at: now,
    is_archived: false,
};

const estimates = [{
    project_id: projectActive.id,
    total_cost: 12_400,
    overhead_pct: 10,
    profit_pct: 15,
    risk_pct: 5,
    prelims_pct: 10,
    discount_pct: 0,
    is_active: true,
    estimate_lines: [
        { trade_section: "General", line_total: 10_000, line_type: "general" },
        { trade_section: "Preliminaries", line_total: 400, line_type: "prelims" },
    ],
}];

const options = window.__d124BrandHomeOptions ?? { theme: "dark" as Theme };

createRoot(document.getElementById("app")!).render(
    <ThemeProvider initialTheme={options.theme}>
        <div
            data-d124-synth-banner
            className="bg-[#0d0d0d] text-[#c9efcf] text-xs font-semibold px-3 py-2 border-b border-slate-700"
        >
            SYNTH_COMPONENT_VISUAL — HomeClient fixture; not authenticated route coverage
        </div>
        <HomeClient
            projects={[projectActive, projectLead]}
            profile={{ company_name: "TEST DATA - Example Builders Ltd", logo_url: null, onboarding_seen_at: now }}
            estimates={estimates}
            invoices={[]}
            variations={[]}
            changeEvents={[]}
            rfis={[]}
            ewns={[]}
            contractEvents={[]}
            contractObligations={[]}
            userId="local-d124-user"
        />
    </ThemeProvider>,
);