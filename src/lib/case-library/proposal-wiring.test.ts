import { describe, expect, it } from "vitest";
import { representativeInput } from "@/lib/__fixtures__/proposal";
import { CASE_STUDY_UNSENDABLE_ERROR, buildProposalPublicationSnapshot, canonicalProposalPublicationJson, hashProposalContent, hashProposalPublication, selectCaseStudies, type BuildProposalPublicationInput } from "@/lib/proposal-publication";
import { evaluateProposalReadiness } from "@/lib/proposal-readiness";
import { buildPreviewSnapshot, draftFromProject, reviewReadiness, type ReviewContext } from "@/lib/proposal-review";
import { approvedValue, newDraft, type CaseStudyContent } from "./content";
import { buildPastJobs, type ProposalLibrary } from "./past-jobs";
import { libraryTick, type LibraryRow } from "./resolve";

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const older = (id: string | undefined, name: string) => ({ ...(id === undefined ? {} : { id }), projectName: name, projectType: "Refurb", client: "Mrs Older", location: "Leeds", whatWeDelivered: `${name} delivered.`, valueAdded: "", photos: [] });
const SEVEN = [older("o1", "Older 1"), older("o2", "Older 2"), older("o3", "Older 3"), older("o4", "Older 4"), older("o5", "Older 5"), older("o6", "Older 6"), older("o7", "Older 7")];
const content = (title: string, extra: Partial<CaseStudyContent> = {}): CaseStudyContent => ({ ...newDraft(title), work_type: "Kitchen Installation", delivered: `${title} delivered.`, ...extra });
const approvedRow = (n: number, extra: Partial<CaseStudyContent> = {}, labels = ["Kitchen Installation"]): LibraryRow => ({ id: uuid(n), user_id: ME, approved: approvedValue(content(`Library ${n}`, extra), labels), approved_revision: 4, archived_at: null });
const library = (rows: LibraryRow[], extra: Partial<ProposalLibrary> = {}): ProposalLibrary => ({ userId: ME, rows, legacyIndexById: {}, available: true, unapproved: 0, ...extra });

function input(stored: unknown, selected: unknown, lib?: ProposalLibrary): BuildProposalPublicationInput {
    const base = representativeInput();
    return { ...base, profile: { ...base.profile, case_studies: stored as never }, project: { ...base.project, selected_case_study_ids: selected as never }, ...(lib ? { caseStudyLibrary: { userId: lib.userId, rows: lib.rows } } : {}) };
}
function context(stored: unknown, selected: unknown, lib?: ProposalLibrary): ReviewContext {
    const built = input(stored, selected);
    return { project: built.project as never, profile: built.profile, estimate: built.estimate, nextVersion: 1, ...(lib ? { caseStudyLibrary: lib } : {}) };
}
const draftOf = (ctx: ReviewContext) => draftFromProject(ctx.project, () => "key");

describe("older-only proposals are exactly as they were", () => {
    // Hashes of the representative fixture's snapshot as built by the accepted code at 63ca10f, before this wiring.
    it("the representative proposal's content and snapshot hashes are unchanged", async () => {
        const snapshot = buildProposalPublicationSnapshot(representativeInput());
        expect(await hashProposalContent(snapshot)).toBe("c2f49cabb4771dbb6810ea0896a3ab8413040a309097032b903cbc3010442e61");
        expect(await hashProposalPublication(snapshot)).toBe("bea30af8126b29ec39653032105dc9b889c435bcccf251ad7396c6bed5f2aa1d");
    });

    it.each([[[]], [["o1"]], [["1"]], [[2, "o5"]], [["o1", "o2", "o3", "o4", "o5", "o6", "o7"]], [["nope"]], [null], [["o7", "o1"]]])("selection %j: the case studies are today's selection, with no library, an empty one, or a full one", (selected) => {
        const expected = selectCaseStudies(SEVEN, selected as never);
        const plain = buildProposalPublicationSnapshot(input(SEVEN, selected));
        expect(plain.case_studies).toEqual(expected);
        for (const lib of [library([]), library([approvedRow(1), approvedRow(2)])]) {
            expect(canonicalProposalPublicationJson(buildProposalPublicationSnapshot(input(SEVEN, selected, lib)))).toBe(canonicalProposalPublicationJson(plain));
        }
    });

    it("readiness gains no new row unless something chosen cannot be sent", () => {
        const ctx = context(SEVEN, ["o1"]);
        const readiness = reviewReadiness(ctx, draftOf(ctx));
        expect(readiness.mandatory.map((item) => item.key)).toEqual(["identity", "scope", "contractValue", "programme", "payment", "terms"]);
        expect(evaluateProposalReadiness({ caseStudySelectionProblem: "  " }).mandatory.some((item) => item.key === "caseStudySelection")).toBe(false);
    });

    it("having no past jobs at all never blocks a proposal", () => {
        const ctx = context([], []);
        expect(reviewReadiness(ctx, draftOf(ctx)).missing.map((item) => item.key)).not.toContain("caseStudySelection");
        expect(() => buildProposalPublicationSnapshot(input([], []))).not.toThrow();
        expect(buildPastJobs({ olderStored: null, selected: null })).toMatchObject({ blocked: null, cannotSend: [], notes: [], library: [] });
    });
});

