import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NewJobFrame from "./new-job-frame";
import { PROPOSAL_READINESS_PATH } from "@/lib/first-session";

describe("new job context", () => {
    it.each([true, false])("distinguishes Work Winning from company setup without replacing the form (first=%s)", first => {
        const html = renderToStaticMarkup(
            <NewJobFrame first={first} dark creating={false} errorKey="">
                <form data-original-job-form="retained">Existing job, client, contact and date fields</form>
            </NewJobFrame>
        );
        expect(html).toContain("Work Winning / New job");
        expect(html).toContain("This is a new job, not company setup.");
        expect(html).toContain("Add a name and client, then describe the work in the brief.");
        expect(html).toContain(first ? "Add your first job" : "New project");
        expect(html).toContain(`href="${first ? PROPOSAL_READINESS_PATH : "/dashboard"}"`);
        expect(html).toContain('data-original-job-form="retained"');
        expect(html).toContain("Existing job, client, contact and date fields");
        expect(html.match(/<form\b/g)).toHaveLength(1);
        expect(html).not.toMatch(/<input|<select|<textarea/);
    });
});
