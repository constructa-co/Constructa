import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ updateProfileAction: vi.fn(), rewriteWithAIAction: vi.fn(), rewriteMdMessageAction: vi.fn() }));
vi.mock("@/app/storage/actions", () => ({ uploadProfileImageAction: vi.fn() }));

import { CASE_STUDIES_PATH } from "@/lib/first-session";
import { isDashboardPathAllowed } from "@/lib/launch-profile";
import ProfileForm from "./profile-form";

const SRC = path.resolve(import.meta.dirname, "../../../..");
const source = readFileSync(path.join(import.meta.dirname, "profile-form.tsx"), "utf8");

const PROFILE = {
    company_name: "Example Builders Ltd",
    phone: "0113 496 0000",
    // Even when the page is handed case studies, the form shows no editor for them.
    case_studies: [{ id: "cs-1", projectName: "Kitchen at Example Road", client: "Mrs Private", whatWeDelivered: "We refitted the kitchen.", valueAdded: "", photos: [] }],
};
const html = renderToStaticMarkup(createElement(ProfileForm, { profile: PROFILE as never, userEmail: "sam@example.com" }));

describe("the Company Profile form no longer edits case studies", () => {
    it("shows no case-study editor: no add button, no fields, and none of the stored text", () => {
        expect(html).not.toContain("Add Case Study");
        expect(html).not.toContain("No case studies yet");
        for (const label of ["What We Delivered", "Value Added", "Programme Duration", "Contract Value", "Client Name"]) expect(html, label).not.toContain(label);
        expect(html).not.toContain("Kitchen at Example Road");
        expect(html).not.toContain("Mrs Private");
    });

    it("says plainly where they are edited and that this form does not save them, with one link to that page", () => {
        const section = html.slice(html.indexOf("data-profile-case-studies"));
        expect(section).toContain("Case studies are added and changed on their own page. Saving this profile does not change them.");
        const links = Array.from(html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)</g)).filter((match) => match[1] === CASE_STUDIES_PATH);
        expect(links).toHaveLength(1);
        expect(links[0][2]).toBe("Go to case studies");
        // Large enough to press, and shows where keyboard focus is.
        expect(links[0][0]).toContain("min-h-11");
        expect(links[0][0]).toContain("focus-visible:outline");
    });

    it("the link goes to the existing editor, which is open in the cohort profile", () => {
        expect(CASE_STUDIES_PATH).toBe("/dashboard/settings/case-studies");
        expect(isDashboardPathAllowed(CASE_STUDIES_PATH, "cohort")).toBe(true);
        for (const file of ["page.tsx", "case-studies-client.tsx", "actions.ts"]) expect(existsSync(path.join(SRC, "app/dashboard/settings/case-studies", file)), file).toBe(true);
    });

    it("holds, posts and reads nothing about case studies", () => {
        expect(source).not.toMatch(/case_studies|caseStudies|CaseStudyCard|addCaseStudy/);
        expect(source).not.toMatch(/fd\.set\(\s*["']case/);
        // The only upload left on this form is the logo.
        expect(Array.from(source.matchAll(/formData\.set\("purpose", "([^"]+)"\)/g)).map((match) => match[1])).toEqual(["branding"]);
    });

    it("the rest of the form is still there", () => {
        for (const expected of ['name="company_name"', 'name="business_type"', 'name="phone"', "Managing Director Message", "Save"]) expect(html, expected).toContain(expected);
        expect(html).toContain('value="Example Builders Ltd"');
    });

    it("the dedicated case-study editor and its save are untouched by this change", () => {
        const editor = readFileSync(path.join(SRC, "app/dashboard/settings/case-studies/case-studies-client.tsx"), "utf8");
        const actions = readFileSync(path.join(SRC, "app/dashboard/settings/case-studies/actions.ts"), "utf8");
        expect(editor).toContain("saveCaseStudiesAction(caseStudies)");
        expect(actions).toContain(".update({ case_studies: caseStudies })");
    });
});

describe("nothing else depended on the profile form's case-study fields", () => {
    it("the profile action and its payload builder do not mention case studies in code", () => {
        const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
        expect(strip(readFileSync(path.join(SRC, "lib/profile-update.ts"), "utf8"))).not.toMatch(/case_stud/i);
        const action = strip(readFileSync(path.join(import.meta.dirname, "actions.ts"), "utf8"));
        expect(action.slice(action.indexOf("export async function updateProfileAction"), action.indexOf("revalidatePath("))).not.toMatch(/case_stud/i);
    });
});
