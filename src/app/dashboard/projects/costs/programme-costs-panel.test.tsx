import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { workspaceStyles } from "@/lib/workspace-styles";
import { computeProgrammeCosts, programmeCostLineNote, type ProgrammeCostInputs } from "@/lib/programme-costs";
import type { Estimate, EstimateLine } from "./types";

vi.mock("./programme-costs-actions", () => ({ applyProgrammeCostsAction: vi.fn() }));
import ProgrammeCostsPanel, { draftFromInputs, inputsFromDraft } from "./programme-costs-panel";

// Synthetic programme only.
const PROGRAMME = {
    start_date: "2027-03-01", region: "England",
    programme_phases: [
        { name: "Groundworks", calculatedDays: 5, manualDays: null, manhours: 40, startOffset: 0 },
        { name: "Drainage", calculatedDays: 5, manualDays: null, manhours: 80, startOffset: 2 },
    ],
};
const INPUTS: ProgrammeCostInputs = {
    version: 1,
    stages: [{ name: "Groundworks", shifts: ["day"], costedOperatives: null }, { name: "Drainage", shifts: ["day", "night"], costedOperatives: 1.5 }],
    gangFloors: [{ shift: "day", minimumPaidGang: 3, operativeDayRatePence: 25_000 }],
    supervision: [{ shift: "day", ratePerShiftPence: 18_000 }],
    hires: [{
        id: "h-dumper", description: "3 t dumper", unit: "week", ratePence: 12_000, chargeableDays: null, partPeriodRule: "whole_period",
        minimumPeriods: 4, onHire: { kind: "stage_start", stage: 0 }, offHire: { kind: "stage_finish", stage: 1 },
        offHireRule: "collection_date", offHireDays: 2, deliveryPence: 6_500, collectionPence: 6_500,
    }],
};
const LABOUR: EstimateLine = {
    id: "labour", estimate_id: "estimate", description: "Excavate trench", quantity: 1, unit: "item", unit_rate: 1000, line_total: 1000,
    trade_section: "Groundworks", line_type: "general", pricing_mode: "simple", estimate_line_components: [],
};
function estimateWith(lines: EstimateLine[]): Estimate {
    return { id: "estimate", project_id: "job", version_name: "Estimate", is_active: true, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 10, discount_pct: 0, discount_reason: "", total_cost: 0, estimate_lines: lines };
}
function render(lines: EstimateLine[], props: Partial<Parameters<typeof ProgrammeCostsPanel>[0]> = {}) {
    return renderToStaticMarkup(
        <ProgrammeCostsPanel projectId="job" estimate={estimateWith(lines)} lines={lines} programme={PROGRAMME} s={workspaceStyles(true)} onApplied={() => {}} defaultOpen {...props} />,
    );
}
function appliedLinesFrom(inputs: ProgrammeCostInputs, source = PROGRAMME): EstimateLine[] {
    const outcome = computeProgrammeCosts(source, inputs);
    if (!outcome.ok) throw new Error(outcome.errors.join());
    return outcome.result.lines.map((line, index) => ({
        ...LABOUR, id: `applied-${index}`, trade_section: "Preliminaries", description: line.description, quantity: line.quantity, unit: line.unit,
        unit_rate: line.unitRatePence / 100, line_total: line.quantity * (line.unitRatePence / 100),
        notes: programmeCostLineNote(line, outcome.result.signature, inputs),
    }));
}

describe("programme costs draft", () => {
    it("round-trips applied settings through the editable draft", () => {
        const draft = draftFromInputs(INPUTS);
        expect(inputsFromDraft(draft, INPUTS.stages)).toEqual({ ok: true, inputs: INPUTS });
    });

    it("lists what is missing instead of pricing a half-stated hire", () => {
        const draft = draftFromInputs(INPUTS);
        draft.hires[0] = { ...draft.hires[0], rate: "12o", offHireRule: "" };
        const parsed = inputsFromDraft(draft, INPUTS.stages);
        expect(parsed.ok).toBe(false);
        expect(parsed.ok ? [] : parsed.errors.join(" ")).toMatch(/3 t dumper rate/);
    });
});

