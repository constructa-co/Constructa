import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../../src/lib/theme-context";
import ReviewSendClient, { type ReviewServer } from "../../src/app/dashboard/projects/proposal/review-send-client";
import type { ReviewContext } from "../../src/lib/proposal-review";

/**
 * Styled finished-document reader over the actual review client.
 *
 * The actual ThemeProvider supplies the theme, as the dashboard layout does
 * from the saved profile, so the actual workspace CSS module colours the
 * actual native dialog and reader. Data, actions and router are synthetic
 * and refuse; nothing is saved, sent, downloaded or navigated.
 */
interface Options { theme?: "system-c" | "dark"; longTerms?: boolean }
interface Fixture {
    calls: string[];
    termBody: string | null;
    router: { push: (href: string) => void; refresh: () => void };
}
declare global {
    interface Window { __readerStyledOptions?: Options; __readerStyledLocal: Fixture }
}

// about:blank has no storage origin. The provider only reads a stored theme
// here; an empty in-memory store keeps the initial theme. Not storage proof.
const storedValues = new Map<string, string>();
Object.defineProperty(window, "localStorage", { value: {
    get length() { return storedValues.size; },
    clear: () => storedValues.clear(),
    key: (index: number) => [...storedValues.keys()][index] ?? null,
    getItem: (key: string) => storedValues.get(key) ?? null,
    setItem: (key: string, value: string) => { storedValues.set(String(key), String(value)); },
    removeItem: (key: string) => { storedValues.delete(key); },
} satisfies Storage });

const options = window.__readerStyledOptions ?? {};
const termBody = options.longTerms ? Array.from({ length: 120 }, (_, index) => `SYNTHETIC STYLED READER LINE ${index + 1}. Not legal wording.`).join("\n") + "\nEND OF SYNTHETIC STYLED TERMS" : null;
const context: ReviewContext = {
    project: {
        id: "local-reader-styled-job",
        name: "TEST DATA - Styled reader extension",
        client_name: "Synthetic client",
        brief_scope: "Existing synthetic scope.",
        payment_schedule: [{ id: "payment-1", stage: "Completion", description: "Synthetic handover", percentage: 100 }],
        ...(termBody ? { tc_overrides: [{ clause_number: 1, title: "Synthetic test clause", body: termBody }] } : {}),
        programme_phases: [{ programmeIntent: "omit", intent_version: 1 }],
        start_date: null,
    },
    profile: { company_name: "TEST DATA - Building Ltd", phone: "01632 960000" },
    estimate: {
        id: "local-reader-styled-estimate", version_name: "Estimate v1",
        prelims_pct: 0, overhead_pct: 0, risk_pct: 0, profit_pct: 0, discount_pct: 0,
        estimate_lines: [{ id: "line-1", trade_section: "General", description: "Synthetic supplied work", quantity: 1, unit: "item", line_total: 480 }],
    },
    nextVersion: 1,
};
const fixture: Fixture = {
    calls: [],
    termBody,
    router: { push: () => blocked("router.push"), refresh: () => blocked("router.refresh") },
};
window.__readerStyledLocal = fixture;
function blocked(name: string): never {
    fixture.calls.push(name);
    throw new Error(`Real actions/navigation excluded from styled reader fixture: ${name}`);
}
const server: ReviewServer = {
    save: async () => blocked("save"), ask: async () => blocked("ask"),
    publish: async () => blocked("publish"), retry: async () => blocked("retry"),
    upload: async () => blocked("upload"), loadPublication: async () => blocked("loadPublication"),
};
createRoot(document.getElementById("app")!).render(
    <ThemeProvider initialTheme={options.theme ?? "system-c"}>
        <ReviewSendClient context={context} caseStudies={[]} lockReason={null}
            estimateIssue={null} publications={[]} server={server} now="2026-10-24T12:00:00.000Z" />
    </ThemeProvider>,
);
