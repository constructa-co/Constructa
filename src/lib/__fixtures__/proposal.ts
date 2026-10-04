/**
 * Synthetic proposals for tests. No real company, client, address or image.
 */

import type { BuildProposalPublicationInput } from "@/lib/proposal-publication";
import { STANDARD_PROPOSAL_TERMS } from "@/lib/proposal-terms";

const PHOTO = (name: string) => `https://images.example.test/${name}.jpg`;

/** A typical small-contractor proposal: every section present, nothing oversized. */
export function representativeInput(): BuildProposalPublicationInput {
    return {
        publicationId: "11111111-1111-4111-8111-111111111111",
        versionNumber: 1,
        sentAt: "2026-10-05T09:00:00.000Z",
        validityDays: 30,
        responseKind: "acknowledgement",
        vatRate: 20,
        vatTreatment: "standard",
        termsProfileVersion: "phase1-standard-v1",
        resolvedTerms: STANDARD_PROPOSAL_TERMS.map(({ title, body }) => ({ title, body })),
        project: {
            id: "22222222-2222-4222-8222-222222222222",
            name: "14 Example Road bathroom refit",
            project_type: "Bathroom refurbishment",
            client_name: "Alex Client",
            client_address: "14 Example Road, Exampleton, EX1 2MP",
            site_address: "14 Example Road, Exampleton, EX1 2MP",
            start_date: "2026-11-02",
            proposal_introduction: "Thank you for showing us round on Tuesday.\nThis proposal sets out the work we discussed, what it costs and when we can do it.",
            scope_text: [
                "Strip out the existing bathroom and make good the walls.",
                "- Remove the bath, basin, WC and wall tiles",
                "- First fix plumbing for a walk-in shower, basin and WC",
                "- Board and tank the shower area",
                "- Tile the floor and the shower walls",
                "- Fit the sanitaryware you have chosen and connect it",
                "Leave the room clean and ready to use.",
            ].join("\n"),
            exclusions_text: "Decorating outside the bathroom\nMoving the soil stack\nSupplying the sanitaryware",
            clarifications_text: "Price assumes the floor joists are sound\nWater will be off for one working day",
            closing_statement: "We would be glad to do this job for you.\nIf anything here is unclear, ring me and I will talk it through.",
            payment_schedule: [
                { id: "p1", stage: "Deposit", description: "On booking", percentage: 30 },
                { id: "p2", stage: "First fix complete", description: "When plumbing is tested", percentage: 40 },
                { id: "p3", stage: "Completion", description: "On handover", percentage: 30 },
            ],
            programme_phases: [
                { name: "Strip out", calculatedDays: 3, manualDays: 3, manhours: 0, startOffset: 0, duration_unit: "Days" },
                { name: "First fix and boarding", calculatedDays: 4, manualDays: 4, manhours: 0, startOffset: 3, duration_unit: "Days" },
                { name: "Tiling", calculatedDays: 5, manualDays: 5, manhours: 0, startOffset: 9, duration_unit: "Weeks" },
                { name: "Second fix and finish", calculatedDays: 3, manualDays: 3, manhours: 0, startOffset: 16, duration_unit: "Days" },
            ],
            site_photos: [
                { url: PHOTO("bathroom-before"), caption: "The bathroom as it is now" },
                { url: PHOTO("shower-corner"), caption: "" },
            ],
            selected_case_study_ids: ["cs-1"],
        },
        profile: {
            company_name: "Example Building Ltd",
            logo_url: null,
            phone: "01632 960000",
            website: "https://example-building.example.test",
            capability_statement: "We are a family firm fitting bathrooms and kitchens in and around Exampleton.\nThe people who price your job are the people who do it.",
            years_trading: 12,
            specialisms: "Bathrooms, Kitchens, Tiling",
            accreditations: "Example Trade Register member",
            insurance_details: "Public liability cover, certificate available on request",
            pdf_theme: "navy",
            md_name: "Sam Builder",
            md_message: "I visit every job at the start and at the end.",
            case_studies: [
                {
                    id: "cs-1",
                    projectName: "Shower room, 3 Sample Street",
                    projectType: "Bathroom refurbishment",
                    location: "Exampleton",
                    client: "Private homeowner",
                    contractValue: "9800",
                    programmeDuration: "3 weeks",
                    whatWeDelivered: "A walk-in shower room in place of a small bathroom.",
                    valueAdded: "We reused the existing waste run, which saved lifting the hall floor.",
                    photos: [PHOTO("sample-street-1"), PHOTO("sample-street-2")],
                },
                { id: "cs-2", projectName: "Kitchen, 8 Test Lane", projectType: "Kitchen" },
            ],
        },
        estimate: {
            id: "33333333-3333-4333-8333-333333333333",
            version_name: "Estimate v1",
            prelims_pct: 0,
            overhead_pct: 10,
            risk_pct: 0,
            profit_pct: 15,
            discount_pct: 0,
            estimate_lines: [
                { id: "l1", trade_section: "Demolition", description: "Strip out bathroom and dispose", quantity: 1, unit: "item", line_total: 850 },
                { id: "l2", trade_section: "Plumbing", description: "First and second fix plumbing", quantity: 1, unit: "item", line_total: 2400 },
                { id: "l3", trade_section: "Finishes", description: "Board and tank shower area", quantity: 6, unit: "m2", line_total: 540 },
                { id: "l4", trade_section: "Finishes", description: "Wall and floor tiling", quantity: 24, unit: "m2", line_total: 1560 },
                { id: "l5", trade_section: "Finishes", description: "Fit sanitaryware supplied by client", quantity: 1, unit: "item", line_total: 620 },
            ],
        },
    };
}

