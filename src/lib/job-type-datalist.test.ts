import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { JOB_TYPE_EXAMPLES } from "./job-type-options";
import {
    JOB_TYPE_RELEVANCE_GAP,
    buildJobTypeDatalistOptions,
    standardExampleMentionedInExplicitText,
} from "./job-type-datalist";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("explicit job-type datalist (A041 relevance without taxonomy)", () => {
    it("documents the unauthorised mapping gap", () => {
        expect(JOB_TYPE_RELEVANCE_GAP).toMatch(/PROJECT_TYPES_BY_TRADE/);
        expect(read("src/lib/project-types.ts")).toContain("getProjectTypes");
        expect(read("src/app/dashboard/projects/new/new-project-form.tsx")).not.toMatch(/getProjectTypes|PROJECT_TYPES_BY_TRADE/);
        expect(read("src/app/dashboard/projects/settings/client-page.tsx")).not.toMatch(/getProjectTypes|PROJECT_TYPES_BY_TRADE/);
    });

    it("keeps all eight standard examples when no explicit context is supplied", () => {
        expect(buildJobTypeDatalistOptions()).toEqual(JOB_TYPE_EXAMPLES);
    });

    it("lists prior saved types first without normalising contractor wording", () => {
        const options = buildJobTypeDatalistOptions({
            priorProjectTypes: ["Kitchen worktop repairs", "Extension", "Kitchen worktop repairs"],
        });
        expect(options[0]).toBe("Kitchen worktop repairs");
        expect(options.filter(v => v === "Kitchen worktop repairs")).toHaveLength(1);
        expect(options).toContain("Other");
        expect(new Set(options).size).toBe(options.length);
    });

    it("promotes standard examples only when their label appears in explicit saved text", () => {
        const options = buildJobTypeDatalistOptions({
            businessType: "Kitchen fitting and bathroom refurbishments",
            specialisms: "We also do roofing repairs",
        });
        expect(options.indexOf("Bathroom/Kitchen")).toBeLessThan(options.indexOf("New Build"));
        expect(options.indexOf("Roofing")).toBeLessThan(options.indexOf("New Build"));
        expect(options).toEqual(expect.arrayContaining([...JOB_TYPE_EXAMPLES]));
    });

    it("does not infer kitchen relevance from Joinery trade alone without explicit example text", () => {
        const options = buildJobTypeDatalistOptions({
            preferredTrades: ["Joinery & Carpentry"],
            businessType: "Bespoke joinery",
        });
        expect(options).toEqual(JOB_TYPE_EXAMPLES);
    });

    it.each([
        ["Extension", "small extensions and repairs"],
        ["Bathroom/Kitchen", "Full kitchen refit"],
        ["Loft Conversion", "no match here"],
    ])("standardExampleMentionedInExplicitText(%j, haystack) respects slash segments and full phrases", (example, text) => {
        const hay = text.toLowerCase();
        const expected = example === "Loft Conversion" ? false : true;
        expect(standardExampleMentionedInExplicitText(example, hay)).toBe(expected);
    });
});

describe("A041 surface scan — create / settings / proposal / case studies", () => {
    it("shares JOB_TYPE_EXAMPLES on create and settings job-type datalists", () => {
        const create = read("src/app/dashboard/projects/new/new-project-form.tsx");
        const settings = read("src/app/dashboard/projects/settings/client-page.tsx");
        expect(create).toContain("PROJECT_TYPE_OPTIONS");
        expect(settings).toContain("JOB_TYPE_EXAMPLES");
        expect(create).toMatch(/list="new-project-type-examples"/);
        expect(settings).toMatch(/list="settings-job-type-examples"/);
    });

    it("proposal review shows stored project_type without a job-type editor datalist", () => {
        const proposal = read("src/app/dashboard/projects/proposal/review-send-client.tsx");
        expect(proposal).toMatch(/project\.project_type/);
        expect(proposal).not.toMatch(/settings-job-type-examples|new-project-type-examples|JOB_TYPE_EXAMPLES/);
    });

    it("uses the same eight examples on case studies project type via a shared datalist", () => {
        const caseStudies = read("src/app/dashboard/settings/case-studies/case-studies-client.tsx");
        expect(caseStudies).toMatch(/list="case-study-job-type-examples"/);
        expect(caseStudies).toContain("JOB_TYPE_EXAMPLES");
    });
});
