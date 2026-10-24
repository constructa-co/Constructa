import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ save: vi.fn(), enhance: vi.fn(), upload: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock("./actions", () => ({ saveCaseStudiesAction: actions.save, enhanceCaseStudyAction: actions.enhance }));
vi.mock("@/app/storage/actions", () => ({ uploadProfileImageAction: actions.upload }));
vi.mock("./library-actions", () => ({
    approveCaseStudyAction: vi.fn(), archiveCaseStudyAction: vi.fn(), archiveDisciplineAction: vi.fn(), checkCaseStudyAction: vi.fn(),
    createCaseStudyAction: vi.fn(), saveCaseStudyAction: vi.fn(), saveDisciplineAction: vi.fn(), startFromOlderCaseStudyAction: vi.fn(),
}));

import { newDraft } from "@/lib/case-library/content";
import { questionOf } from "@/lib/case-library/guided";
import type { StudyView } from "@/lib/case-library/service";
import CaseStudiesClient from "./case-studies-client";
import CaseStudyEditor from "./library/case-study-editor";

// A035: the two story boxes, what was done and what it meant for the client,
// start the same size on both editors and ask plainly for what actually
// happened. Everything the contractor has written is shown back unchanged.
const textarea = (html: string, id: RegExp) => html.match(new RegExp(`<textarea[^>]*id="${id.source}"[^>]*>([^<]*)</textarea>`))!;
const attribute = (tag: string, name: string) => tag.match(new RegExp(` ${name}="([^"]*)"`, "i"))?.[1];

describe("library editor story boxes", () => {
    const kinds = [{ id: "k1", label: "Kitchen Installation", position: 0, revision: 1, archived: false }];
    const content = { ...newDraft("Kitchen at Example Road"), delivered: "We refitted it.", value_added: "Own wording", place: "Leeds", duration_text: "3 weeks", client_text: "Mrs Private", value_text: "£9,000" };
    const view: StudyView = { id: "s1", revision: 2, content, disciplineIds: ["k1"], approved: null, approvedRevision: null, archived: false, legacyIndex: null };
    const html = renderToStaticMarkup(createElement(CaseStudyEditor, { initial: view, disciplines: kinds, listHref: "/list" } as never));
    const delivered = textarea(html, /cs-delivered/);
    const valueAdded = textarea(html, /cs-value-added/);

    it("start at the same height, with the same limit", () => {
        expect(attribute(delivered[0], "rows")).toBe("5");
        expect(attribute(valueAdded[0], "rows")).toBe(attribute(delivered[0], "rows"));
        expect(attribute(delivered[0], "maxLength")).toBe("5000");
        expect(attribute(valueAdded[0], "maxLength")).toBe("5000");
        expect(attribute(delivered[0], "class")).toBe(attribute(valueAdded[0], "class"));
    });

    it("show the contractor's saved words unchanged, under the same labels", () => {
        expect(delivered[1]).toBe("We refitted it.");
        expect(valueAdded[1]).toBe("Own wording");
        expect(html).toMatch(/<label for="cs-delivered"[^>]*>What did you do\? <span[^>]*>\(optional\)<\/span><\/label>/);
        expect(html).toMatch(/<label for="cs-value-added"[^>]*>What did it mean for the client\? <span[^>]*>\(optional\)<\/span><\/label>/);
        for (const value of ["Kitchen at Example Road", "Leeds", "3 weeks"]) expect(html).toContain(`value="${value}"`);
    });

    it("each carry the guided question's own plain prompt, tied to the box", () => {
        for (const [tag, key, id] of [[delivered[0], "delivered", "cs-delivered-help"], [valueAdded[0], "value_added", "cs-value-added-help"]] as const) {
            expect(attribute(tag, "aria-describedby")).toBe(id);
            const help = questionOf(key).help.replace(/'/g, "&#x27;");
            expect(html).toContain(`<p id="${id}" class="text-sm text-slate-300">${help}</p>`);
        }
        expect(questionOf("value_added").help).toBe("Only what actually happened. If you're not sure, skip this one.");
    });

    it("keep the client and price private by default on a new case study", () => {
        const fresh = renderToStaticMarkup(createElement(CaseStudyEditor, { initial: null, disciplines: kinds, listHref: "/list" } as never));
        expect(attribute(textarea(fresh, /cs-delivered/)[0], "rows")).toBe(attribute(textarea(fresh, /cs-value-added/)[0], "rows"));
        expect(fresh).toContain("Unless you change it here, the client is not mentioned and no price is shown.");
    });
});

describe("older case-study story boxes", () => {
    const html = renderToStaticMarkup(createElement(CaseStudiesClient, { userId: "synthetic", initialCaseStudies: [{
        id: "example", projectName: "Example renovation", projectType: "Renovation",
        contractValue: "£85,000", programmeDuration: "12 weeks", client: "Example client", location: "Surrey",
        whatWeDelivered: "Example work", valueAdded: "Own wording", photos: ["", "", ""],
    }] } as never));
    const delivered = textarea(html, /[^"]*-delivered/);
    const valueAdded = textarea(html, /[^"]*-added/);

    it("start at the same height and look the same", () => {
        expect(attribute(delivered[0], "rows")).toBe("3");
        expect(attribute(valueAdded[0], "rows")).toBe(attribute(delivered[0], "rows"));
        expect(attribute(delivered[0], "class")).toBe(attribute(valueAdded[0], "class"));
    });

    it("show the saved words and every project detail unchanged, under the same names", () => {
        expect(delivered[1]).toBe("Example work");
        expect(valueAdded[1]).toBe("Own wording");
        expect(attribute(delivered[0], "aria-label")).toBe("What We Delivered");
        expect(attribute(valueAdded[0], "aria-label")).toBe("Value Added");
        for (const value of ["Example renovation", "Renovation", "£85,000", "12 weeks", "Example client", "Surrey"]) expect(html).toContain(`value="${value}"`);
    });

    it("ask for the work done and, only if known, what it meant for the client", () => {
        expect(attribute(delivered[0], "placeholder")).toBe("The work you carried out, in your own words. A few lines is plenty.");
        expect(attribute(valueAdded[0], "placeholder")).toBe("What it meant for the client, if you know. Only what actually happened.");
        expect(html).not.toContain("Brief description of the works delivered...");
        expect(html).not.toContain("What made this project stand out...");
    });

    it("render without saving, rewording or uploading anything", () => {
        for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
    });
});
