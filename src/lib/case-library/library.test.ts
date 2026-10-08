import { describe, expect, it } from "vitest";
import { BRIEF_TRADES } from "@/lib/guided-brief";
import { selectCaseStudies } from "@/lib/proposal-publication";
import { approvedValue, contentProblem, newDraft, type CaseStudyContent } from "./content";
import { CANONICAL_WORK_NAMES, DISCIPLINE_LIMITS, cleanLabel, groupByTag, labelKey, suggestDisciplines, type TaggedStudy } from "./labels";
import { draftFromLegacy, legacyCaseStudies, legacyIdentityProblems } from "./legacy";
import { LIBRARY_TICK_PREFIX, libraryTick, resolveSelectedCaseStudies, type LibraryRow } from "./resolve";

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const older = (id: string | undefined, projectName: string, extra: Record<string, unknown> = {}) => ({ ...(id === undefined ? {} : { id }), projectName, projectType: "Refurbishment", client: "Mrs Older", location: "Leeds", whatWeDelivered: `${projectName} delivered.`, valueAdded: "", photos: [], ...extra });
const OLDER = [older("cs-a", "Kitchen"), older(undefined, "Loft"), older("cs-c", "Bathroom"), older("", "Porch"), older("cs-e", "")];

const content = (title: string, overrides: Partial<CaseStudyContent> = {}): CaseStudyContent => ({ ...newDraft(title), work_type: "Kitchen Installation", place: "Leeds", delivered: `${title} delivered.`, ...overrides });
const row = (n: number, options: { approved?: CaseStudyContent | null; labels?: string[]; archived?: boolean; user?: string; rawApproved?: unknown } = {}): LibraryRow => {
    const approved = options.rawApproved !== undefined ? options.rawApproved : options.approved === null ? null : approvedValue(options.approved ?? content(`Library ${n}`), options.labels ?? ["Kitchen Installation"]);
    return { id: uuid(n), user_id: options.user ?? ME, approved, approved_revision: approved === null ? null : 3, archived_at: options.archived ? "2026-10-01T00:00:00Z" : null };
};
const resolve = (selected: unknown[], libraryRows: LibraryRow[] = [], olderStored: unknown[] | null = OLDER) => resolveSelectedCaseStudies({ userId: ME, olderStored, libraryRows, selected });

