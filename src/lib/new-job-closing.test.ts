import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { minimalInput } from "./__fixtures__/proposal";
import { buildBlankProjectGraph, parseBlankProjectInput } from "./blank-project";
import {
    applyCompanyClosingMessage, draftFromProject, initialReviewState, isReviewDirty, reviewReducer,
    savedDraftFromProject, TEXT_LIMITS, type ReviewAction, type ReviewContext,
} from "./proposal-review";

// A069: a truly NEW job starts with the owner's saved managing director's
// message as its proposal-specific closing, inside the atomic creation RPC.
// The SQL part is a SOURCE contract on the latest migration that defines the
// function: it reads the files, it does not execute them against a database.
const DIR = "supabase/migrations";
const ORIGINAL_FILE = "20260930120000_atomic_phase1_project_creation.sql";
const START = "CREATE OR REPLACE FUNCTION public.create_phase1_project_graph(";
function definition(sql: string): string {
    const start = sql.indexOf(START);
    const end = sql.indexOf("$$;", start);
    if (start < 0 || end < 0) throw new Error("definition not found");
    return sql.slice(start, end + 3);
}
const files = readdirSync(DIR).filter(name => name.endsWith(".sql")).sort();
const latestFile = [...files].reverse().find(name => readFileSync(join(DIR, name), "utf8").includes(START))!;
const latest = definition(readFileSync(join(DIR, latestFile), "utf8"));
const original = definition(readFileSync(join(DIR, ORIGINAL_FILE), "utf8"));

describe("A069 creation RPC source contract (static, no database)", () => {
    it("is redefined by a later, additive migration rather than editing the applied one", () => {
        expect(latestFile > ORIGINAL_FILE).toBe(true);
        expect(readFileSync(join(DIR, ORIGINAL_FILE), "utf8")).not.toContain("closing_statement");
    });

    it("writes the owner's own managing director's message as the new job's closing, in the same insert", () => {
        const insert = latest.slice(latest.indexOf("INSERT INTO public.projects"), latest.indexOf("RETURNING id INTO v_project_id"));
        expect(insert).toMatch(/programme_phases,\s*closing_statement\s*\)/);
        expect(insert).toMatch(/COALESCE\(p_project->'programme_phases', '\[\]'::jsonb\),\s*v_closing\s*\)/);
        expect(latest).toMatch(/SELECT p\.md_message\s+INTO v_closing\s+FROM public\.profiles p\s+WHERE p\.id = v_user_id;/);
    });

    it("copies it exactly, and leaves the closing empty for a blank or over-long message", () => {
        expect(latest).toContain(`length(v_closing) > ${TEXT_LIMITS.closing}`);
        expect(latest).toMatch(/v_closing !~ '\[\^\[:space:\]\]'/);
        const assignment = latest.slice(latest.indexOf("SELECT p.md_message"), latest.indexOf("INSERT INTO public.projects"));
        expect(assignment).not.toMatch(/trim|left\(|substr|regexp_replace|overlay/i);
    });

    it("never touches an existing job: a retry returns before the message is read, and nothing updates projects", () => {
        expect(latest.indexOf("AND p.creation_request_id = p_request_id")).toBeLessThan(latest.indexOf("SELECT p.md_message"));
        expect(latest.indexOf("RETURN QUERY SELECT v_project_id, v_estimate_ids;\n        RETURN;")).toBeLessThan(latest.indexOf("SELECT p.md_message"));
        expect(latest).not.toMatch(/UPDATE public\.projects/i);
        expect(latest).not.toMatch(/p_project->>'closing_statement'|p_project->'closing_statement'/);
    });

    it("changes nothing else in the function: same signature, security and body apart from the three additions", () => {
        const stripped = latest
            .replace("    v_closing text;\n", "")
            .replace(/\n    -- A069:[\s\S]*?END IF;\n/, "")
            .replace(",\n        closing_statement\n", "\n")
            .replace(",\n        v_closing\n", "\n");
        expect(stripped).toBe(original);
    });

    it("keeps the existing grants for the redefined function", () => {
        const sql = readFileSync(join(DIR, latestFile), "utf8");
        expect(sql).toContain("REVOKE ALL ON FUNCTION public.create_phase1_project_graph(uuid, jsonb, jsonb)\n    FROM PUBLIC, anon;");
        expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.create_phase1_project_graph(uuid, jsonb, jsonb)\n    TO authenticated;");
        expect(sql).not.toMatch(/ALTER TABLE|CREATE TABLE|ADD COLUMN|DROP /i);
    });
});

describe("A069 creation request and the proposal editor", () => {
    it("never lets the browser send closing wording or the company message in the creation payload", () => {
        const parsed = parseBlankProjectInput({ name: "New job", client: "Client", requestId: "11111111-1111-4111-8111-111111111111", closing_statement: "forged", md_message: "forged" });
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        const graph = buildBlankProjectGraph(parsed.input);
        expect(JSON.stringify(graph)).not.toMatch(/closing|md_message|forged/);
    });

    it("shows a new job's stored closing as its saved proposal-specific wording, editable and removable", () => {
        const message = "  We look forward to working with you.\n\nAlex, managing director";
        const input = minimalInput();
        const context: ReviewContext = { project: { ...input.project, closing_statement: message }, profile: { ...input.profile, md_message: message }, estimate: input.estimate, nextVersion: 1 };
        let state = initialReviewState(draftFromProject(context.project, () => "key"), savedDraftFromProject(context.project, () => "key"));
        const store = { getState: () => state, dispatch: (action: ReviewAction) => { state = reviewReducer(state, action); } };
        expect(state.draft.closing).toBe(message);
        expect(state.saved.closing).toBe(message);
        expect(isReviewDirty(state)).toBe(false);
        expect(applyCompanyClosingMessage(store, "A different company message", true).ok).toBe(false);
        store.dispatch({ type: "draft/change", patch: { closing: "" } });
        expect(state.draft.closing).toBe("");
        expect(isReviewDirty(state)).toBe(true);
    });

    it("never fills an existing job whose closing is empty, whatever the company message says", () => {
        const input = minimalInput();
        const project = { ...input.project, closing_statement: null };
        const draft = draftFromProject(project, () => "key");
        expect(draft.closing).toBe("");
        expect(savedDraftFromProject(project, () => "key").closing).toBe("");
    });
});
