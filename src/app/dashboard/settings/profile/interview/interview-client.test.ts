import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { InterviewState, NarrativeDraft } from "@/lib/company-interview/service";

vi.mock("./actions", () => ({ saveInterviewAnswerAction: vi.fn(), buildInterviewDraftAction: vi.fn(), approveInterviewAction: vi.fn(), rewordInterviewDraftAction: vi.fn() }));

import InterviewClient from "./interview-client";

const a = (answer: string, revision = 1) => ({ answer, skipped: false, revision });
const skipped = { answer: "", skipped: true, revision: 1 };
const ALL = { work: a("Roofing"), business_started: a("2021"), career_experience: skipped, area: a("Leeds"), customers: skipped, strengths: a("Tidy"), memberships: a("Gas Safe registered"), insurance: skipped };

const draft = (over: Partial<NarrativeDraft> = {}): NarrativeDraft => ({
    id: "00000000-0000-4000-8000-000000000001",
    text: "Smith Builders specialises in roofing. We cover Leeds.\n\nHow we work: tidy.",
    generator: "template",
    basedOn: [{ kind: "answer", key: "work", revision: 1 }, { kind: "answer", key: "area", revision: 1 }, { kind: "answer", key: "strengths", revision: 1 }],
    facts: [{ field: "accreditations", proposed: "Gas Safe registered", existing: null, questionKey: "memberships", status: "pending", appliedAt: null }],
    savedIntroduction: null,
    status: "draft",
    approvedEdited: false,
    approvedAt: null,
    stale: false,
    ...over,
});
const render = (initialState: InterviewState | null, aiOffered?: boolean) => renderToStaticMarkup(createElement(InterviewClient, { initialState, aiOffered }));
const state = (answers: InterviewState["answers"], d: NarrativeDraft | null = null): InterviewState => ({ companyName: "Smith Builders", answers, draft: d });

