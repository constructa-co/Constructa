import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CASE_STUDY_TEXT_ENHANCE_ENABLED, caseStudyTextEnhanceEnabled } from "@/lib/cohort-ai/case-study-enhance-enabled";
import { COHORT_AI_OFF } from "@/lib/cohort-ai/shared";

const ROOT = path.join(process.cwd(), "src/app/dashboard/settings/case-studies");

describe("case study text enhance application OFF", () => {
    it("is explicitly false in source", () => {
        expect(CASE_STUDY_TEXT_ENHANCE_ENABLED).toBe(false);
        expect(caseStudyTextEnhanceEnabled()).toBe(false);
    });

    it("legacy and library editors guard before calling enhance and surface OFF copy", () => {
        for (const file of ["case-studies-client.tsx", "library/case-study-editor.tsx"]) {
            const text = readFileSync(path.join(ROOT, file), "utf8");
            expect(text).toContain("caseStudyTextEnhanceEnabled()");
            expect(text).toContain("COHORT_AI_OFF");
            expect(text.indexOf("caseStudyTextEnhanceEnabled()")).toBeLessThan(text.indexOf("await enhance("));
        }
    });

    it("server action checks the flag before privileged client or budget work", () => {
        const text = readFileSync(path.join(ROOT, "actions.ts"), "utf8");
        const body = text.slice(text.indexOf("export async function enhanceCaseStudyAction"));
        expect(body.indexOf("caseStudyTextEnhanceEnabled()")).toBeGreaterThan(-1);
        expect(body.indexOf("caseStudyTextEnhanceEnabled()")).toBeLessThan(body.indexOf("createAdminClient("));
        expect(body).toContain("COHORT_AI_OFF");
        expect(body.indexOf("COHORT_AI_OFF")).toBeLessThan(body.indexOf("createAdminClient("));
    });
});
