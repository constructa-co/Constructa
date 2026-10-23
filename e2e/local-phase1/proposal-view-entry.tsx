import React from "react";
import { createRoot } from "react-dom/client";
import ReviewSendClient, { type ReviewServer } from "../../src/app/dashboard/projects/proposal/review-send-client";
import type { ReviewContext } from "../../src/lib/proposal-review";

interface Options { locked?: boolean; noEstimate?: boolean; theme?: string; emptyTerms?: boolean; noPayments?: boolean; pendingSave?: boolean }
interface Fixture {
    calls: string[];
    lockReason: string | null;
    setLock: (reason: string | null) => void;
    refuseSave: () => void;
    router: { push: (href: string) => void; refresh: () => void };
}
declare global {
    interface Window { __documentViewOptions?: Options; __documentViewLocal: Fixture }
}

const options = window.__documentViewOptions ?? {};
const context: ReviewContext = {
    project: {
        id: "local-document-view-job",
        name: "TEST DATA - Garage conversion",
        client_name: "Synthetic client",
        brief_scope: "Existing synthetic scope.",
        payment_schedule: options.noPayments ? [] : [{ id: "payment-1", stage: "Completion", description: "Synthetic handover", percentage: 100 }],
        ...(options.emptyTerms ? { tc_overrides: [] } : {}),
        programme_phases: [{ programmeIntent: "omit", intent_version: 1 }],
        start_date: null,
    },
    profile: { company_name: "TEST DATA - Building Ltd", phone: "01632 960000" },
    estimate: options.noEstimate ? null : {
        id: "local-document-estimate", version_name: "Estimate v1",
        prelims_pct: 0, overhead_pct: 0, risk_pct: 0, profit_pct: 0, discount_pct: 0,
        estimate_lines: [{ id: "line-1", trade_section: "General", description: "Synthetic supplied work", quantity: 1, unit: "item", line_total: 480 }],
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
    router: { push: () => blocked("router.push"), refresh: () => blocked("router.refresh") },
};
window.__documentViewLocal = fixture;
function blocked(name: string): never {
    fixture.calls.push(name);
    throw new Error(`Real actions/navigation excluded from document-view fixture: ${name}`);
}
const server: ReviewServer = {
    save: async () => {
        if (!options.pendingSave) return blocked("save");
        fixture.calls.push("mock.save");
        return new Promise(resolve => { resolveSave = resolve; });
    }, ask: async () => blocked("ask"),
    publish: async () => blocked("publish"), retry: async () => blocked("retry"),
    upload: async () => blocked("upload"), loadPublication: async () => blocked("loadPublication"),
};
function render() {
    root.render(<ReviewSendClient context={context} caseStudies={[]} lockReason={fixture.lockReason}
        estimateIssue={null} publications={[]} server={server} now="2026-10-23T12:00:00.000Z" />);
}
render();
