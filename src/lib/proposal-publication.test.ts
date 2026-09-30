import { describe, expect, it } from "vitest";
import {
    assertProposalPublicationIsClientSafe,
    buildProposalPublicationSnapshot,
    canonicalProposalPublicationJson,
    hashProposalAccessToken,
    hashProposalPublication,
    type BuildProposalPublicationInput,
} from "./proposal-publication";

const input: BuildProposalPublicationInput = {
    publicationId: "11111111-1111-4111-8111-111111111111",
    versionNumber: 2,
    sentAt: "2026-09-30T10:00:00.000Z",
    validityDays: 14,
    responseMode: "acknowledgement",
    vatRate: 20,
    project: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "14 Example Street",
        client_name: "Alex Client",
        site_address: "14 Example Street, London",
        scope_text: "Construct the approved rear extension.",
        exclusions_text: "Planning fees",
        clarifications_text: "Working hours as agreed",
        payment_schedule: [{ stage: "Deposit", percentage: 10 }],
        programme_phases: [{ name: "Groundworks", duration_days: 10 }],
    },
    profile: {
        company_name: "Example Construction Ltd",
        years_trading: 12,
    },
    estimate: {
        id: "33333333-3333-4333-8333-333333333333",
        version_name: "Estimate v2",
        overhead_pct: 10,
        risk_pct: 5,
        profit_pct: 15,
        prelims_pct: 0,
        discount_pct: 0,
        estimate_lines: [
            {
                id: "line-1",
                trade_section: "Groundworks",
                description: "Foundations",
                quantity: 1,
                unit: "sum",
                line_total: 10000,
            },
            {
                id: "line-2",
                trade_section: "Preliminaries",
                description: "Site setup",
                quantity: 1,
                unit: "sum",
                line_total: 1000,
            },
        ],
    },
    termsProfileVersion: "phase1-standard-v1",
    resolvedTerms: [{ title: "Payment", body: "Payments are due as scheduled." }],
};

describe("proposal publication snapshot", () => {
    it("freezes canonical money, dates, programme and terms without internal markup fields", () => {
        const snapshot = buildProposalPublicationSnapshot(input);

        expect(snapshot.publication.expires_at).toBe("2026-10-14T10:00:00.000Z");
        expect(snapshot.commercial.contract_sum_ex_vat).toBe(14610.75);
        expect(snapshot.commercial.vat_amount).toBe(2922.15);
        expect(snapshot.commercial.contract_sum_inc_vat).toBe(17532.9);
        expect(snapshot.commercial.fee_items.reduce((sum, item) => sum + item.amount_ex_vat, 0)).toBe(14610.75);
        expect(snapshot.programme).toEqual([{
            id: null,
            name: "Groundworks",
            duration_days: 10,
            duration_unit: "Days",
            start_offset_days: 0,
            start_date: null,
        }]);
        expect(snapshot.terms.clauses[0].title).toBe("Payment");

        const encoded = JSON.stringify(snapshot);
        expect(encoded).not.toContain("overhead_pct");
        expect(encoded).not.toContain("risk_pct");
        expect(encoded).not.toContain("profit_pct");
        expect(encoded).not.toContain("line_total");
        expect(encoded).not.toContain("unit_rate");
    });

    it("uses percentage preliminaries when there is no explicit preliminaries line", () => {
        const snapshot = buildProposalPublicationSnapshot({
            ...input,
            vatRate: 0,
            estimate: {
                ...input.estimate,
                prelims_pct: 10,
                overhead_pct: 0,
                risk_pct: 0,
                profit_pct: 0,
                estimate_lines: [input.estimate.estimate_lines[0]],
            },
        });

        expect(snapshot.commercial.contract_sum_ex_vat).toBe(11000);
        expect(snapshot.commercial.fee_items).toHaveLength(2);
        expect(snapshot.commercial.fee_items[1]).toMatchObject({
            trade_section: "Preliminaries",
            amount_ex_vat: 1000,
        });
    });

    it("rejects forbidden internal keys anywhere in a public payload", () => {
        expect(() => assertProposalPublicationIsClientSafe({ nested: { profit_pct: 15 } }))
            .toThrow("forbidden field: profit_pct");
    });

    it("whitelists programme and payment fields instead of copying arbitrary JSON", () => {
        const snapshot = buildProposalPublicationSnapshot({
            ...input,
            project: {
                ...input.project,
                programme_phases: [{
                    name: "Build",
                    calculatedDays: 5,
                    internal_note: "must not publish",
                    profit_pct: 20,
                }],
                payment_schedule: [{
                    id: "deposit",
                    stage: "Deposit",
                    percentage: 10,
                    amount: 1500,
                    supplier: "must not publish",
                }],
            },
        });

        const encoded = JSON.stringify(snapshot);
        expect(encoded).not.toContain("internal_note");
        expect(encoded).not.toContain("profit_pct");
        expect(encoded).not.toContain("supplier");
        expect(snapshot.programme[0].duration_days).toBe(5);
        expect(snapshot.commercial.payment_schedule[0].amount).toBe(1500);
    });

    it("hashes canonical JSON deterministically regardless of object key insertion order", async () => {
        const snapshot = buildProposalPublicationSnapshot(input);
        const reordered = JSON.parse(canonicalProposalPublicationJson(snapshot));

        await expect(hashProposalPublication(snapshot)).resolves.toBe(await hashProposalPublication(reordered));
        await expect(hashProposalPublication(snapshot)).resolves.toMatch(/^[a-f0-9]{64}$/);
    });

    it("hashes a 32-byte access token and rejects weak token shapes", async () => {
        const token = "ab".repeat(32);
        await expect(hashProposalAccessToken(token)).resolves.toMatch(/^[a-f0-9]{64}$/);
        await expect(hashProposalAccessToken("predictable-token")).rejects.toThrow("32 random bytes");
    });

    it("fails closed without a positive canonical value or resolved terms", () => {
        expect(() => buildProposalPublicationSnapshot({
            ...input,
            estimate: { ...input.estimate, estimate_lines: [] },
        })).toThrow("positive canonical contract sum");

        expect(() => buildProposalPublicationSnapshot({ ...input, resolvedTerms: [] }))
            .toThrow("Resolved proposal terms are required");
    });
});