describe("older case studies are described as the product treats them today", () => {
    it("an entry is known by its place and, if it has one, its id", () => {
        expect(legacyCaseStudies(OLDER)).toEqual([
            { index: 0, id: "cs-a", selectionId: "cs-a", title: "Kitchen", workType: "Refurbishment", matchedBy: ["0", "cs-a"] },
            { index: 1, id: null, selectionId: "1", title: "Loft", workType: "Refurbishment", matchedBy: ["1"] },
            { index: 2, id: "cs-c", selectionId: "cs-c", title: "Bathroom", workType: "Refurbishment", matchedBy: ["2", "cs-c"] },
            // An empty id is no id. An entry without a title is not offered, but still holds its place.
            { index: 3, id: null, selectionId: "3", title: "Porch", workType: "Refurbishment", matchedBy: ["3"] },
        ]);
        for (const nothing of [null, undefined, "text", {}, 7]) expect(legacyCaseStudies(nothing)).toEqual([]);
        expect(legacyCaseStudies([null, "x", 5, [], { projectName: "  Real  " }])).toEqual([{ index: 4, id: null, selectionId: "4", title: "Real", workType: "", matchedBy: ["4"] }]);
    });

    it("what a saved value includes is exactly what publication includes for it", () => {
        for (const entry of legacyCaseStudies(OLDER)) {
            for (const tick of entry.matchedBy) expect(selectCaseStudies(OLDER, [tick]).map((study) => study.title), `${tick}`).toContain(entry.title);
        }
    });

    it("reports, and does not repair, shared ids and an id that is another entry's place", () => {
        const shared = [older("dup", "First"), older("dup", "Second"), older("0", "Third")];
        expect(legacyIdentityProblems(shared)).toEqual([
            { kind: "shared-id", value: "dup", indexes: [0, 1] },
            { kind: "id-is-another-place", value: "0", indexes: [0, 2] },
        ]);
        // Today's behaviour for those values, which the adapter leaves alone:
        expect(selectCaseStudies(shared, ["dup"]).map((study) => study.title)).toEqual(["First", "Second"]);
        expect(selectCaseStudies(shared, ["0"]).map((study) => study.title)).toEqual(["First", "Third"]);
        expect(legacyIdentityProblems(OLDER)).toEqual([]);
        // An entry whose id is its own place is not a problem.
        expect(legacyIdentityProblems([older("0", "Only")])).toEqual([]);
    });

    it("a draft made from an older entry carries the words, hides the client, shows no figure and takes no pictures", () => {
        const draft = draftFromLegacy(older("cs-a", "  Kitchen  ", { client: "Mrs Named", contractValue: "£20,000", programmeDuration: "4 weeks", photos: ["https://elsewhere.example/a.jpg"], valueAdded: "Stayed at home.\r\nNo dust." }));
        expect(contentProblem(draft)).toBeNull();
        expect(draft).toMatchObject({ title: "Kitchen", work_type: "Refurbishment", place: "Leeds", client_display: "hidden", client_text: "Mrs Named", client_named_ok: false, value_text: "£20,000", show_value: false, duration_text: "4 weeks", value_added: "Stayed at home.\nNo dust." });
        expect(JSON.stringify(draft)).not.toContain("elsewhere.example");
        const approved = approvedValue(draft, []);
        expect(JSON.stringify(approved)).not.toContain("Mrs Named");
        expect(JSON.stringify(approved)).not.toContain("20,000");
        // Over-long older text is cut to what a draft can hold, so the draft can be saved and then edited.
        expect(contentProblem(draftFromLegacy(older("x", "t".repeat(400), { whatWeDelivered: "d".repeat(9000) })))).toBeNull();
        expect(contentProblem(draftFromLegacy(null))).toBe("title");
    });
});

describe("discipline labels and suggestions", () => {
    it("tidies what is typed, and refuses what cannot be a label", () => {
        expect(cleanLabel("  Kitchen \t  fitting \n")).toBe("Kitchen fitting");
        expect(cleanLabel("k".repeat(81))).toBeNull();
        for (const bad of ["", "   ", null, 7, undefined]) expect(cleanLabel(bad)).toBeNull();
    });

    it("offers the setup answer's pieces once, bounded, without what the contractor already has", () => {
        expect(suggestDisciplines("Kitchen and bathroom fitting, Tiling,  , tiling, ROOFING", ["Roofing"])).toEqual(["Kitchen and bathroom fitting", "Tiling"]);
        expect(suggestDisciplines(Array.from({ length: 40 }, (_, index) => `Trade ${index}`).join(","))).toHaveLength(DISCIPLINE_LIMITS.suggestions);
        expect(suggestDisciplines("x".repeat(5000))).toEqual([]);
        for (const nothing of [null, undefined, 5, ""]) expect(suggestDisciplines(nothing)).toEqual([]);
    });

    it("the names the product already uses are available to choose from", () => {
        for (const name of ["Kitchen Installation", "Tiling", "Loft Conversion", "Roofing"]) expect(CANONICAL_WORK_NAMES).toContain(name);
        expect(CANONICAL_WORK_NAMES).not.toContain("Other");
        expect(CANONICAL_WORK_NAMES).not.toContain("default");
        expect(new Set(CANONICAL_WORK_NAMES).size).toBe(CANONICAL_WORK_NAMES.length);
        for (const trade of BRIEF_TRADES) expect(CANONICAL_WORK_NAMES).toContain(trade);
    });
});

