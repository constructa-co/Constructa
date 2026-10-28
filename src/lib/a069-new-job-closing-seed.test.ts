import { describe, expect, it } from "vitest";
import { buildBlankProjectGraph, parseBlankProjectInput } from "./blank-project";
import { draftFromProject } from "./proposal-review";
import { minimalInput } from "./__fixtures__/proposal";
import {
    A069_BLOCKER_PHASE1_CREATE_RPC_NO_CLOSING_STATEMENT_SLOT,
    A069_RECOMMENDATION,
    PHASE1_CREATE_PROJECT_PERSISTED_FROM_PAYLOAD,
    approvedClosingSeedFromProfile,
    phase1CreateRpcPersistsClosingStatement,
} from "./a069-new-job-closing-seed";

const REQUEST_ID = "3f0c1f4e-7c1b-4a55-9a43-0d0a6c0f7b11";

function parsedInput() {
    const result = parseBlankProjectInput({ requestId: REQUEST_ID, name: "New job", client: "Client" });
    if (!result.ok) throw new Error(result.error);
    return result.input;
}

describe("A069 new-job closing seed contract (335a56a pin)", () => {
    it("names the exact blocker: atomic create RPC has no closing_statement slot", () => {
        expect(phase1CreateRpcPersistsClosingStatement()).toBe(false);
        expect(PHASE1_CREATE_PROJECT_PERSISTED_FROM_PAYLOAD).not.toContain("closing_statement");
        expect(A069_BLOCKER_PHASE1_CREATE_RPC_NO_CLOSING_STATEMENT_SLOT).toBe("create_phase1_project_graph");
        expect(A069_RECOMMENDATION).toMatch(/create_phase1_project_graph/);
        expect(A069_RECOMMENDATION).toMatch(/profiles\.md_message/);
        expect(A069_RECOMMENDATION).not.toMatch(/sessionStorage|provenance field/i);
    });

    it("uses existing approved source: exact profiles.md_message within closing limit", () => {
        const md = "We look forward to working with you.\n\nAlex, MD";
        expect(approvedClosingSeedFromProfile(md)).toBe(md);
        expect(approvedClosingSeedFromProfile("  ")).toBeNull();
        expect(approvedClosingSeedFromProfile("x".repeat(20_001))).toBeNull();
        expect(approvedClosingSeedFromProfile("x".repeat(20_000))).toHaveLength(20_000);
    });

    it("blank project create payload omits closing_statement until RPC accepts it", () => {
        const project = buildBlankProjectGraph(parsedInput()).project as Record<string, unknown>;
        expect(project).not.toHaveProperty("closing_statement");
    });

    it("does not reinterpret legacy null or empty existing proposal closings", () => {
        const input = minimalInput().project;
        expect(draftFromProject({ ...input, closing_statement: null }, () => "k").closing).toBe("");
        expect(draftFromProject({ ...input, closing_statement: "" }, () => "k").closing).toBe("");
        expect(draftFromProject({ ...input, closing_statement: "Saved override" }, () => "k").closing).toBe("Saved override");
    });
});
