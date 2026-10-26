import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProgrammeOverview from "@/components/programme-overview";
import ProposalDocumentView from "@/components/proposal/proposal-document-view";
import { representativeInput } from "./__fixtures__/proposal";
import { DEFAULT_JOB_WORKING_PATTERN, isDefaultJobWorkingPattern, resolveJobWorkingPattern } from "./job-working-pattern";
import { parseIsoDate as leafParseIsoDate } from "./programme-date";
import { addWorkingDays, computeProgrammePlan, countWorkingDays, formatWorkingDuration, isWorkingDay, nextWorkingDayAfter, parseIsoDate, PROGRAMME_BASIS_NOTE, programmePlanForProject } from "./programme-plan";
import { computeDisplayProgramme, computeRelativeProgramme, programmeAxisLabels, programmeBasisNote, programmeStageRange, RELATIVE_PROGRAMME_NOTE } from "./relative-programme";
import { buildProposalPublicationSnapshot, PROGRAMME_INCOMPLETE_ERROR, PROGRAMME_REQUIRED_ERROR } from "./proposal-publication";
import { buildProposalDocument } from "./proposal-document";
import { renderProposalBrochure } from "./pdf/proposal-brochure";

const FRIDAY = "2026-10-16";
const sixDays = () => ({ version: 1, weekdays: [1, 2, 3, 4, 5, 6] });
const datedPhases = () => [{ name: "Build", calculatedDays: 20, manualDays: 2, startOffset: 0 }];
const relativePhases = () => [
    { name: "Prepare", timeBasis: "relative_working_days", manualDays: 2, workingDayOffset: 0 },
    { name: "Build", timeBasis: "relative_working_days", manualDays: 6, workingDayOffset: 2 },
];