describe("an approved library case study: the same thing previewed and sent", () => {
    const lib = library([approvedRow(1, { client_text: "Mrs Private", value_text: "£9,000", place: "Leeds", duration_text: "3 weeks", value_added: "No dust." })]);
    const selected = ["o2", libraryTick(uuid(1))];

    it("the browser's preview and the server's publication build identical content", async () => {
        const ctx = context(SEVEN, selected, lib);
        const preview = buildPreviewSnapshot(ctx, draftOf(ctx), "acknowledgement", "2026-10-05T09:00:00.000Z");
        const published = buildProposalPublicationSnapshot({ ...input(SEVEN, selected, lib), publicationId: "33333333-3333-4333-8333-333333333333" });
        expect(preview).not.toBeNull();
        expect(await hashProposalContent(preview!)).toBe(await hashProposalContent(published));
        expect(published.case_studies).toEqual(preview!.case_studies);
        expect(published.case_studies!.map((study) => study.title)).toEqual(["Older 2", "Library 1"]);
    });

    it("carries the approved values only: a hidden client and an unshown price are not in the snapshot at all", () => {
        const snapshot = buildProposalPublicationSnapshot(input(SEVEN, selected, lib));
        expect(snapshot.case_studies![1]).toEqual({ title: "Library 1", project_type: "Kitchen Installation", location: "Leeds", client: null, contract_value: null, duration: "3 weeks", delivered: "Library 1 delivered.", value_added: "No dust.", photos: [] });
        expect(JSON.stringify(snapshot)).not.toContain("Mrs Private");
        expect(JSON.stringify(snapshot)).not.toContain("9,000");
    });

    it("a change to the approved copy between preview and send changes the hash, so the send is refused as changed", async () => {
        const ctx = context(SEVEN, selected, lib);
        const preview = buildPreviewSnapshot(ctx, draftOf(ctx), "acknowledgement", "2026-10-05T09:00:00.000Z")!;
        const reapproved = library([approvedRow(1, { delivered: "Re-approved with different words." })]);
        const fresh = buildProposalPublicationSnapshot(input(SEVEN, selected, reapproved));
        expect(await hashProposalContent(fresh)).not.toBe(await hashProposalContent(preview));
    });
});

