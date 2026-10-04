import { describe, expect, it } from "vitest";
import {
    assertProposalPublicationIsClientSafe,
    buildProposalPublicationSnapshot,
    canonicalProposalPublicationJson,
    hashProposalAccessToken,
    hashProposalPublication,
    PROGRAMME_REQUIRED_ERROR,
    safeImageUrl,
    selectCaseStudies,
    type BuildProposalPublicationInput,
} from "./proposal-publication";
import { LEGACY_STARTER_PHASES } from "./programme-plan";
import { responseWording } from "./proposal-response";

const input: BuildProposalPublicationInput = {
    publicationId: "11111111-1111-4111-8111-111111111111",
    versionNumber: 2,
    sentAt: "2026-09-30T10:00:00.000Z",
    validityDays: 14,
    responseKind: "acknowledgement",
    vatRate: 20,
    project: {
        id: "22222222-2222-4222-8222-222222222222",
        name: "14 Example Street",
        client_name: "Alex Client",
        site_address: "14 Example Street, London",
        start_date: "2026-11-02",
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
        // The legacy timeline phase is ten calendar days from the project start.
        expect(snapshot.programme_plan).toMatchObject({
            start_date: "2026-11-02",
            end_date: "2026-11-11",
            working_days: 8,
            duration_label: "8 working days",
        });

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

    describe("programme", () => {
        const programmeProject = {
            ...input.project,
            start_date: "2026-10-12",
            programme_phases: [
                { name: "Strip out", calculatedDays: 5, manualDays: 5, startOffset: 0, manhours: 0 },
                { name: "First fix", calculatedDays: 10, manualDays: 10, startOffset: 7, manhours: 0 },
                { name: "Finishes", calculatedDays: 3, manualDays: 3, startOffset: 21, manhours: 0 },
            ],
        };

        it("freezes the canonical start, finish, duration and stages", () => {
            const snapshot = buildProposalPublicationSnapshot({ ...input, project: programmeProject });
            expect(snapshot.programme_plan).toEqual({
                basis: "mon_fri_working_days",
                start_date: "2026-10-12",
                end_date: "2026-11-04",
                working_days: 18,
                calendar_days: 24,
                duration_label: "18 working days",
                stages: [
                    { name: "Strip out", start_date: "2026-10-12", end_date: "2026-10-16", working_days: 5, offset_days: 0, span_days: 5 },
                    { name: "First fix", start_date: "2026-10-19", end_date: "2026-10-30", working_days: 10, offset_days: 7, span_days: 12 },
                    { name: "Finishes", start_date: "2026-11-02", end_date: "2026-11-04", working_days: 3, offset_days: 21, span_days: 3 },
                ],
            });
        });

        it("refuses to publish without a start date and a duration", () => {
            expect(() => buildProposalPublicationSnapshot({ ...input, project: { ...input.project, start_date: null, programme_phases: [{ name: "Build", calculatedDays: 5 }] } }))
                .toThrow(PROGRAMME_REQUIRED_ERROR);
            expect(() => buildProposalPublicationSnapshot({ ...input, project: { ...input.project, programme_phases: [] } }))
                .toThrow(PROGRAMME_REQUIRED_ERROR);
        });

        it("never publishes the untouched starter template as the contractor's programme", () => {
            expect(() => buildProposalPublicationSnapshot({
                ...input,
                project: {
                    ...input.project,
                    programme_phases: [],
                    gantt_phases: LEGACY_STARTER_PHASES.map((phase) => ({ ...phase, start_date: "2026-11-02" })),
                },
            })).toThrow(PROGRAMME_REQUIRED_ERROR);
        });

        it("builds a draft preview while the price or programme is still missing", () => {
            const snapshot = buildProposalPublicationSnapshot({
                ...input,
                project: { ...input.project, programme_phases: [] },
                estimate: { ...input.estimate, estimate_lines: [] },
            }, { allowIncomplete: true });
            expect(snapshot.programme_plan).toBeUndefined();
            expect(snapshot.commercial.contract_sum_ex_vat).toBe(0);
        });
    });

    describe("client response", () => {
        it("records acknowledgement with the statement the client is shown", () => {
            const snapshot = buildProposalPublicationSnapshot(input);
            expect(snapshot.publication.response_mode).toBe("acknowledgement");
            expect(snapshot.response).toEqual({
                kind: "acknowledgement",
                notice: responseWording("acknowledgement").notice,
            });
        });

        it("records a non-binding intention under the acknowledgement mode, so the database still refuses acceptance", () => {
            const snapshot = buildProposalPublicationSnapshot({ ...input, responseKind: "non_binding_intent" });
            expect(snapshot.publication.response_mode).toBe("acknowledgement");
            expect(snapshot.response?.kind).toBe("non_binding_intent");
            expect(snapshot.response?.notice).toContain("not binding");
            expect(snapshot.response?.notice).toContain("subject to a final contract");
        });

        it("cannot build a publication that asks for binding acceptance", () => {
            for (const kind of ["binding_acceptance", "accepted", "", undefined]) {
                expect(() => buildProposalPublicationSnapshot({ ...input, responseKind: kind as never }))
                    .toThrow("Choose how the client responds");
            }
        });
    });

    describe("brochure content", () => {
        const caseStudies = [
            { id: "cs-a", projectName: "Loft conversion", projectType: "Loft", contractValue: "42000", whatWeDelivered: "A new bedroom.", photos: ["https://cdn.example.test/a.jpg", "javascript:alert(1)"], internal_note: "x" },
            { id: "cs-b", projectName: "Kitchen refit", location: "Leeds" },
            { projectName: "  ", projectType: "Untitled" },
        ];

        it("includes only the case studies the contractor ticked, as written", () => {
            const snapshot = buildProposalPublicationSnapshot({
                ...input,
                profile: { ...input.profile, case_studies: caseStudies },
                project: { ...input.project, selected_case_study_ids: ["cs-a"] },
            });
            expect(snapshot.case_studies).toEqual([{
                title: "Loft conversion",
                project_type: "Loft",
                location: null,
                client: null,
                contract_value: "42000",
                duration: null,
                delivered: "A new bedroom.",
                value_added: null,
                photos: ["https://cdn.example.test/a.jpg"],
            }]);
            expect(JSON.stringify(snapshot)).not.toContain("internal_note");
        });

        it("matches earlier selections stored by position and includes none when nothing is ticked", () => {
            expect(selectCaseStudies(caseStudies, [1]).map((study) => study.title)).toEqual(["Kitchen refit"]);
            expect(selectCaseStudies(caseStudies, [2])).toEqual([]);
            expect(selectCaseStudies(caseStudies, [])).toEqual([]);
            expect(selectCaseStudies(caseStudies, null)).toEqual([]);
        });

        it("keeps photographs with the contractor's captions and drops unsafe links", () => {
            const snapshot = buildProposalPublicationSnapshot({
                ...input,
                project: {
                    ...input.project,
                    site_photos: [
                        { url: "https://cdn.example.test/site.jpg", caption: "  Existing bathroom  ", supplier: "x" },
                        { url: "https://cdn.example.test/no-caption.jpg", caption: "" },
                        { url: "javascript:alert(1)", caption: "bad" },
                        { url: "http://tracker.example.test/pixel.gif" },
                        "https://cdn.example.test/string.jpg",
                    ],
                },
            });
            expect(snapshot.photos).toEqual([
                { url: "https://cdn.example.test/site.jpg", caption: "Existing bathroom" },
                { url: "https://cdn.example.test/no-caption.jpg", caption: null },
                { url: "https://cdn.example.test/string.jpg", caption: null },
            ]);
            expect(safeImageUrl("http://localhost:3000/x.png")).toBe("http://localhost:3000/x.png");
            expect(safeImageUrl("https://user:pass@example.test/x.png")).toBeNull();
        });

        it("records why no VAT is charged and refuses a reverse charge that charges VAT", () => {
            const reverse = buildProposalPublicationSnapshot({ ...input, vatRate: 0, vatTreatment: "domestic_reverse_charge" });
            expect(reverse.commercial.vat_treatment).toBe("domestic_reverse_charge");
            expect(reverse.commercial.contract_sum_inc_vat).toBe(reverse.commercial.contract_sum_ex_vat);
            expect(() => buildProposalPublicationSnapshot({ ...input, vatRate: 20, vatTreatment: "domestic_reverse_charge" }))
                .toThrow("cannot charge VAT");
        });
    });

    describe("immutability", () => {
        it("is unaffected by later edits to the project, profile or estimate it was built from", async () => {
            const project = { ...input.project, programme_phases: [{ name: "Build", calculatedDays: 5, startOffset: 0 }] };
            const profile = { ...input.profile };
            const estimate = { ...input.estimate, estimate_lines: input.estimate.estimate_lines.map((line) => ({ ...line })) };
            const snapshot = buildProposalPublicationSnapshot({ ...input, project, profile, estimate });
            const frozen = JSON.stringify(snapshot);
            const hash = await hashProposalPublication(snapshot);

            project.scope_text = "A completely different scope.";
            (project.programme_phases[0] as { calculatedDays: number }).calculatedDays = 50;
            profile.company_name = "Renamed Ltd";
            estimate.estimate_lines[0].line_total = 99999;

            expect(JSON.stringify(snapshot)).toBe(frozen);
            await expect(hashProposalPublication(snapshot)).resolves.toBe(hash);

            // Republishing makes a new version; it does not alter the first.
            const next = buildProposalPublicationSnapshot({
                ...input, project, profile, estimate,
                publicationId: "44444444-4444-4444-8444-444444444444",
                versionNumber: 3,
            });
            expect(next.content.scope).toBe("A completely different scope.");
            expect(next.publication.version_number).toBe(3);
            expect(JSON.stringify(snapshot)).toBe(frozen);
            await expect(hashProposalPublication(next)).resolves.not.toBe(hash);
        });
    });
});
