/**
 * Local offline fixture: default twelve standard terms in the actual proposal
 * review editor → confirmed mocked draft save → frozen snapshot/document →
 * real draft PDF.
 *
 * REAL ReviewSendClient, REAL snapshot/document/PDF builders. Simulated transport:
 *  - draft save records the exact ProposalDraftPayload and, on success, writes
 *    tc_overrides on the in-memory project the way saveProposalDraftAction would;
 *  - publish / retry / upload / history / AI are refused or recorded, never run;
 *  - Next routing is the fixture router (unused on this leg).
 *
 * No server, account, database, network or provider. Programme is deliberately
 * omitted. Publishing and send are outside this fixture.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import ReviewSendClient, { type ReviewServer } from "../../src/app/dashboard/projects/proposal/review-send-client";
import type { ProposalDraftPayload, ReviewContext, ReviewProject } from "../../src/lib/proposal-review";

export interface LocalTermsFlowFixture {
    project: ReviewProject;
    saves: ProposalDraftPayload[];
    proposalDraftSaves: number;
    publicationsAttempted: number;
    nextSave: "success" | "refused";
    router: { push: (href: string) => void; refresh: () => void };
}

declare global {
    interface Window {
        __termsFlowLocal: LocalTermsFlowFixture;
    }
}

const PROJECT_ID = "local-terms-flow-job";
const FIXED_NOW = "2026-10-23T12:00:00.000Z";

const ESTIMATE = {
    id: "est-local-terms-flow",
    version_name: "Estimate v1",
    prelims_pct: 0,
    overhead_pct: 0,
    risk_pct: 0,
    profit_pct: 0,
    discount_pct: 0,
    estimate_lines: [
        { id: "line-1", trade_section: "General", description: "Garage conversion, supplied and fitted", quantity: 1, unit: "item", line_total: 480 },
    ],
};

const PROFILE = {
    company_name: "Example Building Ltd",
    phone: "01632 960000",
    capability_statement: "A local firm doing careful work.",
};

const initialProject: ReviewProject = {
    id: PROJECT_ID,
    name: "Garage conversion",
    client_name: "Synthetic client",
    brief_scope: "Take out the garage door, fit a window and finish the room as a study.",
    scope_text: "Convert the garage into a study with a new window and finished interior.",
    payment_schedule: [{ id: "pay-1", stage: "On completion", description: "When the room is handed over", percentage: 100 }],
    programme_phases: [{ programmeIntent: "omit", intent_version: 1 }],
    start_date: null,
    validity_days: 30,
    client_email: "labelled-fixture-client@example.test",
    tc_overrides: null,
};

const root = createRoot(document.getElementById("app")!);

const fixture: LocalTermsFlowFixture = {
    project: initialProject,
    saves: [],
    proposalDraftSaves: 0,
    publicationsAttempted: 0,
    nextSave: "success",
    router: {
        push: (href: string) => {
            throw new Error(`Local terms-flow fixture does not navigate: ${href}`);
        },
        refresh: () => undefined,
    },
};

window.__termsFlowLocal = fixture;

const server: ReviewServer = {
    save: async (payload) => {
        fixture.proposalDraftSaves += 1;
        fixture.saves.push(structuredClone(payload));
        if (fixture.nextSave === "refused") {
            fixture.nextSave = "success";
            return { success: false, error: "Local fixture: draft save not acknowledged." };
        }
        fixture.project = { ...fixture.project, tc_overrides: payload.terms };
        return { success: true };
    },
    ask: async () => {
        throw new Error("No AI transport in the fixture");
    },
    publish: async () => {
        fixture.publicationsAttempted += 1;
        return { success: false, error: "Local fixture: publishing is excluded." };
    },
    retry: async () => ({ success: false, error: "Local fixture: delivery retry is excluded." }),
    upload: async () => ({ error: "Local fixture: photo upload is excluded." }),
    loadPublication: async () => ({ success: false, error: "Local fixture: there are no published versions." }),
};

function render() {
    const context: ReviewContext = {
        project: fixture.project,
        profile: PROFILE,
        estimate: ESTIMATE,
        nextVersion: 1,
    };
    root.render(
        <ReviewSendClient
            context={context}
            caseStudies={[]}
            lockReason={null}
            estimateIssue={null}
            publications={[]}
            server={server}
            now={FIXED_NOW}
        />,
    );
}

render();
