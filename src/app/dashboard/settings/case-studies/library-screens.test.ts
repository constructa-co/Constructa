import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock("./library-actions", () => ({
    approveCaseStudyAction: vi.fn(), archiveCaseStudyAction: vi.fn(), archiveDisciplineAction: vi.fn(), checkCaseStudyAction: vi.fn(),
    createCaseStudyAction: vi.fn(), saveCaseStudyAction: vi.fn(), saveDisciplineAction: vi.fn(), startFromOlderCaseStudyAction: vi.fn(),
}));

import { approvedValue, newDraft } from "@/lib/case-library/content";
import { buildPastJobs } from "@/lib/case-library/past-jobs";
import type { StudyView } from "@/lib/case-library/service";
import PastJobsExtras from "../../projects/proposal/past-jobs-extras";
import CaseStudyEditor, { ApprovedPreview } from "./library/case-study-editor";
import LibraryPanel from "./library-panel";
import GuidedCapture from "./library/guided-capture";

const kinds = [{ id: "k1", label: "Kitchen Installation", position: 0, revision: 1, archived: false }, { id: "k2", label: "Old trade", position: 1, revision: 3, archived: true }];
const draft = { ...newDraft("Kitchen at Example Road"), delivered: "We refitted it.", client_text: "Mrs Private", value_text: "£9,000" };
const view = (extra: Partial<StudyView> = {}): StudyView => ({ id: "s1", revision: 2, content: draft, disciplineIds: ["k1"], approved: null, approvedRevision: null, archived: false, legacyIndex: null, ...extra });
const panel = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(LibraryPanel, { available: true, studies: [], disciplines: kinds, older: [], basePath: "/base", ...props } as never));
const classes = { body: "b", muted: "m", notice: "n", button: "x" };

describe("the library list", () => {
    it("unavailable is said plainly and is never shown as an empty library", () => {
        const html = panel({ available: false });
        expect(html).toContain("isn&#x27;t available right now. Your older case studies below still work.");
        expect(html).not.toContain("You haven&#x27;t added any here yet.");
        expect(html).not.toContain("Add a past job");
    });

    it("says what each case study's state is, in words", () => {
        const approved = approvedValue(draft, ["Kitchen Installation"]);
        const html = panel({ studies: [
            view(),
            view({ id: "s2", approved, approvedRevision: 2 }),
            view({ id: "s3", approved, approvedRevision: 2, content: { ...draft, delivered: "Edited since." } }),
            view({ id: "s4", archived: true }),
        ] });
        expect(html).toContain("Draft: clients can&#x27;t see this yet");
        expect(html).toMatch(/data-state="approved"[^]*?>Approved</);
        expect(html).toContain("Approved, with changes not yet approved: what you did");
        expect(html).toContain("Archived");
        // A hidden client's name and an unshown price are not printed on the list.
        expect(html).not.toContain("Mrs Private");
        expect(html).not.toContain("9,000");
    });

    it("offers a new version only for older case studies that do not have one, and claims nothing about their pictures", () => {
        const html = panel({ studies: [view({ legacyIndex: 1 })], older: [{ index: 0, title: "Older A" }, { index: 1, title: "Older B" }] });
        expect(html).toContain("Start a new version of Older A");
        expect(html).not.toContain("Start a new version of Older B");
        expect(html).toContain("New version started");
        expect(html).toContain("The client is left out and no price is shown unless you choose otherwise. The older one is not changed and can still be chosen.");
        expect(html).not.toMatch(/with pictures|has pictures/);
    });
});