describe("a chosen library case study that cannot be honoured blocks sending; it is never dropped", () => {
    const tick = libraryTick(uuid(1));
    const stub = (extra: Partial<LibraryRow>): LibraryRow => ({ id: uuid(1), user_id: ME, approved: null, approved_revision: null, archived_at: null, ...extra });

    it.each([
        ["the library switched off (nothing passed to the builder)", undefined, /isn't available right now/],
        ["the library's tables missing", library([], { available: false }), /isn't available right now/],
        ["the case study gone", library([approvedRow(2)]), /no longer available/],
        ["the case study not approved", library([stub({})]), /isn't approved/],
        ["the case study archived", library([stub({ archived_at: "2026-10-01T00:00:00Z", approved_revision: 3 })]), /has been archived/],
        ["an approved copy that cannot be read", library([stub({ approved: { title: "x" }, approved_revision: 2 })]), /can't be read/],
    ] as const)("%s", (_label, lib, said) => {
        expect(() => buildProposalPublicationSnapshot(input(SEVEN, ["o1", tick], lib))).toThrow(CASE_STUDY_UNSENDABLE_ERROR);

        const ctx = context(SEVEN, ["o1", tick], lib);
        const readiness = reviewReadiness(ctx, draftOf(ctx));
        expect(readiness.ready).toBe(false);
        expect(readiness.missing.map((item) => item.key)).toContain("caseStudySelection");

        const jobs = buildPastJobs({ olderStored: SEVEN, selected: ["o1", tick], library: lib });
        expect(jobs.cannotSend).toHaveLength(1);
        expect(jobs.cannotSend[0].tick).toBe(tick);
        expect(jobs.cannotSend[0].message).toMatch(said);
        expect(jobs.blocked).toBe("One past job you chose can't be sent. See below.");
        // The preview shows no case studies rather than a proposal quietly missing one.
        expect(buildPreviewSnapshot(ctx, draftOf(ctx), "acknowledgement", "2026-10-05T09:00:00.000Z")!.case_studies).toEqual([]);
    });

    it("rows for another contractor are refused outright", () => {
        const foreign = library([{ ...approvedRow(1), user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }]);
        expect(() => buildProposalPublicationSnapshot(input(SEVEN, [tick], foreign))).toThrow(CASE_STUDY_UNSENDABLE_ERROR);
        expect(buildPastJobs({ olderStored: SEVEN, selected: [tick], library: foreign }).blocked).not.toBeNull();
    });

    it("unticking it clears the block", () => {
        const ctx = context(SEVEN, ["o1"], library([]));
        expect(reviewReadiness(ctx, draftOf(ctx)).missing.map((item) => item.key)).not.toContain("caseStudySelection");
    });
});

describe("counting past jobs by what would really be shown", () => {
    it("the product keeps the first six older case studies: seven ticked is six shown, and that is now said", () => {
        const all = SEVEN.map((entry) => entry.id as string);
        expect(selectCaseStudies(SEVEN, all)).toHaveLength(6);
        const jobs = buildPastJobs({ olderStored: SEVEN, selected: all, library: library([approvedRow(1)]) });
        expect(jobs).toMatchObject({ olderMatched: 7, olderShown: 6, libraryChosen: 0, blocked: null });
        expect(jobs.notes).toEqual(["Your ticks match 7 older case studies. A proposal shows the first 6 of them, in the order they are saved; the rest are left out."]);
        expect(buildProposalPublicationSnapshot(input(SEVEN, all, library([approvedRow(1)]))).case_studies!.map((study) => study.title)).toEqual(["Older 1", "Older 2", "Older 3", "Older 4", "Older 5", "Older 6"]);
    });

    it("seven older plus one new is blocked, with the real numbers", () => {
        const selected = [...SEVEN.map((entry) => entry.id as string), libraryTick(uuid(1))];
        const lib = library([approvedRow(1)]);
        const jobs = buildPastJobs({ olderStored: SEVEN, selected, library: lib });
        expect(jobs.blocked).toBe("You've chosen 7 past jobs to show (6 older and 1 new). A proposal shows up to 6. Untick 1. Only 6 of your 7 older ones are counted, because only 6 are ever shown.");
        expect(jobs.cannotSend).toEqual([]);
        expect(() => buildProposalPublicationSnapshot(input(SEVEN, selected, lib))).toThrow(CASE_STUDY_UNSENDABLE_ERROR);
        // Five older and one new fits.
        const fits = [...SEVEN.slice(0, 5).map((entry) => entry.id as string), libraryTick(uuid(1))];
        expect(buildPastJobs({ olderStored: SEVEN, selected: fits, library: lib })).toMatchObject({ blocked: null, olderShown: 5, libraryChosen: 1 });
        expect(buildProposalPublicationSnapshot(input(SEVEN, fits, lib)).case_studies).toHaveLength(6);
    });

    it("one tick that matches two older entries counts as the two it shows", () => {
        const shared = [older("dup", "First"), older("dup", "Second"), older("0", "Third")];
        const jobs = buildPastJobs({ olderStored: shared, selected: ["dup"] });
        expect(jobs).toMatchObject({ olderMatched: 2, olderShown: 2 });
        expect(jobs.notes).toContain("One of your ticks matches more than one older case study, so each of them is shown.");
        expect(selectCaseStudies(shared, ["dup"])).toHaveLength(2);
        // "0" is the first entry's place and the third entry's id.
        expect(buildPastJobs({ olderStored: shared, selected: ["0"] }).olderMatched).toBe(2);
    });

    it("the same library tick twice is one case study", () => {
        const lib = library([approvedRow(1)]);
        const jobs = buildPastJobs({ olderStored: SEVEN, selected: [libraryTick(uuid(1)), libraryTick(uuid(1))], library: lib });
        expect(jobs).toMatchObject({ libraryChosen: 1, blocked: null });
        expect(buildProposalPublicationSnapshot(input(SEVEN, [libraryTick(uuid(1)), libraryTick(uuid(1))], lib)).case_studies).toHaveLength(1);
    });
});

describe("a value that could mean either kind", () => {
    const tick = libraryTick(uuid(1));
    const collided = [older(tick, "Older entry whose own id has the prefix")];

    it("an older entry whose id has the prefix keeps meaning that older entry", () => {
        const jobs = buildPastJobs({ olderStored: collided, selected: [tick], library: library([]) });
        expect(jobs).toMatchObject({ blocked: null, olderMatched: 1, libraryChosen: 0 });
        expect(buildProposalPublicationSnapshot(input(collided, [tick], library([]))).case_studies).toEqual(selectCaseStudies(collided, [tick]));
    });

    it("but if a library case study also answers to it, nobody is chosen for the contractor", () => {
        const lib = library([approvedRow(1)]);
        const jobs = buildPastJobs({ olderStored: collided, selected: [tick], library: lib });
        expect(jobs.cannotSend).toEqual([{ tick, message: "This choice could mean two different case studies. Untick it and choose again." }]);
        expect(() => buildProposalPublicationSnapshot(input(collided, [tick], lib))).toThrow(CASE_STUDY_UNSENDABLE_ERROR);
    });

    it("a bare id is always an older tick, even if a library case study has that id", () => {
        const stored = [older(uuid(1), "Older with a plain id")];
        const snapshot = buildProposalPublicationSnapshot(input(stored, [uuid(1)], library([approvedRow(1)])));
        expect(snapshot.case_studies!.map((study) => study.title)).toEqual(["Older with a plain id"]);
    });
});

describe("an older case study and the new version started from it", () => {
    const lib = (place: number) => library([approvedRow(1)], { legacyIndexById: { [uuid(1)]: place } });

    it("both are offered; ticking both says the job would appear twice; nothing is switched", () => {
        const one = buildPastJobs({ olderStored: SEVEN, selected: ["o2"], library: lib(1) });
        expect(one.library[0]).toMatchObject({ startedFromOlder: true, ticked: false });
        expect(one.olderWithNewVersion).toEqual([1]);
        expect(one.notes).toEqual([]);
        const both = buildPastJobs({ olderStored: SEVEN, selected: ["o2", libraryTick(uuid(1))], library: lib(1) });
        expect(both.notes).toContain("You've ticked both the older and the new version of the same job, so it would appear twice.");
        expect(both.blocked).toBeNull();
        // The older tick still sends the older text.
        expect(buildProposalPublicationSnapshot(input(SEVEN, ["o2"], lib(1))).case_studies!.map((study) => study.title)).toEqual(["Older 2"]);
    });

    it("if the older entry is later removed or moved, the new version is unaffected and no link is claimed", () => {
        const moved = [SEVEN[0], SEVEN[2]];
        const jobs = buildPastJobs({ olderStored: moved, selected: [libraryTick(uuid(1))], library: lib(5) });
        expect(jobs.library[0]).toMatchObject({ title: "Library 1", startedFromOlder: false, ticked: true });
        expect(jobs.olderWithNewVersion).toEqual([]);
        expect(buildProposalPublicationSnapshot(input(moved, [libraryTick(uuid(1))], lib(5))).case_studies!.map((study) => study.title)).toEqual(["Library 1"]);
        // A positional older tick now means whatever is in that place, as it always has. That is not fixed here.
        expect(selectCaseStudies(moved, ["1"]).map((study) => study.title)).toEqual(["Older 3"]);
    });
});

describe("what reaches the review screen from the library", () => {
    it("offers only approved, unarchived case studies, and shows their approved kinds of work", () => {
        const rows: LibraryRow[] = [approvedRow(1, {}, ["Kitchen Installation", "Tiling"]), { id: uuid(2), user_id: ME, approved: null, approved_revision: null, archived_at: null }, { ...approvedRow(3), archived_at: "2026-10-01T00:00:00Z" }];
        const jobs = buildPastJobs({ olderStored: SEVEN, selected: [], library: library(rows) });
        expect(jobs.library).toEqual([{ tick: libraryTick(uuid(1)), title: "Library 1", labels: ["Kitchen Installation", "Tiling"], ticked: false, startedFromOlder: false }]);
    });
});