describe("grouping by tag never selects, and never guesses", () => {
    const study = (id: string, labels: string[], ids: string[] = labels.map((label) => `d-${labelKey(label)}`)): TaggedStudy => ({ id, labels, disciplineIds: ids });
    const kitchen = study("kitchen", ["Kitchen Installation"]);
    const freeText = study("free", ["Kitchen and bathroom fitting"]);
    const framing = study("framing", ["Timber framing"]);
    const both = study("both", ["Roofing", "Kitchen Installation"]);
    const untagged = study("none", []);
    const all = [kitchen, freeText, framing, both, untagged];
    const ids = (list: TaggedStudy[]) => list.map((entry) => entry.id);

    it("with a job that carries a canonical name, only exact names match", () => {
        const groups = groupByTag({ studies: all, jobSignals: ["Kitchen Installation", "Tiling"] });
        expect(groups.basis).toBe("job");
        expect(ids(groups.tagged)).toEqual(["kitchen", "both"]);
        // The contractor's own words for kitchens do not match the product's name for them. Honest, and expected.
        expect(ids(groups.other)).toEqual(["free", "framing"]);
        expect(ids(groups.notTagged)).toEqual(["none"]);
    });

    it("real mismatched vocabulary gives an empty group, not a near match", () => {
        const groups = groupByTag({ studies: [freeText, framing, untagged], jobSignals: ["Bathroom Installation", "Kitchen Installation", "Full Kitchen"] });
        expect(groups.tagged).toEqual([]);
        expect(ids(groups.other)).toEqual(["free", "framing"]);
        // "kitchen" inside a longer label, and a different case of a different word, are not matches.
        expect(groupByTag({ studies: [study("k", ["Kitchen"])], jobSignals: ["Kitchen Installation"] }).tagged).toEqual([]);
        expect(groupByTag({ studies: [study("k", ["kitchen   INSTALLATION"])], jobSignals: ["Kitchen Installation"] }).tagged).toHaveLength(1);
    });

    it("a framing case study is never put forward for a kitchen fit-out", () => {
        const groups = groupByTag({ studies: [framing], jobSignals: ["Kitchen Installation", "Full Kitchen", "Joinery & Carpentry"] });
        expect(groups.tagged).toEqual([]);
    });

    it("chips the contractor taps decide, whatever the job says, and work with free-text disciplines", () => {
        const groups = groupByTag({ studies: all, jobSignals: ["Roofing"], chosenDisciplineIds: ["d-kitchen and bathroom fitting"] });
        expect(groups.basis).toBe("chips");
        expect(ids(groups.tagged)).toEqual(["free"]);
        expect(ids(groups.other)).toEqual(["kitchen", "framing", "both"]);
    });

    it("with nothing to go on, nothing is put forward", () => {
        const groups = groupByTag({ studies: all, jobSignals: [null, "", 5, "   "] });
        expect(groups.basis).toBe("none");
        expect(groups.tagged).toEqual([]);
        expect(ids(groups.notTagged)).toEqual(["none"]);
        expect(groups.other).toHaveLength(4);
    });

    it("every study lands in exactly one group, and the result carries no selection", () => {
        const groups = groupByTag({ studies: all, jobSignals: ["Kitchen Installation"] });
        expect([...groups.tagged, ...groups.other, ...groups.notTagged].map((entry) => entry.id).sort()).toEqual(ids(all).sort());
        expect(Object.keys(groups).sort()).toEqual(["basis", "notTagged", "other", "tagged"]);
    });
});

