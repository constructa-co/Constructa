import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ updateProfileAction: vi.fn(), rewriteWithAIAction: vi.fn(), rewriteMdMessageAction: vi.fn() }));
vi.mock("@/app/storage/actions", () => ({ uploadProfileImageAction: vi.fn() }));

import { CASE_STUDIES_PATH } from "@/lib/first-session";
import { isDashboardPathAllowed } from "@/lib/launch-profile";
import { profileUpdateFromForm } from "@/lib/profile-update";
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

describe("years trading initial value", () => {
    const control = (years_trading: number | null | undefined) => {
        const rendered = renderToStaticMarkup(createElement(ProfileForm, {
            profile: { ...PROFILE, years_trading }, userEmail: "sam@example.com",
        }));
        return rendered.match(/<input[^>]*id="company-years_trading"[^>]*>/)![0];
    };

    it("keeps a valid stored zero instead of rendering a blank that would post as null", () => {
        const input = control(0);
        expect(input).toContain('value="0"');
        expect(input).toContain('type="number"');
        expect(input).toContain('min="0"');
        const data = new FormData();
        data.set("years_trading", input.match(/\bvalue="([^"]*)"/)![1]);
        // Model the rendered field's posted value; this is not a browser save.
        expect(profileUpdateFromForm("test-user", data).years_trading).toBe(0);
    });

    it.each([null, undefined])("keeps %s absent rather than inventing a year count", years => {
        expect(control(years)).toContain('value=""');
    });

    it("keeps the existing positive value unchanged", () => {
        expect(control(8)).toContain('value="8"');
    });
});

describe("saved proposal theme visibility", () => {
    const render = (pdf_theme: string | null) => renderToStaticMarkup(createElement(ProfileForm, {
        profile: { ...PROFILE, pdf_theme }, userEmail: "sam@example.com",
    }));

    it("shows an unmatched saved value without selecting a replacement", () => {
        const legacy = render("classic");
        expect(legacy).toContain('data-pdf-theme="classic"');
        expect(legacy).toContain('data-profile-saved-theme');
        expect(legacy).toContain("Saved theme: <strong>classic</strong>");
        expect(legacy).toContain("It is kept when you save unless you choose another theme.");
        const style = legacy.slice(legacy.indexOf('id="company-style"'), legacy.indexOf('data-profile-case-studies'));
        expect(style.match(/aria-pressed="false"/g)).toHaveLength(3);
        expect(style).not.toContain('aria-pressed="true"');
        expect(style.match(/<button/g)).toHaveLength(3);
    });

    it.each([null, "", "slate", "navy", "forest"])("keeps existing default/known theme %s without an unmatched-value note", value => {
        const known = render(value);
        expect(known).not.toContain('data-profile-saved-theme');
        const style = known.slice(known.indexOf('id="company-style"'), known.indexOf('data-profile-case-studies'));
        expect(style.match(/aria-pressed="true"/g)).toHaveLength(1);
    });

    it("renders an unmatched value as text, not markup", () => {
        const legacy = render("<legacy & custom>");
        expect(legacy).toContain("<strong>&lt;legacy &amp; custom&gt;</strong>");
        expect(legacy).not.toContain("<strong><legacy");
    });
});

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
        expect(html).toContain('id="profile-save-status"');
        expect(html).toContain("No unsaved changes on this page.");
        expect(html).toContain('aria-busy="false"');
    });

    it("the dedicated case-study editor is still the one place that saves case studies, by one write of the whole list", () => {
        // What this guards is unchanged: case studies are saved by their own editor through its own action, not by the
        // profile form. How that editor calls the action changed later (it now sends the copy its rules recorded and
        // reads a result); the write itself is the same single update of the one column.
        const editor = readFileSync(path.join(SRC, "app/dashboard/settings/case-studies/case-studies-client.tsx"), "utf8");
        const actions = readFileSync(path.join(SRC, "app/dashboard/settings/case-studies/actions.ts"), "utf8");
        expect(editor).toContain("save = saveCaseStudiesAction");
        expect(editor).toContain("await save(request.sent)");
        expect(actions).toContain(".update({ case_studies: caseStudies })");
        expect(actions.match(/case_studies:/g)).toHaveLength(1);
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
