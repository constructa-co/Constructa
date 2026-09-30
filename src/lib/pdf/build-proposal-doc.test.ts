import { describe, expect, it } from "vitest";
import type { ProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { proposalSnapshotToPdfProps, scopeTextToBullets } from "./build-proposal-doc";

const snapshot: ProposalPublicationSnapshot = {
    schema_version: 1,
    publication: {
        id: "11111111-1111-4111-8111-111111111111",
        version_number: 3,
        sent_at: "2026-09-30T10:00:00.000Z",
        expires_at: "2026-10-30T10:00:00.000Z",
        validity_days: 30,
        response_mode: "acknowledgement",
    },
    project: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Example Extension",
        project_type: "Extension",
        client_name: "Alex Client",
        client_address: "1 Example Road",
        site_address: "1 Example Road",
        start_date: "2026-11-01",
    },
    contractor: {
        company_name: "Example Builder Ltd",
        logo_url: null,
        phone: null,
        website: null,
        accreditations: null,
        capability_statement: null,
        years_trading: null,
        specialisms: null,
        insurance_details: null,
        pdf_theme: "navy-gold",
    },
    content: {
        introduction: "Thank you for the opportunity.",
        scope: "Excavate foundations.\nBuild the extension.",
        exclusions: "Planning fees",
        clarifications: "Working hours as agreed",
        closing_statement: "We look forward to working with you.",
    },
    commercial: {
        currency: "GBP",
        estimate_id: "33333333-3333-4333-8333-333333333333",
        estimate_version_name: "Estimate v3",
        contract_sum_ex_vat: 12000,
        vat_rate: 20,
        vat_amount: 2400,
        contract_sum_inc_vat: 14400,
        fee_items: [{
            id: "line-1",
            trade_section: "Groundworks",
            description: "Foundations",
            quantity: 2,
            unit: "item",
            amount_ex_vat: 12000,
        }],
        payment_schedule: [{
            id: "deposit",
            stage: "Deposit",
            description: "On instruction",
            percentage: 10,
            amount: null,
        }],
    },
    programme: [{
        id: "phase-1",
        name: "Build",
        duration_days: 28,
        duration_unit: "Days",
        start_offset_days: 0,
        start_date: "2026-11-01",
    }],
    terms: {
        profile_version: "phase1-standard-v1",
        clauses: [{ title: "Payment", body: "Payment is due as scheduled." }],
    },
};

describe("published proposal PDF adapter", () => {
    it("maps only the immutable snapshot into the legacy renderer shape", () => {
        const props = proposalSnapshotToPdfProps(snapshot, "ab".repeat(32));

        expect(props.project).toMatchObject({
            id: snapshot.project.id,
            potential_value: 12000,
            proposal_version_number: 3,
            response_mode: "acknowledgement",
            proposal_sent_at: snapshot.publication.sent_at,
            proposal_snapshot_hash: "ab".repeat(32),
        });
        expect(props.profile.pdf_theme).toBe("navy-gold");
        expect(props.estimates[0].estimate_lines[0]).toMatchObject({
            description: "Foundations",
            quantity: 2,
            unit_rate: 6000,
            line_total: 12000,
        });
        expect(props.project.tc_overrides).toEqual([{
            clause_number: 1,
            title: "Payment",
            body: "Payment is due as scheduled.",
        }]);
    });

    it("derives scope bullets deterministically without an AI call", () => {
        expect(scopeTextToBullets("- Excavate foundations\n- Build walls")).toEqual([
            "Excavate foundations",
            "Build walls",
        ]);
        expect(scopeTextToBullets("Excavate foundations. Build walls.")).toEqual([
            "Excavate foundations.",
            "Build walls.",
        ]);
    });
});