describe("resolving saved ticks: today's result when no library tick is involved", () => {
    const SELECTIONS: unknown[][] = [
        [], ["cs-a"], ["1"], [1], ["cs-a", "cs-c"], ["cs-c", "cs-a"], ["0", "cs-a"], ["3"], ["4"], ["cs-e"], ["nope"], ["99"], ["01"], [" 1"], [null, undefined, 2],
        [uuid(1)], ["cs-a", uuid(1)], ["0", "1", "2", "3"],
    ];

    it.each(SELECTIONS.map((selection) => [JSON.stringify(selection), selection] as const))("selection %s", (_label, selection) => {
        const expected = selectCaseStudies(OLDER, selection);
        for (const libraryRows of [[], [row(1), row(2, { approved: null }), row(3, { archived: true })]]) {
            const result = resolve(selection, libraryRows);
            expect(result.sendable).toBe(true);
            if (result.sendable) {
                expect(result.studies).toEqual(expected);
                expect(result.sources).toEqual(expected.map(() => ({ kind: "older" })));
            }
        }
    });

    it("is today's result for missing, empty and malformed stored lists too", () => {
        for (const stored of [null, undefined, [], "text", [null, 5]] as never[]) {
            for (const selection of [["0"], ["cs-a"], []]) {
                const result = resolveSelectedCaseStudies({ userId: ME, olderStored: stored, libraryRows: [row(1)], selected: selection });
                expect(result).toMatchObject({ sendable: true, studies: selectCaseStudies(stored, selection) });
            }
        }
        expect(resolveSelectedCaseStudies({ userId: ME, olderStored: OLDER, libraryRows: [], selected: null })).toMatchObject({ sendable: true, studies: [] });
    });

    it("a bare uuid is always an older tick: a library row with that id does not take it over", () => {
        const stored = [older(uuid(1), "Older with a uuid id")];
        const result = resolve([uuid(1)], [row(1)], stored);
        expect(result).toMatchObject({ sendable: true });
        if (result.sendable) expect(result.studies.map((study) => study.title)).toEqual(["Older with a uuid id"]);
        // And with no older entry of that id it selects nothing, as today. The library row is not reached.
        expect(resolve([uuid(1)], [row(1)])).toMatchObject({ sendable: true, studies: [] });
    });

    it("says which older ticks matched nothing, without changing today's result", () => {
        const result = resolve(["cs-a", "nope", "99", "01"]);
        expect(result.sendable && result.unmatchedOlderTicks).toEqual(["nope", "99", "01"]);
        expect(result.sendable && result.studies.map((study) => study.title)).toEqual(["Kitchen"]);
    });

    it("an older entry whose own id happens to have the prefix keeps working as today", () => {
        const odd = `${LIBRARY_TICK_PREFIX}my-own-id`;
        const stored = [older(odd, "Oddly named older entry")];
        const result = resolve([odd], [], stored);
        expect(result).toMatchObject({ sendable: true });
        if (result.sendable) expect(result.studies).toEqual(selectCaseStudies(stored, [odd]));
    });
});

