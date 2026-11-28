/**
 * D124 brand visual only: ReviewSendClient under ThemeProvider + compiled Tailwind.
 * Same MOCK transport as proposal-view; default proposal-view scenario unchanged.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../../src/lib/theme-context";
import ReviewSendClient, { type ReviewServer } from "../../src/app/dashboard/projects/proposal/review-send-client";
import type { ReviewContext } from "../../src/lib/proposal-review";

interface Options {
    locked?: boolean;
    noEstimate?: boolean;
    theme?: string;
    emptyTerms?: boolean;
    noPayments?: boolean;
    pendingSave?: boolean;
    longTerms?: boolean;
}
interface Fixture {
    calls: string[];
    lockReason: string | null;
    setLock: (reason: string | null) => void;
    refuseSave: () => void;
    termBody: string | null;
    router: { push: (href: string) => void; refresh: () => void };
}
declare global {
    interface Window { __documentViewOptions?: Options; __documentViewLocal: Fixture }
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

const options = window.__documentViewOptions ?? {};
const theme = options.theme === "system-c" ? "system-c" : "dark";
const termBody = options.longTerms
    ? `${Array.from({ length: 100 }, (_, index) => `SYNTHETIC TEST LINE ${index + 1}. Not legal wording.`).join("\n")}\nEND OF SYNTHETIC TERMS TEST`
    : null;
const context: ReviewContext = {
    project: {
        id: "local-d124-proposal-job",
        name: "TEST DATA - Garage conversion",
        client_name: "Synthetic client",
        brief_scope: "Existing synthetic scope.",
        payment_schedule: options.noPayments
            ? []
            : [{ id: "payment-1", stage: "Completion", description: "Synthetic handover", percentage: 100 }],
        ...(options.emptyTerms ? { tc_overrides: [] } : {}),
        ...(termBody ? { tc_overrides: [{ clause_number: 1, title: "Synthetic test clause", body: termBody }] } : {}),
        programme_phases: [{ programmeIntent: "omit", intent_version: 1 }],
        start_date: null,
    },
    profile: { company_name: "TEST DATA - Building Ltd", phone: "01632 960000" },
    estimate: options.noEstimate
        ? null
        : {
            id: "local-d124-estimate",
            version_name: "Estimate v1",
            prelims_pct: 0,
            overhead_pct: 0,
            risk_pct: 0,
            profit_pct: 0,
            discount_pct: 0,
            estimate_lines: [{
                id: "line-1",
                trade_section: "General",
                description: "Synthetic supplied work",
                quantity: 1,
                unit: "item",
                line_total: 480,
            }],
        },
    nextVersion: 1,
};

const root = createRoot(document.getElementById("app")!);
let resolveSave: ((result: Awaited<ReturnType<ReviewServer["save"]>>) => void) | undefined;

const fixture: Fixture = {
    calls: [],
    lockReason: options.locked ? "Local fixture: protected job is locked." : null,
    setLock(reason) { fixture.lockReason = reason; render(); },
    refuseSave() { resolveSave?.({ success: false, error: "Synthetic save refused. Exact draft retained." }); },
    termBody,
    router: { push: () => blocked("router.push"), refresh: () => blocked("router.refresh") },
};
window.__documentViewLocal = fixture;

function blocked(name: string): never {
    fixture.calls.push(name);
    throw new Error(`Real actions/navigation excluded from D124 proposal fixture: ${name}`);
}

const server: ReviewServer = {
    save: async () => {
        if (!options.pendingSave) return blocked("save");
        fixture.calls.push("mock.save");
        return new Promise(resolve => { resolveSave = resolve; });
    },
    ask: async () => blocked("ask"),
    publish: async () => blocked("publish"),
    retry: async () => blocked("retry"),
    upload: async () => blocked("upload"),
    loadPublication: async () => blocked("loadPublication"),
};

function render() {
    root.render(
        <ThemeProvider initialTheme={theme}>
            <div
                data-d124-synth-banner
                className="bg-[#0d0d0d] text-[#c9efcf] text-xs font-semibold px-3 py-2 border-b border-slate-700"
            >
                SYNTH_COMPONENT_VISUAL — ReviewSendClient (D124 Tailwind fixture); not authenticated route coverage
            </div>
            <ReviewSendClient
                context={context}
                caseStudies={[]}
                lockReason={fixture.lockReason}
                estimateIssue={null}
                publications={[]}
                server={server}
                now="2026-10-23T12:00:00.000Z"
            />
        </ThemeProvider>,
    );
}
render();