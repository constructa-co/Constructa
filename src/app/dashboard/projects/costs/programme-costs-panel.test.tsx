import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { workspaceStyles } from "@/lib/workspace-styles";
import { computeProgrammeCosts, hireDatesForNote, programmeCostLineNote, type ProgrammeCostInputs } from "@/lib/programme-costs";
import type { Estimate, EstimateLine } from "./types";

vi.mock("./programme-costs-actions", () => ({ applyProgrammeCostsAction: vi.fn() }));
import ProgrammeCostsPanel, { draftFromInputs, inputsFromDraft, upgradeStoredDraft } from "./programme-costs-panel";

// Synthetic programme only.
const PROGRAMME = {
    start_date: "2027-03-01", region: "England",
    programme_phases: [
        { name: "Groundworks", calculatedDays: 5, manualDays: null, manhours: 40, startOffset: 0 },
        { name: "Drainage", calculatedDays: 5, manualDays: null, manhours: 80, startOffset: 2 },
    ],
};
const INPUTS: ProgrammeCostInputs = {
    version: 2,
    stages: [{ name: "Groundworks", shifts: ["day"], costedOperatives: null, crewByShift: { day: null, night: null } }, { name: "Drainage", shifts: ["day", "night"], costedOperatives: 1.5, crewByShift: { day: null, night: null } }],
    gangFloors: [{ shift: "day", minimumPaidGang: 3, operativeDayRatePence: 25_000 }],
    supervision: [{ shift: "day", ratePerShiftPence: 18_000 }],
    hires: [{
        id: "h-dumper", description: "3 t dumper", unit: "week", ratePence: 12_000, chargeableDays: null, partPeriodRule: "whole_period",
        minimumPeriods: 4, onHire: { kind: "stage_start", stage: 0 }, offHire: { kind: "stage_finish", stage: 1 },
        offHireRule: "collection_date", offHireDays: 2, deliveryPence: 6_500, collectionPence: 6_500,
    }],
    crews: [],
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
        notes: programmeCostLineNote(line, outcome.result.signature, inputs, (() => {
            const hire = outcome.result.hires.find((entry) => line.key.startsWith(`hire:${entry.id}`));
            return hire ? hireDatesForNote(hire) : undefined;
        })()),
    }));
}

// INPUTS with its D121 hire anchors bound to the stage names they were set against.
const NAMED_INPUTS: ProgrammeCostInputs = {
    ...INPUTS,
    hires: [{ ...INPUTS.hires[0], onHire: { kind: "stage_start", stage: 0, stageName: "Groundworks" }, offHire: { kind: "stage_finish", stage: 1, stageName: "Drainage" } }],
};

// One day crew of 1 operative × 8 h shared by both stages. Groundworks needs 8 h a day, Drainage 16 h:
// 24 h on 3–5 March and 16 h on 8–9 March against 8 h available.
const CREW_INPUTS: ProgrammeCostInputs = {
    ...NAMED_INPUTS,
    stages: [
        { name: "Groundworks", shifts: ["day"], costedOperatives: null, crewByShift: { day: "gang-a", night: null } },
        { name: "Drainage", shifts: ["day"], costedOperatives: null, crewByShift: { day: "gang-a", night: null } },
    ],
    crews: [{ id: "gang-a", name: "Gang A", shift: "day", operatives: 1, productiveHoursPerShift: 8 }],
};

