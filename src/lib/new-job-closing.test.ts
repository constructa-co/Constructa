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

/** ECMAScript trim whitespace (same finite set as A069 SQL blank guard). */
const ECMA_TRIM_WHITESPACE_CLASS =
    "\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF";
const A069_SQL_NONBLANK_PATTERN = new RegExp(`[^${ECMA_TRIM_WHITESPACE_CLASS}]`);
/** Auditable literal expected in the unapplied migration (locale-independent, not POSIX [:space:]). */
const A069_SQL_NONBLANK_PATTERN_LITERAL =
    "'[^[\\x{9}-\\x{d}\\x{20}\\x{a0}\\x{1680}\\x{2000}-\\x{200a}\\x{2028}-\\x{2029}\\x{202f}\\x{205f}\\x{3000}\\x{feff}]]'";

function closingEligibleByEcmascriptTrim(message: string | null): boolean {
    return message !== null && !!message.trim();
}

function closingEligibleByA069SqlPattern(message: string | null): boolean {
    return message !== null && A069_SQL_NONBLANK_PATTERN.test(message);
}

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
        expect(latest).not.toMatch(/v_closing !~ '\[\^\[:space:\]\]'/);
        expect(latest).toContain(`v_closing !~ ${A069_SQL_NONBLANK_PATTERN_LITERAL}`);
        expect(latest).toMatch(/ECMAScript String\.prototype\.trim/i);
        const assignment = latest.slice(latest.indexOf("SELECT p.md_message"), latest.indexOf("INSERT INTO public.projects"));
        expect(assignment).not.toMatch(/trim|left\(|substr|regexp_replace|overlay|octet_length|convert_to|normalize/i);
    });

    it("also refuses a message over 20,000 UTF-16 code units, the unit the editor's limit uses (P2 follow-through)", () => {
        const guard = latest.slice(latest.indexOf("SELECT p.md_message"), latest.indexOf("INSERT INTO public.projects"));
        // The cheap character guard runs first, so the split never sees empty or unbounded text.
        expect(guard.indexOf(`length(v_closing) > ${TEXT_LIMITS.closing}`)).toBeLessThan(guard.indexOf("ELSIF"));
        expect(guard).toMatch(/ELSIF \(SELECT pg_catalog\.sum\(CASE WHEN pg_catalog\.ascii\(chars\.ch\) > 65535 THEN 2 ELSE 1 END\)\s+FROM pg_catalog\.regexp_split_to_table\(v_closing, ''\) AS chars\(ch\)\) > 20000 THEN\s+[\s\S]*?v_closing := NULL;/);
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

// TypeScript reference of the SQL seed rule: ECMAScript trim blankness, then
// UTF-16 code-unit limit (Postgres splits code points; above U+FFFF counts two).
function seedsReference(message: string | null): boolean {
    if (message === null || !message.trim() || [...message].length > TEXT_LIMITS.closing) return false;
    return [...message].reduce((units, ch) => units + (ch.codePointAt(0)! > 0xffff ? 2 : 1), 0) <= TEXT_LIMITS.closing;
}
function editorAccepts(message: string): boolean {
    const input = minimalInput();
    const project = { ...input.project, closing_statement: null };
    let state = initialReviewState(draftFromProject(project, () => "key"), savedDraftFromProject(project, () => "key"));
    const store = { getState: () => state, dispatch: (action: ReviewAction) => { state = reviewReducer(state, action); } };
    return applyCompanyClosingMessage(store, message, true).ok;
}

describe("A069 blank eligibility: ECMAScript trim matches SQL source predicate (SOURCE contract, no Postgres)", () => {
    it.each([
        ["empty", "", false],
        ["ASCII whitespace only", "  \n\t\r\f\v ", false],
        ["NBSP only (U+00A0)", "\u00A0", false],
        ["BOM / ZWNBSP only (U+FEFF)", "\uFEFF", false],
        ["zero-width space only (U+200B)", "\u200B", true],
        ["Mongolian vowel separator (U+180E)", "\u180E", true],
        ["leading/trailing trim ws with text", "  Hello\u00A0  ", true],
        ["non-BMP letter", "\u{1F3D7}", true],
    ])("%s", (_label, message, eligible) => {
        expect(closingEligibleByEcmascriptTrim(message)).toBe(eligible);
        expect(closingEligibleByA069SqlPattern(message)).toBe(eligible);
        expect(!!message.trim()).toBe(eligible);
    });

    it("applyCompanyClosingMessage agrees with trim eligibility on white-only and mixed samples", () => {
        const samples = ["", " \t", "\u00A0\uFEFF", "\u200B", "\u180E", "x", " \nx\n ", "\u00A0Hi"];
        for (const message of samples) {
            const trimEligible = closingEligibleByEcmascriptTrim(message);
            expect(closingEligibleByA069SqlPattern(message)).toBe(trimEligible);
            expect(editorAccepts(message)).toBe(trimEligible && seedsReference(message));
        }
    });
});

describe("A069 UTF-16 limit: reference formula against the editor's existing rule (no SQL execution)", () => {
    const emoji = "\u{1F3D7}"; // outside the BMP: 1 code point, 2 UTF-16 units
    it.each([
        ["20,000 ordinary characters", "a".repeat(20000), true],
        ["20,001 ordinary characters", "a".repeat(20001), false],
        ["accented BMP text at 20,000", "\u00e9".repeat(20000), true],
        ["10,000 emoji (20,000 units)", emoji.repeat(10000), true],
        ["10,000 emoji and one letter (20,001 units, 10,001 characters)", emoji.repeat(10000) + "a", false],
        ["19,999 letters and one emoji (20,001 units, 20,000 characters)", "a".repeat(19999) + emoji, false],
        ["19,998 letters and one emoji (20,000 units)", "a".repeat(19998) + emoji, true],
        ["empty", "", false],
        ["whitespace only", "  \n\t ", false],
    ])("%s: seeded exactly when the editor's company-message rule accepts it", (_label, message, expected) => {
        expect(message.length <= TEXT_LIMITS.closing && !!message.trim()).toBe(expected);
        expect(seedsReference(message)).toBe(expected);
        expect(editorAccepts(message)).toBe(expected);
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
