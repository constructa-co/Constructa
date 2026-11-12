import { createElement } from "react";
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { computeProgrammePlan } from "./programme-plan";
import { buildProgrammePhases, buildSimpleProgramme, draftPlan, emptyProgrammeDraft, viewForProject } from "./simple-programme";
import { computeDisplayProgramme, programmeAxisLabels, programmeStageBar, programmeStageRange } from "./relative-programme";
import { buildProposalPublicationSnapshot } from "./proposal-publication";
import { buildProposalDocument } from "./proposal-document";
import { evaluateProposalReadiness } from "./proposal-readiness";
import { representativeInput } from "./__fixtures__/proposal";
import ProgrammeOverview from "@/components/programme-overview";
import ProposalDocumentView from "@/components/proposal/proposal-document-view";
import { renderProposalBrochure } from "./pdf/proposal-brochure";

const relative = () => ({ ...emptyProgrammeDraft("2026-10-19"), timeBasis: "relative" as const, stages: [
    { key: "a", name: "Prepare site", duration: "3", unit: "days" as const, source: null },
    { key: "b", name: "Fit kitchen", duration: "1", unit: "weeks" as const, source: null },
] });
function phases() {
    const built = buildSimpleProgramme(relative());
    expect(built.ok).toBe(true);
    if (!built.ok) throw new Error("Relative programme must validate");
    return buildProgrammePhases(built.input, []);
}

describe("explicit relative working-day programmes", () => {
    it("builds a relative request without submitting a made-up or retained date", () => {
        expect(buildSimpleProgramme(relative())).toEqual({ ok: true, input: { timeBasis: "relative", startDate: "", stages: [
            { name: "Prepare site", workingDays: 3, unit: "days", source: null },
            { name: "Fit kitchen", workingDays: 5, unit: "weeks", source: null },
        ] } });
    });

    it("saves explicit working-day offsets, not calendar offsets or dates, and reopens them", () => {
        const saved = phases();
        expect(saved.map(p => [p.timeBasis, p.workingDayOffset, p.manualDays])).toEqual([
            ["relative_working_days", 0, 3], ["relative_working_days", 3, 5],
        ]);
        expect(saved.every(p => !("start_date" in p) && !("startOffset" in p))).toBe(true);
        const view = viewForProject({ start_date: "2026-10-19", programme_phases: saved }, () => "key");
        expect(view.kind).toBe("simple");
        if (view.kind === "simple") {
            expect(view.draft.timeBasis).toBe("relative");
            expect(view.hasSaved).toBe(true);
            expect(draftPlan(view.draft)).toEqual(draftPlan(relative()));
        }
    });

    it("uses one shared Day1-8 axis and inclusive stage ranges without pretending to know weekdays", () => {
        const plan = draftPlan(relative())!;
        expect(plan).toMatchObject({ basis: "relative_working_days", working_days: 8 });
        expect(plan).not.toHaveProperty("start_date"); expect(plan).not.toHaveProperty("calendar_days");
        expect(programmeAxisLabels(plan)).toEqual(["Day 1", "Day 8"]);
        expect(programmeStageRange(plan, 0)).toBe("Day 1 to Day 3");
        expect(programmeStageRange(plan, 1)).toBe("Day 4 to Day 8");
        expect(programmeStageBar(plan, 1)).toEqual({ leftPct: 37.5, widthPct: 62.5 });
    });

    it("never reinterprets unmarked undated or mixed/invalid phases as relative", () => {
        expect(computeDisplayProgramme(null, [{ name: "Build", manualDays: 5 }])).toBeNull();
        const saved = phases();
        for (const invalid of [
            [saved[0], { ...saved[1], timeBasis: undefined }],
            [saved[0], { ...saved[1], workingDayOffset: 4 }],
            [{ ...saved[0], manualDays: 1.5 }],
            [{ ...saved[0], start_date: "2026-10-19" }],
            [{ ...saved[0], startOffset: 0 }],
            [{ ...saved[0], name: " " }],
        ]) expect(computeDisplayProgramme("2026-10-19", invalid)).toBeNull();
        expect(computeProgrammePlan("2026-10-19", saved)).toBeNull();
    });

    it("keeps the existing dated request and canonical calculation unchanged", () => {
        const dated = { ...relative(), timeBasis: undefined };
        const result = buildSimpleProgramme(dated);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.input).not.toHaveProperty("timeBasis");
        expect(computeDisplayProgramme(dated.startDate, buildProgrammePhases(result.input, []))).toEqual(computeProgrammePlan(dated.startDate, buildProgrammePhases(result.input, [])));
    });

    it("keeps relative lengths/names required and validates the dated start after switching back", () => {
        expect(buildSimpleProgramme({ ...relative(), startDate: "" }).ok).toBe(true);
        expect(buildSimpleProgramme({ ...relative(), stages: [{ ...relative().stages[0], duration: "0" }] }).ok).toBe(false);
        expect(buildSimpleProgramme({ ...relative(), stages: [{ ...relative().stages[0], name: "" }] }).ok).toBe(false);
        expect(buildSimpleProgramme({ ...relative(), timeBasis: undefined, startDate: "" }).ok).toBe(false);
    });

    it("renders the editor's activity overview with relative labels and no calendar promise", () => {
        const html = renderToStaticMarkup(createElement(ProgrammeOverview, { plan: draftPlan(relative())!, isDark: true }));
        expect(html).toContain("Day 1 to Day 3"); expect(html).toContain("Day 4 to Day 8");
        expect(html).toContain("Start date not agreed"); expect(html).not.toContain("2026");
    });

    it("keeps relative programmes ready without weakening invalid/missing programme checks", () => {
        const valid = evaluateProposalReadiness({ programmePhases: phases(), projectStartDate: null });
        expect(valid.mandatory.find(row => row.key === "programme")?.ok).toBe(true);
        const invalid = evaluateProposalReadiness({ programmePhases: [{ name: "Build", manualDays: 5 }], projectStartDate: null });
        expect(invalid.mandatory.find(row => row.key === "programme")?.ok).toBe(false);
    });

    it("freezes relative ranges in the same snapshot/document used by HTML and the local PDF renderer", () => {
        const input = representativeInput();
        input.project = { ...input.project, name: "TEST DATA - relative programme example", start_date: "2026-10-19", programme_phases: phases() };
        const snapshot = buildProposalPublicationSnapshot(input);
        expect(snapshot.programme_plan).toMatchObject({ basis: "relative_working_days", working_days: 8 });
        expect(snapshot.project.start_date).toBeNull();
        expect(snapshot.programme.every(p => p.start_date === null)).toBe(true);
        const doc = buildProposalDocument(JSON.parse(JSON.stringify(snapshot)), { isDraft: true });
        const html = renderToStaticMarkup(createElement(ProposalDocumentView, { doc }));
        expect(html).toContain("Day 4 to Day 8"); expect(html).toContain("Start date not agreed");
        expect(html).not.toContain("19 Oct");
        const pdf = renderProposalBrochure(doc, new Map());
        const raw = pdf.doc.output();
        expect(raw).toContain("Day 4 to Day 8"); expect(raw).toContain("Start date not agreed");
        // Explicit offline review capture only; ordinary unit runs never write a document.
        if (process.env.CONSTRUCTA_CAPTURE_RELATIVE_PROGRAMME === "1") {
            writeFileSync("../verification/relative-programme-example-20261022.pdf", new Uint8Array(pdf.doc.output("arraybuffer")), { flag: "wx" });
        }
    });
});