describe("resolving saved ticks: library ticks", () => {
    it("an approved study is sent from its approved copy, after the older ones, with its labels by value", () => {
        const approved = content("Library kitchen", { client_display: "described", client_text: "a homeowner in Leeds", show_value: true, value_text: "£18,500", duration_text: "3 weeks", value_added: "No dust." });
        const result = resolve(["cs-a", libraryTick(uuid(1))], [row(1, { approved, labels: ["Kitchen Installation", "Tiling"] })]);
        expect(result.sendable).toBe(true);
        if (!result.sendable) return;
        expect(result.studies.map((study) => study.title)).toEqual(["Kitchen", "Library kitchen"]);
        expect(result.studies[1]).toEqual({ title: "Library kitchen", project_type: "Kitchen Installation", location: "Leeds", client: "a homeowner in Leeds", contract_value: "£18,500", duration: "3 weeks", delivered: "Library kitchen delivered.", value_added: "No dust.", photos: [] });
        expect(result.sources).toEqual([{ kind: "older" }, { kind: "library", id: uuid(1), approvedRevision: 3, disciplines: ["Kitchen Installation", "Tiling"] }]);
    });

    it("a hidden client and an unshown figure never reach the proposal", () => {
        const hidden = content("Private job", { client_text: "Mrs Private", value_text: "£9,000" });
        const result = resolve([libraryTick(uuid(1))], [row(1, { approved: hidden })]);
        expect(result.sendable && result.studies[0]).toMatchObject({ client: null, contract_value: null });
        expect(JSON.stringify(result)).not.toContain("Mrs Private");
        // Even if a stored approved copy were tampered with to carry them, it is refused, not sent.
        const tampered = { ...approvedValue(hidden, []), client_text: "Mrs Private" };
        expect(resolve([libraryTick(uuid(1))], [row(1, { rawApproved: tampered })])).toEqual({ sendable: false, studies: [], problems: [{ tick: libraryTick(uuid(1)), reason: "library-approved-invalid" }] });
    });

    it.each([
        ["a draft that was never approved", [row(1, { approved: null })], "library-not-approved"],
        ["an archived study", [row(1, { archived: true })], "library-archived"],
        ["a study that does not exist, or is not this contractor's", [row(2)], "library-missing"],
        ["no library rows at all", [], "library-missing"],
        ["an approved copy that is not well formed", [row(1, { rawApproved: { title: "x" } })], "library-approved-invalid"],
    ] as const)("%s cannot be sent, and says so", (_label, rows, reason) => {
        const result = resolve(["cs-a", libraryTick(uuid(1))], [...rows]);
        expect(result).toEqual({ sendable: false, studies: [], problems: [{ tick: libraryTick(uuid(1)), reason }] });
    });

    it("a malformed library tick cannot be sent", () => {
        for (const tick of ["lib:", "lib:not-a-uuid", `lib:${uuid(1)}x`, `lib:${uuid(1).toUpperCase()}Z`]) {
            expect(resolve([tick], [row(1)]), tick).toEqual({ sendable: false, studies: [], problems: [{ tick, reason: "library-tick-malformed" }] });
        }
    });

    it("one unsendable tick withholds everything, so nothing is published short", () => {
        const result = resolve(["cs-a", libraryTick(uuid(1)), libraryTick(uuid(2))], [row(1), row(2, { approved: null })]);
        expect(result).toEqual({ sendable: false, studies: [], problems: [{ tick: libraryTick(uuid(2)), reason: "library-not-approved" }] });
    });

    it("rows belonging to another contractor are refused outright, whatever is ticked", () => {
        const result = resolve(["cs-a"], [row(1), row(2, { user: OTHER })]);
        expect(result).toEqual({ sendable: false, studies: [], problems: [{ tick: libraryTick(uuid(2)), reason: "library-row-not-yours" }] });
    });

    it("an older entry whose id is the same value as a library tick is ambiguous: nobody is chosen for the contractor", () => {
        const tick = libraryTick(uuid(1));
        const stored = [older(tick, "Older entry with a colliding id")];
        expect(resolve([tick], [row(1)], stored)).toEqual({ sendable: false, studies: [], problems: [{ tick, reason: "ambiguous-with-older-entry" }] });
    });

    it("more than six in all is said, not cut", () => {
        const rows = [1, 2, 3, 4].map((n) => row(n));
        const result = resolve(["cs-a", "1", "cs-c", ...rows.map((entry) => libraryTick(entry.id))], rows);
        expect(result).toMatchObject({ sendable: false, problems: [{ reason: "too-many" }] });
        expect(resolve(["cs-a", "1", "cs-c", ...rows.slice(0, 3).map((entry) => libraryTick(entry.id))], rows)).toMatchObject({ sendable: true });
    });

    it("the same library tick twice is one case study", () => {
        const result = resolve([libraryTick(uuid(1)), libraryTick(uuid(1))], [row(1)]);
        expect(result.sendable && result.studies).toHaveLength(1);
    });

    it("editing the draft or the live tags after approval changes nothing that is sent", () => {
        const approvedRow = row(1, { approved: content("As approved"), labels: ["Kitchen Installation"] });
        const before = resolve([libraryTick(uuid(1))], [approvedRow]);
        // The resolver is given only the approved copy: there is no draft or live tag for it to read.
        expect(Object.keys(approvedRow).sort()).toEqual(["approved", "approved_revision", "archived_at", "id", "user_id"]);
        expect(resolve([libraryTick(uuid(1))], [{ ...approvedRow }])).toEqual(before);
    });
});