describe("programme costs draft", () => {
    it("round-trips applied settings through the editable draft", () => {
        const draft = draftFromInputs(INPUTS);
        // A D121 anchor comes back bound to the name of the stage it was set against; the price is unchanged.
        expect(inputsFromDraft(draft, INPUTS.stages)).toEqual({ ok: true, inputs: NAMED_INPUTS });
        const before = computeProgrammeCosts(PROGRAMME, INPUTS);
        const after = computeProgrammeCosts(PROGRAMME, NAMED_INPUTS);
        expect(after.ok && before.ok && after.result.signature === before.result.signature).toBe(true);
        expect(inputsFromDraft(draftFromInputs(NAMED_INPUTS), INPUTS.stages)).toEqual({ ok: true, inputs: NAMED_INPUTS });
        expect(inputsFromDraft(draftFromInputs(CREW_INPUTS), CREW_INPUTS.stages)).toEqual({ ok: true, inputs: CREW_INPUTS });
    });

    it("reads a D121 draft saved in the browser, adding no crews", () => {
        // A D121 draft: version 1, no crews, stages without crew choices.
        const v1 = JSON.parse(JSON.stringify(draftFromInputs(INPUTS))) as Record<string, unknown> & { stages: Record<string, unknown>[] };
        v1.version = 1;
        delete v1.crews;
        for (const stage of v1.stages) { delete stage.dayCrew; delete stage.nightCrew; }
        const upgraded = upgradeStoredDraft(JSON.parse(JSON.stringify(v1)));
        expect(upgraded).toMatchObject({ version: 2, crews: [], stages: [{ dayCrew: "", nightCrew: "" }, { dayCrew: "", nightCrew: "" }] });
        expect(inputsFromDraft(upgraded!, INPUTS.stages)).toEqual({ ok: true, inputs: NAMED_INPUTS });
        expect(upgradeStoredDraft({ version: 3, stages: [], hires: [] })).toBeNull();
    });

    it("leaves a crew's bad figures unset instead of blocking the costs", () => {
        const draft = draftFromInputs(CREW_INPUTS);
        draft.crews[0] = { ...draft.crews[0], operatives: "0", hours: "30" };
        const parsed = inputsFromDraft(draft, CREW_INPUTS.stages);
        expect(parsed.ok && parsed.inputs.crews[0]).toMatchObject({ operatives: null, productiveHoursPerShift: null });
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
        expect(html).toContain("The estimate still carries the earlier figures until you review and apply.");
        expect(html).toContain("The estimate keeps its lines until you change them.");
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

    it("warns when the planned crew is short, with hours needed, available and short, the dates, and what to review", () => {
        const html = render([LABOUR], { initialInputs: CREW_INPUTS });
        expect(html).toContain('data-crew-check-status="short"');
        expect(html).toContain("Crew check: the planned crews are short of the priced labour hours on 5 shifts.");
        expect(html).toContain("Gang A (day shift) is short on 5 shifts between");
        expect(html).toContain("the priced labour needs 104 h; the crew has 40 h (1 operative × 8 h a shift). Short by 64 h.");
        expect(html).toContain("Stages involved: Groundworks, Drainage.");
        expect(html).toContain('data-crew-short-window="2027-03-03"');
        expect(html).toContain("Nothing here changes your programme or your price.");
        expect(html).toContain("/dashboard/projects/schedule?projectId=job");
        // A warning only: the costs can still be reviewed and applied.
        expect(html).toContain("data-programme-costs-ack");
    });

    it("never reports a crew it cannot check as fitting", () => {
        const noHours = { ...CREW_INPUTS, crews: [{ ...CREW_INPUTS.crews[0], productiveHoursPerShift: null }] };
        const html = render([LABOUR], { initialInputs: noHours });
        expect(html).toContain('data-crew-check-status="cannot_check"');
        expect(html).toContain("Cannot be checked yet");
        expect(html).toContain("Groundworks, day shift: the crew has no productive hours per shift.");
        expect(html).not.toContain("data-crew-check-fits");
        expect(render([LABOUR], { initialInputs: INPUTS })).toContain('data-crew-check-status="not_set"');
    });

    it("shows on hire, planned off-hire and the supplier's charged-to date from the programme, as planned dates only", () => {
        const html = render([LABOUR], { initialInputs: INPUTS });
        expect(html).toContain("Plant on hire: dates from your programme");
        expect(html).toContain("A planned off-hire is not an off-hire instruction: nothing is sent to, booked with or cancelled with a supplier.");
        expect(html).toContain('data-off-hire-on="2027-03-01"');
        expect(html).toContain('data-off-hire-off="2027-03-09"');
        expect(html).toContain('data-off-hire-charged="2027-03-11"');
        expect(html).toContain("collected 2 days after");
        expect(html).toContain("4 × week (11 calendar days; minimum hire of 4 applied)");
        expect(html).not.toContain("data-off-hire-moved");
    });

    it("shows how far applied hire dates moved after a programme change, and keeps the applied price", () => {
        const applied = appliedLinesFrom(INPUTS);
        const longer = { ...PROGRAMME, programme_phases: [PROGRAMME.programme_phases[0], { ...PROGRAMME.programme_phases[1], calculatedDays: 20 }] };
        const html = render([LABOUR, ...applied], { programme: longer });
        expect(html).toContain('data-programme-costs-status="review"');
        expect(html).toContain("data-off-hire-moved");
        // Drainage now finishes Thu 1 April 2027 (20 working days, Easter skipped): 23 calendar days later.
        expect(html).toContain('data-off-hire-off="2027-04-01"');
        expect(html).toContain("(moved +23 days)");
        expect(html).toContain("The hire costs saved on the estimate stay unchanged: this version adds programme costs once and cannot update them.");
        expect(html).not.toContain("To use the new dates");
        expect(html).toContain("On the estimate: 4 × week");
        expect(html).toContain("Plant hire – 3 t dumper (£480.00)");
        expect(html).not.toContain("data-programme-costs-ack");
    });

    it("refuses a hire whose stage no longer matches, in the hire table", () => {
        const named = { ...INPUTS, hires: [{ ...INPUTS.hires[0], offHire: { kind: "stage_finish" as const, stage: 1, stageName: "Drainage" } }] };
        const renamed = { ...PROGRAMME, programme_phases: [PROGRAMME.programme_phases[0], { ...PROGRAMME.programme_phases[1], name: "Drain runs" }] };
        const html = render([LABOUR], { initialInputs: { ...named, stages: [named.stages[0], { ...named.stages[1], name: "Drain runs" }] }, programme: renamed });
        expect(html).toContain('data-off-hire-status="refused"');
        expect(html).toContain("renamed or moved");
    });

    it("never lets a D121 hire (no stage names) follow a renamed or reordered stage, in the hire table or the price", () => {
        // INPUTS' hire is a D121 anchor: end of stage 1 ("Drainage"), no stage name stored.
        const renamed = { ...PROGRAMME, programme_phases: [PROGRAMME.programme_phases[0], { ...PROGRAMME.programme_phases[1], name: "Drain runs" }] };
        const reordered = { ...PROGRAMME, programme_phases: [{ ...PROGRAMME.programme_phases[1], startOffset: 0 }, { ...PROGRAMME.programme_phases[0], startOffset: 0 }] };
        for (const programme of [renamed, reordered]) {
            const html = render([LABOUR], { initialInputs: INPUTS, programme });
            expect(html).toContain('data-off-hire-status="refused"');
            expect(html).toContain("data-programme-costs-errors");
            expect(html).toContain("renamed or moved");
            expect(html).not.toContain("data-programme-costs-ack");
        }
        // The same through a D121 draft stored in the browser, aligned to the renamed programme as the panel does.
        const stored = JSON.parse(JSON.stringify(draftFromInputs(INPUTS))) as Record<string, unknown> & { stages: Record<string, unknown>[]; hires: Record<string, unknown>[] };
        stored.version = 1;
        delete stored.crews;
        for (const hire of stored.hires) { delete hire.onStageName; delete hire.offStageName; }
        const upgraded = upgradeStoredDraft(stored)!;
        const currentStages = [{ name: "Groundworks" }, { name: "Drain runs" }];
        const aligned = { ...upgraded, stages: currentStages.map((stage, index) => (upgraded.stages[index]?.name === stage.name ? upgraded.stages[index] : { name: stage.name, day: true, night: false, costed: "", dayCrew: "", nightCrew: "" })) };
        const parsed = inputsFromDraft(aligned, currentStages);
        if (!parsed.ok) throw new Error(parsed.errors.join());
        expect(parsed.inputs.hires[0].offHire).toEqual({ kind: "stage_finish", stage: 1, stageName: "Drainage" });
        expect(computeProgrammeCosts(renamed, parsed.inputs)).toMatchObject({ ok: false });
    });

    it("blocks applying while other estimate work is open", () => {
        const html = render([LABOUR], { initialInputs: INPUTS, blockedReason: "Save or cancel your open estimate work first." });
        expect(html).toContain("Save or cancel your open estimate work first.");
        expect(html).toMatch(/<input type="checkbox" disabled=""[^>]*data-programme-costs-ack/);
        expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Apply programme costs to the estimate<\/button>/);
    });
});