/** The least a proposal can carry: one price, one bar, standard terms. */
export function minimalInput(): BuildProposalPublicationInput {
    const base = representativeInput();
    return {
        ...base,
        project: {
            id: base.project.id,
            name: "Replace garden gate",
            client_name: "Alex Client",
            start_date: "2026-11-02",
            scope_text: "Take down the old gate and fit a new one.",
            payment_schedule: [{ id: "p1", stage: "On completion", percentage: 100 }],
            programme_phases: [{ name: "Works on site", calculatedDays: 2, manualDays: 2, manhours: 0, startOffset: 0 }],
        },
        profile: { company_name: "Example Building Ltd" },
        estimate: {
            ...base.estimate,
            overhead_pct: 0,
            profit_pct: 0,
            estimate_lines: [{ id: "l1", trade_section: "General", description: "New gate, supplied and fitted", quantity: 1, unit: "item", line_total: 480 }],
        },
        resolvedTerms: [{ title: "Payment", body: "Payment is due on completion." }],
    };
}

const SENTENCE = "The work in this part is carried out in the order agreed on site and is left clean and safe at the end of each day.";

/** Far more of everything than a real proposal would hold, to stress the page breaks. */
export function stressInput(): BuildProposalPublicationInput {
    const base = representativeInput();
    return {
        ...base,
        project: {
            ...base.project,
            name: "Full refurbishment and rear extension at 14 Example Road including loft conversion and landscaping",
            proposal_introduction: Array.from({ length: 12 }, (_, i) => `Paragraph ${i + 1} of the opening message. ${SENTENCE} ${SENTENCE}`).join("\n"),
            scope_text: Array.from({ length: 45 }, (_, i) => (i % 3 === 0 ? `Area ${i / 3 + 1}. ${SENTENCE} ${SENTENCE}` : `- Item ${i + 1}: ${SENTENCE}`)).join("\n"),
            exclusions_text: Array.from({ length: 25 }, (_, i) => `Exclusion ${i + 1}: ${SENTENCE}`).join("\n"),
            clarifications_text: Array.from({ length: 25 }, (_, i) => `Clarification ${i + 1}: ${SENTENCE}`).join("\n"),
            closing_statement: Array.from({ length: 10 }, (_, i) => `Closing paragraph ${i + 1}. ${SENTENCE} ${SENTENCE}`).join("\n"),
            payment_schedule: Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, stage: `Stage ${i + 1} of the works complete`, description: `When stage ${i + 1} is signed off on site by both of us`, percentage: 10 })),
            programme_phases: Array.from({ length: 6 }, (_, i) => ({ name: `Stage ${i + 1}: a long stage name that runs on`, calculatedDays: 10, manualDays: 10, manhours: 0, startOffset: i * 14 })),
            site_photos: Array.from({ length: 6 }, (_, i) => ({ url: PHOTO(`stress-${i}`), caption: `Photograph ${i + 1}: ${SENTENCE}` })),
            selected_case_study_ids: ["cs-1", "cs-3", "cs-4"],
        },
        profile: {
            ...base.profile,
            capability_statement: Array.from({ length: 8 }, (_, i) => `About paragraph ${i + 1}. ${SENTENCE} ${SENTENCE}`).join("\n"),
            specialisms: Array.from({ length: 14 }, (_, i) => `Specialism ${i + 1}`).join(", "),
            accreditations: Array.from({ length: 9 }, (_, i) => `Accreditation ${i + 1}`).join("\n"),
            md_message: Array.from({ length: 6 }, () => `${SENTENCE} ${SENTENCE}`).join("\n"),
            case_studies: [
                ...(base.profile.case_studies ?? []),
                ...["cs-3", "cs-4"].map((id, i) => ({
                    id,
                    projectName: `Past job ${i + 2} with a long descriptive title that wraps onto a second line`,
                    projectType: "Extension",
                    location: "Exampleton",
                    client: "Private homeowner",
                    contractValue: "125000",
                    programmeDuration: "20 weeks",
                    whatWeDelivered: Array.from({ length: 5 }, () => SENTENCE).join("\n"),
                    valueAdded: Array.from({ length: 5 }, () => SENTENCE).join("\n"),
                    photos: [PHOTO(`${id}-a`), PHOTO(`${id}-b`), PHOTO(`${id}-c`)],
                })),
            ],
        },
        estimate: {
            ...base.estimate,
            estimate_lines: Array.from({ length: 70 }, (_, i) => ({
                id: `line-${i}`,
                trade_section: ["Demolition", "Groundworks", "Structure", "Roofing", "First fix", "Finishes", "External works"][Math.floor(i / 10)],
                description: i % 4 === 0 ? `Line ${i + 1}: ${SENTENCE}` : `Line ${i + 1}: supply and fix`,
                quantity: (i % 5) + 1,
                unit: i % 2 === 0 ? "m2" : "item",
                line_total: 250 + i * 37,
            })),
        },
        resolvedTerms: Array.from({ length: 30 }, (_, i) => ({ title: `Term ${i + 1}`, body: `${SENTENCE} ${SENTENCE} ${SENTENCE}` })),
    };
}