describe("programme costs review panel", () => {
    it("is offered but not applied on a fresh estimate", () => {
        const html = render([LABOUR]);
        expect(html).toContain('data-programme-costs-status="not_applied"');
        expect(html).toContain("Not on the estimate.");
        expect(html).toContain("Stages and shifts");
        expect(html).toContain("No programme costs: nothing is charged with these settings.");
        expect(html).not.toContain("data-programme-costs-apply");
    });

    it("shows the lines, the exact price change and the preliminaries percentage that would stop applying, and never applies unacknowledged", () => {
        const html = render([LABOUR], { initialInputs: INPUTS });
        expect(html).toContain("Minimum labour attendance – day shifts");
        expect(html).toContain("Site supervision – day shifts");
        expect(html).toContain("Plant hire – 3 t dumper");
        expect(html).toContain("Delivery and collection – 3 t dumper");
        expect(html).toContain("data-programme-costs-prelims-switch");
        expect(html).toContain("Total before VAT now: <strong>£1,100.00</strong>");
        expect(html).toContain("data-programme-costs-ack");
        expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Apply programme costs to the estimate<\/button>/);
    });

    it("does not offer a second apply once costs are on the estimate (first apply only)", () => {
        const html = render([LABOUR, ...appliedLinesFrom(INPUTS)]);
        expect(html).toContain('data-programme-costs-status="up_to_date"');
        expect(html).toContain("data-programme-costs-first-apply-only");
        expect(html).toContain("These programme costs are on the estimate.");
        expect(html).not.toContain("data-programme-costs-apply");
        expect(html).not.toContain("data-programme-costs-ack");
    });

    it("flags pending review when the saved programme changes after applying, keeping the applied lines", () => {
        const applied = appliedLinesFrom(INPUTS);
        const longer = { ...PROGRAMME, programme_phases: [PROGRAMME.programme_phases[0], { ...PROGRAMME.programme_phases[1], calculatedDays: 8 }] };
        const html = render([LABOUR, ...applied], { programme: longer });
        expect(html).toContain('data-programme-costs-status="review"');
        expect(html).toContain("The costs saved on the estimate stay unchanged: this version cannot update them.");
        expect(html).toContain("The figures above differ from the programme cost lines on the estimate. Those lines stay unchanged.");
        expect(html).toContain("This version adds programme costs once and cannot update or replace them. These lines stay on the estimate as they are:");
        // No delete-first or review-and-apply guidance: replacing an applied set is not supported.
        expect(html).not.toMatch(/delete these lines|apply again|until you review and apply/);
        expect(html).toContain("Site supervision – day shifts (£1,260.00)");
        expect(html).not.toContain("data-programme-costs-ack");
    });

    it("does not call an edited applied line up to date, and keeps the edited price on the estimate", () => {
        const applied = appliedLinesFrom(INPUTS).map((line) => (line.description.startsWith("Site supervision") ? { ...line, quantity: 5, line_total: 900 } : line));
        const html = render([LABOUR, ...applied]);
        expect(html).toContain('data-programme-costs-status="review"');
        expect(html).toContain("edited or deleted after it was applied");
        expect(html).toContain("Site supervision – day shifts (£900.00)");
        expect(html).not.toContain("data-programme-costs-ack");
    });

    it("says why it cannot work out costs for an undated programme", () => {
        const html = render([LABOUR], { programme: { ...PROGRAMME, start_date: null } });
        expect(html).toContain("The programme has no start date");
        expect(html).toContain("/dashboard/projects/schedule?projectId=job");
    });

    it("labels the hire item as client-visible and previews the exact client wording", () => {
        const html = render([LABOUR], { initialInputs: INPUTS });
        expect(html).toContain("Plant item description (shown to client)");
        expect(html).toContain("Shown to the client. Do not enter supplier names, private rates or terms.");
        expect(html).toMatch(/<input id="programme-hire-item-h-dumper"[^>]*aria-describedby="programme-hire-item-help-h-dumper"/);
        expect(html).toContain("The client sees: “Plant hire – 3 t dumper” and “Delivery and collection – 3 t dumper”");
        expect(html).toContain("exactly what the client sees on the proposal and the client BoQ");
        // The review lists those same descriptions as the lines that would be written.
        expect(html).toMatch(/data-programme-cost-line="hire:h-dumper"[^>]*><dt[^>]*>Plant hire – 3 t dumper /);
        expect(html).not.toMatch(/>Item\s*</);
    });

    it("blocks applying while other estimate work is open", () => {
        const html = render([LABOUR], { initialInputs: INPUTS, blockedReason: "Save or cancel your open estimate work first." });
        expect(html).toContain("Save or cancel your open estimate work first.");
        expect(html).toMatch(/<input type="checkbox" disabled=""[^>]*data-programme-costs-ack/);
        expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Apply programme costs to the estimate<\/button>/);
    });
});
