import { describe, expect, it } from "vitest";
import {
    BLANK_PROJECT_CREATE_ERROR,
    EMPTY_BLANK_PROJECT_FORM,
    UNSPECIFIED_PROJECT_TYPE,
    briefPathForProject,
    buildBlankProjectGraph,
    parseBlankProjectInput,
    resolveBlankProjectCreation,
    validateBlankProjectForm,
} from "./blank-project";
import { PROJECT_TEMPLATES } from "./templates";

const REQUEST_ID = "3f0c1f4e-7c1b-4a55-9a43-0d0a6c0f7b11";

function parse(overrides: Record<string, unknown> = {}) {
    const result = parseBlankProjectInput({
        requestId: REQUEST_ID,
        name: "14 Oak Road rear extension",
        client: "Alex Client",
        ...overrides,
    });
    if (!result.ok) throw new Error(result.error);
    return result.input;
}

describe("parseBlankProjectInput", () => {
    it("needs only a job name and a client name", () => {
        expect(parse()).toMatchObject({
            requestId: REQUEST_ID,
            name: "14 Oak Road rear extension",
            client: "Alex Client",
            clientEmail: "",
            projectType: "",
            startDate: "",
            potentialValue: null,
        });
    });

    it("reports the missing required answers in plain language", () => {
        const result = validateBlankProjectForm(EMPTY_BLANK_PROJECT_FORM, REQUEST_ID);
        expect(result).toEqual({
            ok: false,
            error: "Give the job a name.",
            fieldErrors: { name: "Give the job a name.", client: "Add the client's name." },
        });
    });

    it("checks optional answers only when they are filled in", () => {
        const result = parseBlankProjectInput({
            requestId: REQUEST_ID,
            name: "Job",
            client: "Client",
            clientEmail: "not-an-email",
            startDate: "next week",
            potentialValue: "lots",
        });
        expect(result.ok).toBe(false);
        expect(!result.ok && Object.keys(result.fieldErrors).sort()).toEqual(["clientEmail", "potentialValue", "startDate"]);
    });

    it("accepts a rough value typed with a pound sign and commas", () => {
        expect(parse({ potentialValue: "£45,000" }).potentialValue).toBe(45000);
        expect(parseBlankProjectInput({ requestId: REQUEST_ID, name: "J", client: "C", potentialValue: "-5" }).ok).toBe(false);
    });

    it("rejects a missing or malformed request id", () => {
        expect(parseBlankProjectInput({ requestId: "", name: "Job", client: "Client" }).ok).toBe(false);
        expect(parseBlankProjectInput({ requestId: "abc", name: "Job", client: "Client" }).ok).toBe(false);
    });
});

describe("buildBlankProjectGraph", () => {
    it("creates no estimates and therefore no estimate lines", () => {
        expect(buildBlankProjectGraph(parse()).estimates).toEqual([]);
    });

    it("sends only the contractor's own inputs in the project row", () => {
        const graph = buildBlankProjectGraph(parse());
        expect(graph.project).toEqual({
            name: "14 Oak Road rear extension",
            client_name: "Alex Client",
            client_email: null,
            client_phone: null,
            client_address: null,
            site_address: null,
            project_type: UNSPECIFIED_PROJECT_TYPE,
            start_date: null,
            potential_value: null,
            status: "Lead",
            proposal_complexity: "full",
        });
    });

    it("carries no seeded scope, introduction, trade sections, programme or template", () => {
        const project = buildBlankProjectGraph(parse()) .project as Record<string, unknown>;
        for (const key of [
            "brief_scope",
            "scope_text",
            "proposal_introduction",
            "brief_trade_sections",
            "brief_completed",
            "programme_phases",
            "template_id",
        ]) {
            expect(project).not.toHaveProperty(key);
        }
    });

    it("contains nothing from the hardcoded project templates", () => {
        const payload = JSON.stringify(buildBlankProjectGraph(parse({ projectType: "Residential Extension" })));
        for (const template of PROJECT_TEMPLATES) {
            for (const item of template.items) {
                expect(payload).not.toContain(item.name);
                for (const line of item.lines) expect(payload).not.toContain(line.desc);
            }
        }
    });

    it("does not let the database default the type to Extension when none was chosen", () => {
        expect(buildBlankProjectGraph(parse()).project.project_type).toBe("Other");
        expect(buildBlankProjectGraph(parse({ projectType: "Roofing" })).project.project_type).toBe("Roofing");
    });

    it("keeps optional answers exactly as typed, without filling one address from the other", () => {
        const graph = buildBlankProjectGraph(parse({
            clientEmail: " alex@example.test ",
            clientPhone: "07700 900000",
            siteAddress: "14 Oak Road",
            startDate: "2026-11-02",
            potentialValue: "45000",
        }));
        expect(graph.project).toMatchObject({
            client_email: "alex@example.test",
            client_phone: "07700 900000",
            site_address: "14 Oak Road",
            client_address: null,
            start_date: "2026-11-02",
            potential_value: 45000,
        });
    });

    it("keeps the caller's request id so a retry is idempotent", () => {
        expect(buildBlankProjectGraph(parse()).requestId).toBe(REQUEST_ID);
    });
});

describe("resolveBlankProjectCreation", () => {
    it("returns the created project id from a row or a one-row array", () => {
        expect(resolveBlankProjectCreation({ project_id: "p1", estimate_ids: [] }, null)).toEqual({ success: true, projectId: "p1" });
        expect(resolveBlankProjectCreation([{ project_id: "p1", estimate_ids: [] }], null)).toEqual({ success: true, projectId: "p1" });
    });

    it("returns a retryable message when the call failed or returned nothing", () => {
        const failed = { success: false, error: BLANK_PROJECT_CREATE_ERROR };
        expect(resolveBlankProjectCreation(null, { message: "boom" })).toEqual(failed);
        expect(resolveBlankProjectCreation(null, null)).toEqual(failed);
        expect(resolveBlankProjectCreation([], null)).toEqual(failed);
        expect(resolveBlankProjectCreation({ project_id: "p1" }, { message: "boom" })).toEqual(failed);
    });
});

describe("briefPathForProject", () => {
    it("routes to the named project's Brief", () => {
        expect(briefPathForProject("p1")).toBe("/dashboard/projects/brief?projectId=p1");
    });
});
