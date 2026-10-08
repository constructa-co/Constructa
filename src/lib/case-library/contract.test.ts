import { describe, expect, it } from "vitest";
import vectors from "./__fixtures__/contract-vectors.json";
import { approvalProblem, approvedProblem, approvedValue, contentFromInput, contentProblem, labelProblem, newDraft, type CaseStudyContent } from "./content";
import { labelKey } from "./labels";

/**
 * The same vectors are run through the SQL functions by
 * scripts/test-case-library-sql.sh. A rule changed on one side only fails
 * one of the two.
 */
describe("case study content: the application's rules, on the shared vectors", () => {
    it.each(vectors.content as Array<[string, unknown, string | null]>)("content: %s", (_name, value, problem) => {
        expect(contentProblem(value)).toBe(problem);
    });

    it.each(vectors.approval as Array<[string, unknown, string | null]>)("approval: %s", (_name, value, problem) => {
        expect(approvalProblem(value)).toBe(problem);
    });

    it.each(vectors.approvedValue as Array<[string, CaseStudyContent, string[], unknown]>)("approved copy: %s", (_name, content, labels, expected) => {
        const approved = approvedValue(content, labels);
        expect(approved).toEqual(expected);
        expect(approvedProblem(approved)).toBeNull();
    });

    it.each(vectors.approved as Array<[string, unknown, string | null]>)("stored approved copy: %s", (_name, value, problem) => {
        expect(approvedProblem(value)).toBe(problem);
    });

    it.each(vectors.labels as Array<[string, string, string | null]>)("label %j", (label, key, problem) => {
        expect(labelKey(label)).toBe(key);
        expect(labelProblem(label)).toBe(problem);
    });

    it("covers every rule code the validator can return", () => {
        const seen = new Set([...vectors.content, ...vectors.approval, ...vectors.approved].map((entry) => entry[2]).filter(Boolean));
        for (const code of ["not-object", "keys", "version", "title", "work_type", "place", "client_display", "client_text", "client_named_ok", "value_text", "show_value", "duration_text", "delivered", "value_added", "client_text_missing", "client_not_confirmed", "value_text_missing", "disciplines", "client_text_hidden", "value_text_hidden"]) {
            expect(seen, code).toContain(code);
        }
    });
});

describe("case study content: defaults and tidying", () => {
    it("a new draft hides the client and shows no figure", () => {
        const draft = newDraft("  Kitchen at Example Road ");
        expect(draft).toMatchObject({ title: "Kitchen at Example Road", client_display: "hidden", client_text: "", client_named_ok: false, show_value: false, value_text: "" });
        expect(contentProblem(draft)).toBeNull();
        expect(approvalProblem(draft)).toBeNull();
    });

    it("loose input is rebuilt from known fields only: nothing unknown is passed through", () => {
        const content = contentFromInput({ title: " Loft \r\n conversion ", delivered: "a\r\nb\rc", client_display: "everyone", client_named_ok: "yes", show_value: 1, photos: ["https://elsewhere.example/x.jpg"], approved: true, __proto__: { injected: true } });
        expect(Object.keys(content).sort()).toEqual(["client_display", "client_named_ok", "client_text", "delivered", "duration_text", "place", "show_value", "title", "value_added", "value_text", "version", "work_type"]);
        expect(content).toMatchObject({ title: "Loft   conversion", delivered: "a\nb\nc", client_display: "hidden", client_named_ok: false, show_value: false });
        expect(contentProblem(content)).toBeNull();
        expect(contentProblem(contentFromInput(null))).toBe("title");
    });

    it("tidying does not make over-long text acceptable", () => {
        expect(contentProblem(contentFromInput({ title: "t".repeat(201) }))).toBe("title");
        expect(contentProblem(contentFromInput({ title: "ok", delivered: "d".repeat(5001) }))).toBe("delivered");
    });

    it("approving never widens what is shown", () => {
        const draft: CaseStudyContent = { ...newDraft("Job"), client_text: "Mrs Private", value_text: "£9,000", client_named_ok: true };
        const approved = approvedValue(draft, ["Roofing"]);
        expect(approved.client_display).toBe("hidden");
        expect(approved.show_value).toBe(false);
        expect(JSON.stringify(approved)).not.toContain("Mrs Private");
        expect(JSON.stringify(approved)).not.toContain("9,000");
        // The draft itself is not changed.
        expect(draft.client_text).toBe("Mrs Private");
    });

    it("labels compare by A to Z only, so every database and the application agree", () => {
        expect(labelKey("Élan Joinery")).toBe(labelKey("ÉLAN JOINERY"));
        expect(labelKey("élan joinery")).not.toBe(labelKey("Élan joinery"));
        expect(labelKey("  Kitchen   Installation ")).toBe("kitchen installation");
    });
});