describe("InterviewClient", () => {
    it("opens a new contractor on question 1, with skip and manual entry available and no back button", () => {
        const html = render(state({}));
        expect(html).toContain("Question 1 of 8");
        expect(html).toContain("What work does your business do most?");
        expect(html).toContain(">Skip<");
        expect(html).toContain("Save and continue");
        expect(html).not.toContain(">Back<");
        expect(html).toMatch(/href="\/dashboard\/settings\/profile"[^>]*>Enter details by hand instead/);
        expect(html).toContain("Every question is optional and none of this holds up a job.");
    });

    it("resumes on the first undecided question with its saved answer, and asks for the year as a short field", () => {
        const html = render(state({ work: a("Roofing") }));
        expect(html).toContain("Question 2 of 8");
        expect(html).toContain("What year did this business start trading?");
        expect(html).toContain('inputMode="numeric"');
        expect(html).toContain(">Back<");
    });

    it("shows a load failure with manual entry instead of an empty interview", () => {
        const html = render(null);
        expect(html).toContain("We couldn&#x27;t load your answers");
        expect(html).toContain("Enter details by hand");
        expect(html).not.toContain("Question 1 of 8");
    });

    it("shows the draft beside what is saved, says how it was made, and saves nothing by itself", () => {
        const html = render(state(ALL, draft({ savedIntroduction: "Old words" })));
        expect(html).toContain("Your introduction");
        expect(html).toContain("5 of 8 questions answered");
        expect(html).toContain("Saved on your profile now");
        expect(html).toContain("Old words");
        expect(html).toContain("Smith Builders specialises in roofing. We cover Leeds.");
        expect(html).toContain("Built by fixed rules from your answers to questions 1, 4, 6. Nothing has been added.");
        expect(html).toContain("If you change the wording, it is saved as your own words.");
        expect(html).toContain("Replace my introduction with this");
        // No claim that anything was verified or written by AI.
        expect(html).not.toMatch(/\bAI\b|verified|checked for accuracy|generated/i);
    });

    it("offers each fact for its own approval, in the contractor's words, naming the question it came from", () => {
        const html = render(state(ALL, draft()));
        expect(html).toContain("Memberships and qualifications");
        expect(html).toContain("From your answer to question 7");
        expect(html).toContain("Gas Safe registered");
        expect(html).toContain("These are your own words, used exactly.");
        expect(html).toContain("Save this to my profile");
        expect(html).toContain("Save as my introduction");
    });

    it("will not offer a stale draft for approval: it must be rebuilt first", () => {
        const html = render(state(ALL, draft({ stale: true })));
        expect(html).toContain("Your answers have changed since this was put together.");
        expect(html).toContain("Update it from my latest answers");
        expect(html).not.toContain("Save as my introduction");
        expect(html).not.toContain("Save this to my profile");
        expect(html).not.toContain("interview-introduction");
    });

    it("says an approved introduction is saved, and whether the wording was the contractor's own", () => {
        const approved = draft({ status: "approved", approvedEdited: true, savedIntroduction: "My own words.", facts: [{ field: "accreditations", proposed: "Gas Safe registered", existing: "Gas Safe registered", questionKey: "memberships", status: "applied", appliedAt: "2026-10-08T09:00:00.000Z" }] });
        const html = render(state(ALL, approved));
        expect(html).toContain("Saved to your profile, with your own changes to the wording.");
        expect(html).toContain("My own words.");
        expect(html).not.toContain("Save as my introduction");
        expect(html.match(/Saved to your profile\./g)).toHaveLength(1);
        expect(render(state(ALL, draft({ status: "approved", savedIntroduction: "x" })))).not.toContain("with your own changes");
    });

    it("as shipped, with AI wording switched off, shows no rewording controls at all", () => {
        for (const html of [render(state(ALL, draft())), render(state(ALL, draft()), false)]) {
            expect(html).not.toMatch(/Reword it|Show the plain version|writing assistant/);
            expect(html).toContain("Built by fixed rules");
        }
    });

    it("when AI wording is on offer, a plain draft can be reworded on request", () => {
        const html = render(state(ALL, draft()), true);
        expect(html).toContain("Reword it for me");
        expect(html).not.toContain("Show the plain version");
        expect(html).toContain("Put together from your answers");
        expect(html).toContain("Built by fixed rules");
    });

    it("says plainly when a draft was worded by the assistant, that it can be wrong, and keeps the plain version one tap away", () => {
        const html = render(state(ALL, draft({ generator: "ai", text: "Smith Builders does roofing in Leeds.", savedIntroduction: "Old words" })), true);
        expect(html).toContain("Worded for you from your answers");
        expect(html).toContain("Worded by our writing assistant from your answers to questions 1, 4, 6. It can get things wrong, so check it says only what you told us.");
        expect(html).not.toContain("Built by fixed rules");
        expect(html).not.toContain("Nothing has been added");
        expect(html).toContain("Show the plain version");
        expect(html).toContain("Reword it again");
        // Still compared with what is saved, still editable, still needs an explicit save.
        expect(html).toContain("Old words");
        expect(html).toContain("Replace my introduction with this");
        expect(html).toContain("If you change the wording, it is saved as your own words.");
        expect(html).not.toMatch(/verified|checked for accuracy|guaranteed|accurate/i);
    });

    it("an assistant-worded draft is shown as such even if AI wording has since been switched off, without rewording controls", () => {
        const html = render(state(ALL, draft({ generator: "ai" })), false);
        expect(html).toContain("Worded by our writing assistant");
        expect(html).not.toMatch(/Reword it|Show the plain version/);
    });

    it("records on screen who the approved words belong to", () => {
        expect(render(state(ALL, draft({ generator: "ai", status: "approved", savedIntroduction: "x" })), true)).toContain("Saved to your profile, as worded by our writing assistant.");
        expect(render(state(ALL, draft({ generator: "ai", status: "approved", approvedEdited: true, savedIntroduction: "x" })), true)).toContain("Saved to your profile, with your own changes to the wording.");
        const plain = render(state(ALL, draft({ status: "approved", savedIntroduction: "x" })), true);
        expect(plain).toContain("Saved to your profile.");
        expect(plain).not.toContain("writing assistant");
    });

    it("a stale draft offers only a plain rebuild, whichever way it was produced", () => {
        const html = render(state(ALL, draft({ generator: "ai", stale: true })), true);
        expect(html).toContain("Update it from my latest answers");
        expect(html).not.toMatch(/Reword it|Save as my introduction|Show the plain version/);
    });

    it("asks for the draft to be put together when all questions are decided but none exists", () => {
        const html = render(state(ALL, null));
        expect(html).toContain("Nothing has been put together yet.");
        expect(html).toContain("Put my introduction together");
    });

    it("renders answers and drafts as text, never as markup, and links only inside the app", () => {
        const hostile = draft({ text: `<img src=x onerror=alert(1)>`, savedIntroduction: `</p><script>alert(2)</script>`, facts: [{ field: "accreditations", proposed: `<a href="javascript:alert(3)">x</a>`, existing: null, questionKey: "memberships", status: "pending", appliedAt: null }] });
        const html = render(state(ALL, hostile));
        expect(html).not.toMatch(/<img|<script|<a href="javascript:/i);
        expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
        const hrefs = Array.from(html.matchAll(/href="([^"]+)"/g)).map((match) => match[1]);
        expect(new Set(hrefs)).toEqual(new Set(["/dashboard/settings/profile", "/dashboard/settings/profile/readiness"]));
    });
});