describe("the editor", () => {
    const editor = (initial: StudyView | null) => renderToStaticMarkup(createElement(CaseStudyEditor, { initial, disciplines: kinds, listHref: "/list" } as never));

    it("a new case study asks only for the job, with client and price closed and off", () => {
        const html = editor(null);
        expect(html).toContain("Add a past job");
        expect(html).toContain("Nothing to save yet");
        expect(html).toContain("Unless you change it here, the client is not mentioned and no price is shown.");
        expect(html).not.toContain("How should we refer to the client?");
        expect(html.match(/\(optional/g)!.length).toBeGreaterThanOrEqual(5);
        expect(html).toContain("Save your draft first.");
        // Archived kinds of work are not offered.
        expect(html).toContain("Kitchen Installation");
        expect(html).not.toContain("Old trade");
    });

    it("every field has a visible label tied to it", () => {
        const html = editor(view());
        for (const id of ["cs-title", "cs-delivered", "cs-value-added", "cs-place", "cs-duration", "cs-new-kind"]) {
            expect(html, id).toContain(`for="${id}"`);
            expect(html, id).toContain(`id="${id}"`);
        }
    });
});

describe("the questions", () => {
    const guided = (initial: StudyView | null) => renderToStaticMarkup(createElement(GuidedCapture, { initial, disciplines: kinds, basePath: "/base", listHref: "/list" } as never));

    it("a new one opens on the job name alone, with the full form one press away and nothing claimed as saved", () => {
        const html = guided(null);
        expect(html).toContain("Question 1 of 6");
        expect(html).toContain("What was the job?");
        expect(html).toContain('for="guided-answer"');
        expect(html).toContain('id="guided-answer"');
        expect(html).toContain("Nothing saved yet.");
        expect(html).toContain('href="/base/new"');
        expect(html).toContain("Use the full form instead");
        expect(html).toContain("Save and next");
        expect(html).not.toContain("Skip");
        expect(html).not.toContain("See all answers");
        expect(html).not.toMatch(/Approve<|approved/i);
    });

    it("an existing one opens on what is saved, says what is not remembered, and shows consent as it stands", () => {
        const html = guided(view({ content: { ...draft, client_display: "named", client_named_ok: false } }));
        expect(html).toContain('data-guided-screen="summary"');
        expect(html).toContain("Anything you typed but didn&#x27;t save isn&#x27;t here, and we don&#x27;t keep track of questions you skipped.");
        expect(html).toContain("We refitted it.");
        expect(html).toContain("Kitchen Installation");
        expect(html).not.toContain("Old trade");
        expect(html).toContain("The client is named: Mrs Private. You haven&#x27;t said they&#x27;ve agreed to it.");
        expect(html).toContain("Carry on");
        expect(html).toContain('href="/base/s1"');
        expect(html).toContain("Saved.");
    });

    it("the optional questions are offered from what is saved, never as part of the six, and say whose words they are", () => {
        const html = guided(view());
        expect(html).toContain("data-depth-entry");
        expect(html).toContain("Add more about this job");
        expect(html).toContain("Three optional questions");
        expect(html).toContain("in your own words");
        // A new case study, not yet saved, is not offered them.
        expect(guided(null)).not.toContain("Add more about this job");
        expect(guided(null)).toContain("Question 1 of 6");
    });

    it("an approved one says proposals keep the approved version, and offers no approval here", () => {
        const html = guided(view({ approved: approvedValue(draft, ["Kitchen Installation"]), approvedRevision: 2 }));
        expect(html).toContain("Approved earlier. Proposals keep using the approved version until you approve again on the full form.");
        expect(html).not.toMatch(/>Approve</);
    });
});

describe("the ways in to the questions", () => {
    it("the list offers them beside the full form", () => {
        const html = panel({});
        expect(html).toContain('href="/base/new"');
        expect(html).toContain('href="/base/new/guided"');
        expect(html).toContain("Answer a few questions instead");
        expect(panel({ available: false })).not.toContain("Answer a few questions instead");
    });

    it("the full form links to them only when it is told where they are", () => {
        const withLink = renderToStaticMarkup(createElement(CaseStudyEditor, { initial: view(), disciplines: kinds, listHref: "/list", guidedBase: "/base" } as never));
        expect(withLink).toContain('href="/base/s1/guided"');
        const without = renderToStaticMarkup(createElement(CaseStudyEditor, { initial: view(), disciplines: kinds, listHref: "/list" } as never));
        expect(without).not.toContain("/guided");
    });
});

describe("what would be approved", () => {
    it("is drawn from the approved copy alone, under the proposal's headings", () => {
        const html = renderToStaticMarkup(createElement(ApprovedPreview, { approved: approvedValue({ ...draft, place: "Leeds", client_display: "described", client_text: "a homeowner", show_value: true }, ["Kitchens"]) }));
        expect(html).toContain("What we delivered");
        expect(html).toContain("a homeowner");
        expect(html).toContain("£9,000");
        const hidden = renderToStaticMarkup(createElement(ApprovedPreview, { approved: approvedValue(draft, []) }));
        expect(hidden).not.toContain("Mrs Private");
        expect(hidden).not.toContain("9,000");
        expect(hidden).not.toContain("Client");
    });
});

describe("the library's part of the review screen", () => {
    const extras = (jobs: ReturnType<typeof buildPastJobs>, unapproved = 0) => renderToStaticMarkup(createElement(PastJobsExtras, { jobs, unapproved, busy: false, onToggle: () => {}, classes }));

    it("renders nothing at all for a proposal with no library, no problem and no note, so the older list is as it was", () => {
        expect(extras(buildPastJobs({ olderStored: [{ id: "a", projectName: "Older" }], selected: [] }))).toBe("");
        expect(extras(buildPastJobs({ olderStored: null, selected: null }))).toBe("");
    });

    it("a ticked case study that cannot be sent is shown with why and a way to untick it", () => {
        const html = extras(buildPastJobs({ olderStored: [], selected: ["lib:00000000-0000-4000-8000-000000000001"] }));
        expect(html).toContain("Chosen, but can&#x27;t be sent");
        expect(html).toContain("isn&#x27;t available right now");
        expect(html).toContain("Untick it");
        expect(html).toContain('role="alert"');
    });
});