describe("saved per-job working patterns in programme and proposals", () => {
    it("extracts the exact existing parser and preserves the public default helpers", () => {
        expect(parseIsoDate).toBe(leafParseIsoDate);
        expect(parseIsoDate(" 2026-10-16T12:00:00Z")).toBe(Date.UTC(2026, 9, 16));
        expect(parseIsoDate("2026-02-30")).toBeNull();
        expect(parseIsoDate("0099-01-01")).toBeNull();
        expect(addWorkingDays(FRIDAY, 2)).toBe("2026-10-19");
        expect(nextWorkingDayAfter(FRIDAY)).toBe("2026-10-19");
        expect(isWorkingDay("2026-10-17")).toBe(false);
        expect(countWorkingDays(FRIDAY, "2026-10-19")).toBe(2);
    });

    it("keeps the complete legacy shape, labels and notes for missing or semantic Mon-Fri patterns", () => {
        const expected = {
            basis: "mon_fri_working_days", start_date: FRIDAY, end_date: "2026-10-19",
            working_days: 2, calendar_days: 4, duration_label: "2 working days",
            stages: [{ name: "Build", start_date: FRIDAY, end_date: "2026-10-19", working_days: 2, offset_days: 0, span_days: 4 }],
        };
        for (const pattern of [undefined, null, DEFAULT_JOB_WORKING_PATTERN, { version: 1, weekdays: [5, 3, 1, 4, 2] }]) {
            const plan = computeDisplayProgramme(FRIDAY, datedPhases(), pattern)!;
            expect(plan).toEqual(expected);
            expect(plan).not.toHaveProperty("working_pattern");
            expect(programmeBasisNote(plan)).toBe(PROGRAMME_BASIS_NOTE);
            const relative = computeRelativeProgramme(relativePhases(), pattern)!;
            expect(relative).toEqual({ basis: "relative_working_days", working_days: 8, duration_label: "8 working days", stages: [
                { name: "Prepare", start_day: 1, end_day: 2, working_days: 2 },
                { name: "Build", start_day: 3, end_day: 8, working_days: 6 },
            ] });
            expect(programmeBasisNote(relative)).toBe(RELATIVE_PROGRAMME_NOTE);
        }
        expect(isDefaultJobWorkingPattern(resolveJobWorkingPattern({ version: 1, weekdays: [5, 4, 3, 2, 1] })!)).toBe(true);
        expect(resolveJobWorkingPattern(undefined)).toBe(DEFAULT_JOB_WORKING_PATTERN);
        expect(Object.isFrozen(DEFAULT_JOB_WORKING_PATTERN.weekdays)).toBe(true);
        expect(formatWorkingDuration(5)).toBe("1 week");
        expect(formatWorkingDuration(15)).toBe("3 weeks");
        expect(formatWorkingDuration(8)).toBe("8 working days");
    });

    it("uses an explicitly selected Saturday without changing omitted-pattern dates", () => {
        const plan = computeProgrammePlan(FRIDAY, datedPhases(), sixDays())!;
        expect(plan).toMatchObject({ basis: "job_working_days", start_date: FRIDAY, end_date: "2026-10-17", working_days: 2, calendar_days: 2 });
        expect(computeProgrammePlan(FRIDAY, datedPhases())?.end_date).toBe("2026-10-19");
        expect(programmePlanForProject({ start_date: FRIDAY, programme_phases: datedPhases(), programme_working_pattern: sixDays() })).toEqual(plan);
        expect(formatWorkingDuration(6, sixDays())).toBe("1 week");
        expect(formatWorkingDuration(5, sixDays())).toBe("5 working days");
        expect(programmeBasisNote(plan)).toBe("Working days are Monday, Tuesday, Wednesday, Thursday, Friday, Saturday. A week means 6 working days. Bank holidays are not allowed for.");
    });

    it.each([
        { weekdays: [0, 1, 2, 3, 4, 5, 6], ranges: [[FRIDAY, "2026-10-17"], ["2026-10-17", "2026-10-18"], ["2026-10-30", "2026-10-31"]], total: 16 },
        { weekdays: [6], ranges: [["2026-10-17", "2026-10-24"], ["2026-10-17", "2026-10-24"], ["2026-10-31", "2026-11-07"]], total: 4 },
        { weekdays: [2, 4, 6], ranges: [["2026-10-17", "2026-10-20"], ["2026-10-17", "2026-10-20"], ["2026-10-31", "2026-11-03"]], total: 8 },
    ])("preserves manual priority, calendar offsets, overlaps and gaps with $weekdays", ({ weekdays, ranges, total }) => {
        const pattern = { version: 1, weekdays };
        const plan = computeProgrammePlan(FRIDAY, [
            ...datedPhases(),
            { name: "Overlap", calculatedDays: 99, manualDays: 2, startOffset: 1 },
            { name: "Later", calculatedDays: 99, manualDays: 2, startOffset: 14 },
        ], pattern)!;
        expect(plan.stages.map(stage => [stage.start_date, stage.end_date])).toEqual(ranges);
        expect(plan.stages.map(stage => stage.working_days)).toEqual([2, 2, 2]);
        expect(plan.working_days).toBe(total);
        expect(plan.stages[2].offset_days).toBe(14);
        expect(formatWorkingDuration(weekdays.length * 2, pattern)).toBe("2 weeks");
    });

    it("keeps dated calendar phases on their own dates, even on non-working weekdays", () => {
        const plan = computeProgrammePlan(null, [{ name: "Calendar stage", start_date: "2026-10-18", duration_days: 2 }], { version: 1, weekdays: [6] })!;
        expect(plan).toMatchObject({ start_date: "2026-10-18", end_date: "2026-10-19", calendar_days: 2, working_days: 0 });
        expect(plan.stages[0]).toMatchObject({ start_date: "2026-10-18", end_date: "2026-10-19", span_days: 2 });
        expect(computeProgrammePlan(null, datedPhases(), sixDays())).toBeNull();
        expect(computeProgrammePlan(FRIDAY, relativePhases(), sixDays())).toBeNull();
        expect(computeProgrammePlan(FRIDAY, [{ programmeIntent: "omit" }], sixDays())).toBeNull();
        const partial = computeProgrammePlan(FRIDAY, [...datedPhases(), { name: "No duration" }], sixDays())!;
        expect(partial.stages).toHaveLength(1);
    });

    it.each([
        false, "Mon-Sat", {}, { version: 2, weekdays: [1] }, { version: 1, weekdays: [] },
        { version: 1, weekdays: [1, 1] }, { version: 1, weekdays: [7] },
        { version: 1, weekdays: [1.5] }, { version: 1, weekdays: ["1"] },
        { version: 1, weekdays: [1], hours: 8 },
    ])("fails closed for a malformed explicit pattern: %j", pattern => {
        expect(resolveJobWorkingPattern(pattern)).toBeNull();
        expect(computeProgrammePlan(FRIDAY, datedPhases(), pattern)).toBeNull();
        expect(computeDisplayProgramme(FRIDAY, relativePhases(), pattern)).toBeNull();
        expect(computeRelativeProgramme(relativePhases(), pattern)).toBeNull();
        expect(formatWorkingDuration(5, pattern)).toBe("");
        const input = representativeInput();
        input.project.programme_working_pattern = pattern;
        expect(() => buildProposalPublicationSnapshot(input)).toThrow(PROGRAMME_REQUIRED_ERROR);
    });

    it("rejects unsafe dates and duration overflow without throwing or inventing dates", () => {
        expect(addWorkingDays("9999-12-31", 2)).toBeNull();
        expect(nextWorkingDayAfter("9999-12-31")).toBeNull();
        expect(addWorkingDays(FRIDAY, Number.MAX_VALUE)).toBeNull();
        expect(formatWorkingDuration(Number.POSITIVE_INFINITY, sixDays())).toBe("");
        for (const phase of [
            { name: "Overflow", manualDays: Number.MAX_VALUE },
            { name: "Overflow", manualDays: 2, startOffset: Number.MAX_VALUE },
            { name: "Overflow", start_date: "9999-12-31", duration_days: 2 },
        ]) expect(computeProgrammePlan(FRIDAY, [phase], sixDays())).toBeNull();
        expect(computeProgrammePlan("2026-02-30", datedPhases(), sixDays())).toBeNull();
    });

    it("keeps complete-phase publication checks and the explicit omission decision unchanged", () => {
        const input = representativeInput();
        input.project = { ...input.project, start_date: FRIDAY, programme_working_pattern: sixDays(), programme_phases: [
            ...datedPhases(), { name: "No duration" },
        ] };
        expect(() => buildProposalPublicationSnapshot(input)).toThrow(PROGRAMME_INCOMPLETE_ERROR);
        input.project.programme_phases = [...datedPhases(), { programmeIntent: "omit", intent_version: 1 }];
        input.project.programme_working_pattern = { version: 1, weekdays: [] };
        const omitted = buildProposalPublicationSnapshot(input);
        expect(omitted.programme_intent).toBe("omit");
        expect(omitted.programme).toEqual([]);
        expect(omitted).not.toHaveProperty("programme_plan");
        expect(omitted.project.start_date).toBeNull();
    });

    it("keeps custom relative Day ranges undated with selected-week labels through HTML and local PDF", () => {
        const plan = computeDisplayProgramme("2026-10-19", relativePhases(), sixDays())!;
        expect(plan).toMatchObject({ basis: "relative_working_days", working_pattern: sixDays(), working_days: 8 });
        expect(plan).not.toHaveProperty("start_date");
        expect(plan).not.toHaveProperty("end_date");
        expect(plan).not.toHaveProperty("calendar_days");
        expect(programmeAxisLabels(plan)).toEqual(["Day 1", "Day 8"]);
        expect(programmeStageRange(plan, 1)).toBe("Day 3 to Day 8");
        expect(programmeBasisNote(plan)).toContain("Day numbers count working days, not calendar dates.");
        expect(programmeBasisNote(plan)).toContain("A week means 6 working days.");
        expect(computeDisplayProgramme(null, [{ name: "Unmarked", manualDays: 6 }], sixDays())).toBeNull();
        expect(computeRelativeProgramme([
            relativePhases()[0], { ...relativePhases()[1], workingDayOffset: 3 },
        ], sixDays())).toBeNull();
        const input = representativeInput();
        input.project = { ...input.project, programme_phases: relativePhases(), programme_working_pattern: sixDays() };
        const snapshot = buildProposalPublicationSnapshot(input);
        expect(snapshot.project.start_date).toBeNull();
        expect(snapshot.programme.every(stage => stage.start_date === null)).toBe(true);
        const doc = buildProposalDocument(JSON.parse(JSON.stringify(snapshot)), { isDraft: true });
        const html = renderToStaticMarkup(createElement(ProposalDocumentView, { doc }));
        const raw = renderProposalBrochure(doc, new Map()).doc.output();
        for (const text of ["Day 3 to Day 8", "Start date not agreed", "1 week", "6 working days."]) {
            expect(html).toContain(text);
            expect(raw).toContain(text);
        }
        expect(html).not.toContain("five working days");
        expect(raw).not.toContain("five working days");
    });

    it("freezes a cloned pattern and computed plan for consistent snapshot, overview, HTML and local PDF", () => {
        const pattern = sixDays();
        const input = representativeInput();
        input.project = { ...input.project, start_date: FRIDAY, programme_working_pattern: pattern, programme_phases: [
            ...datedPhases(), { name: "Week stage", manualDays: 6, calculatedDays: 99, startOffset: 3 },
        ] };
        const snapshot = buildProposalPublicationSnapshot(input);
        const plan = snapshot.programme_plan!;
        expect(plan).toMatchObject({ basis: "job_working_days", start_date: FRIDAY, end_date: "2026-10-24", working_days: 8, duration_label: "8 working days" });
        expect(snapshot.programme.map(stage => stage.start_date)).toEqual([FRIDAY, "2026-10-19"]);
        expect(plan.working_pattern).not.toBe(pattern);
        expect(plan.working_pattern?.weekdays).not.toBe(pattern.weekdays);
        expect(Object.isFrozen(plan)).toBe(true);
        expect(Object.isFrozen(plan.stages)).toBe(true);
        expect(plan.stages.every(Object.isFrozen)).toBe(true);
        expect(Object.isFrozen(plan.working_pattern)).toBe(true);
        expect(Object.isFrozen(plan.working_pattern?.weekdays)).toBe(true);
        const recorded = JSON.stringify(snapshot);
        pattern.weekdays.splice(0, pattern.weekdays.length, 1);
        input.project.start_date = "2027-01-01";
        expect(JSON.stringify(snapshot)).toBe(recorded);
        const doc = buildProposalDocument(JSON.parse(recorded), { isDraft: true });
        const html = renderToStaticMarkup(createElement(ProposalDocumentView, { doc }));
        const overview = renderToStaticMarkup(createElement(ProgrammeOverview, { plan, isDark: false }));
        const raw = renderProposalBrochure(doc, new Map()).doc.output();
        for (const text of ["16 Oct to 17 Oct 2026", "19 Oct to 24 Oct 2026", "1 week", "6 working days."]) {
            expect(html).toContain(text);
            expect(overview).toContain(text);
            expect(raw).toContain(text);
        }
        expect(html).not.toContain(PROGRAMME_BASIS_NOTE);
        expect(overview).not.toContain(PROGRAMME_BASIS_NOTE);
        expect(raw).not.toContain("Monday to Friday");
        expect(html).toContain("Bank holidays are not allowed for.");
        expect(overview).toContain("Bank holidays are not allowed for.");
        // jsPDF may wrap the disclosure across separate text operations.
        expect(raw).toMatch(/Bank[\s\S]{0,120}holidays[\s\S]{0,120}are[\s\S]{0,120}not[\s\S]{0,120}allowed[\s\S]{0,120}for\./);
        expect(JSON.stringify(snapshot)).toBe(recorded);
    });

    it("never reinterprets an older frozen legacy plan after the source pattern changes", () => {
        const input = representativeInput();
        input.project = { ...input.project, start_date: FRIDAY, programme_phases: datedPhases() };
        const snapshot = buildProposalPublicationSnapshot(input);
        const recorded = JSON.stringify(snapshot);
        expect(snapshot.programme_plan).not.toHaveProperty("working_pattern");
        input.project.programme_working_pattern = sixDays();
        expect(buildProposalPublicationSnapshot(input).programme_plan?.end_date).toBe("2026-10-17");
        const doc = buildProposalDocument(JSON.parse(recorded), { isDraft: true });
        const html = renderToStaticMarkup(createElement(ProposalDocumentView, { doc }));
        const raw = renderProposalBrochure(doc, new Map()).doc.output();
        expect(html).toContain("16 Oct to 19 Oct 2026");
        expect(html).toContain(PROGRAMME_BASIS_NOTE);
        expect(raw).toContain("16 Oct to 19 Oct 2026");
        expect(raw).toContain("Monday to Friday");
        expect(JSON.stringify(snapshot)).toBe(recorded);
    });
});
