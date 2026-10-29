import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase, type Row } from "./__fixtures__/fake-supabase";
import { minimalInput } from "./__fixtures__/proposal";
import { buildBlankProjectGraph, parseBlankProjectInput } from "./blank-project";
import {
    applyCompanyClosingMessage, draftFromProject, initialReviewState, isReviewDirty, reviewReducer,
    reviewStateFromPersistedProject, savedDraftFromProject, TEXT_LIMITS, type ReviewAction, type ReviewContext,
    type ReviewProject,
} from "./proposal-review";

const journeyAuth = vi.hoisted(() => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: journeyAuth.requireAuth }));

import { createBlankProjectAction } from "@/app/dashboard/projects/new/actions";

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
const latestMigrationSql = readFileSync(join(DIR, latestFile), "utf8");
const original = definition(readFileSync(join(DIR, ORIGINAL_FILE), "utf8"));

/** Decode PostgreSQL U&'' body (four-hex code points after UESCAPE). Not a general SQL parser. */
function decodePostgresUString(body: string, uescape: string): string {
    let out = "";
    for (let i = 0; i < body.length; i++) {
        const ch = body[i]!;
        if (ch === uescape && i + 4 < body.length && /^[0-9A-Fa-f]{4}$/.test(body.slice(i + 1, i + 5))) {
            out += String.fromCodePoint(Number.parseInt(body.slice(i + 1, i + 5), 16));
            i += 4;
            continue;
        }
        if (ch === uescape && body[i + 1] === uescape) {
            out += uescape;
            i += 1;
            continue;
        }
        out += ch;
    }
    return out;
}

const A069_GUARD_RE =
    /v_closing\s+!~\s+U&'((?:[^']|'')*)'\s+UESCAPE\s+'(.)'/;

function parseA069BlankGuardFromMigration(sql: string) {
    const m = sql.match(A069_GUARD_RE);
    if (!m) throw new Error("A069 blank guard U& literal not found");
    const uBody = m[1]!.replace(/''/g, "'");
    const uescape = m[2]!;
    const decodedPattern = decodePostgresUString(uBody, uescape);
    return { uBody, decodedPattern, jsRegExp: new RegExp(decodedPattern) };
}

function assertSupportedA069BlankGuardShape(decodedPattern: string, uBody: string): void {
    if (/\\x\{/.test(uBody)) throw new Error("A069 guard must not use PCRE \\x{...} escapes");
    if (!decodedPattern.startsWith("[^") || !decodedPattern.endsWith("]")) {
        throw new Error("A069 guard must be a single negated character class [^...]");
    }
    if (decodedPattern.startsWith("[^[")) throw new Error("A069 guard must not use nested [[");
    const inner = decodedPattern.slice(2, -1);
    if (inner.includes("[") || inner.includes("]")) {
        throw new Error("A069 class must enumerate code points only");
    }
}

const a069BlankGuard = parseA069BlankGuardFromMigration(latest);
assertSupportedA069BlankGuardShape(a069BlankGuard.decodedPattern, a069BlankGuard.uBody);

/** Reference list for generating samples only; parity uses decoded migration pattern. */
const ECMA_TRIM_CODEPOINTS = [
    0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x00a0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003,
    0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
] as const;

function closingEligibleByEcmascriptTrim(message: string | null): boolean {
    return message !== null && !!message.trim();
}

function closingEligibleByDecodedMigrationPattern(message: string | null): boolean {
    return message !== null && a069BlankGuard.jsRegExp.test(message);
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
        expect(latest).toMatch(/v_closing\s+!~\s+U&'/);
        expect(latest).not.toMatch(/\\x\{/);
        expect(latest).not.toMatch(/'\[\^\\[\[]/);
        expect(latestMigrationSql).toMatch(A069_GUARD_RE);
        assertSupportedA069BlankGuardShape(a069BlankGuard.decodedPattern, a069BlankGuard.uBody);
        expect([...a069BlankGuard.decodedPattern.slice(2, -1)].map(ch => ch.codePointAt(0)!)).toEqual([...ECMA_TRIM_CODEPOINTS]);
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

describe("A069 blank eligibility: decoded migration guard vs ECMAScript trim (SOURCE contract, no Postgres)", () => {
    it.each(ECMA_TRIM_CODEPOINTS.map(cp => [`U+${cp.toString(16).toUpperCase().padStart(4, "0")}`, String.fromCodePoint(cp), false] as const))(
        "each ECMA trim whitespace %s is ineligible",
        (_label, message, eligible) => {
            expect(closingEligibleByEcmascriptTrim(message)).toBe(eligible);
            expect(closingEligibleByDecodedMigrationPattern(message)).toBe(eligible);
        },
    );

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
        expect(closingEligibleByDecodedMigrationPattern(message)).toBe(eligible);
        expect(!!message.trim()).toBe(eligible);
    });

    it("applyCompanyClosingMessage agrees with decoded guard on white-only and mixed samples", () => {
        const samples = ["", " \t", "\u00A0\uFEFF", "\u200B", "\u180E", "x", " \nx\n ", "\u00A0Hi"];
        for (const message of samples) {
            const trimEligible = closingEligibleByEcmascriptTrim(message);
            expect(closingEligibleByDecodedMigrationPattern(message)).toBe(trimEligible);
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

const JOURNEY_USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const JOURNEY_REQUEST = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function journeyFormData() {
    const fd = new FormData();
    fd.set("requestId", JOURNEY_REQUEST);
    fd.set("name", "New journey job");
    fd.set("client", "Journey Client");
    return fd;
}

/** Fake RPC outcome: persist closing from profile md_message with trim eligibility only (not Postgres). */
function installA069CreateRpc(db: ReturnType<typeof fakeSupabase>, userId: string) {
    const committed = new Map<string, string>();
    db.onRpc((name, args) => {
        if (name !== "create_phase1_project_graph") return { data: null, error: null };
        const requestId = String(args.p_request_id);
        if (committed.has(requestId)) {
            return { data: [{ project_id: committed.get(requestId), estimate_ids: [] }], error: null };
        }
        const profile = (db.tables.profiles ?? []).find(row => row.id === userId);
        const md = typeof profile?.md_message === "string" ? profile.md_message : null;
        const closing = md && md.trim() ? md : null;
        const payload = args.p_project as Row;
        const projectId = `project-${(db.tables.projects?.length ?? 0) + 1}`;
        db.tables.projects = db.tables.projects ?? [];
        db.tables.projects.push({
            id: projectId,
            user_id: userId,
            name: payload.name,
            client_name: payload.client_name,
            closing_statement: closing,
            payment_schedule: [],
            programme_phases: [],
        });
        committed.set(requestId, projectId);
        return { data: [{ project_id: projectId, estimate_ids: [] }], error: null };
    });
}

async function loadPersistedProjectForProposal(supabase: { from: ReturnType<typeof fakeSupabase>["client"]["from"] }, projectId: string) {
    const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).eq("user_id", JOURNEY_USER).single();
    expect(error).toBeNull();
    return data as ReviewProject;
}

describe("A069 new job creation → persisted row → proposal review (fake Supabase, not Postgres)", () => {
    beforeEach(() => {
        journeyAuth.requireAuth.mockReset();
    });

    it("maps RPC-persisted closing into saved proposal-specific wording after create returns projectId", async () => {
        const mdMessage = "  We look forward to working with you.\n\nAlex, managing director";
        const db = fakeSupabase({
            profiles: [{ id: JOURNEY_USER, md_message: mdMessage }],
            projects: [],
        });
        installA069CreateRpc(db, JOURNEY_USER);
        journeyAuth.requireAuth.mockResolvedValue({ supabase: db.client });

        const created = await createBlankProjectAction(journeyFormData());
        expect(created).toEqual({ success: true, projectId: "project-1" });

        const row = await loadPersistedProjectForProposal(db.client, "project-1");
        expect(row.closing_statement).toBe(mdMessage);

        let state = reviewStateFromPersistedProject(row, () => "key");
        const store = { getState: () => state, dispatch: (action: ReviewAction) => { state = reviewReducer(state, action); } };
        expect(state.draft.closing).toBe(mdMessage);
        expect(state.saved.closing).toBe(mdMessage);
        expect(isReviewDirty(state)).toBe(false);
        expect(applyCompanyClosingMessage(store, "Different company message", true).ok).toBe(false);
        store.dispatch({ type: "draft/change", patch: { closing: "" } });
        expect(state.draft.closing).toBe("");
        expect(isReviewDirty(state)).toBe(true);
    });

    it("keeps the same persisted closing on idempotent create retry", async () => {
        const mdMessage = "Signed, the director";
        const db = fakeSupabase({ profiles: [{ id: JOURNEY_USER, md_message: mdMessage }], projects: [] });
        installA069CreateRpc(db, JOURNEY_USER);
        journeyAuth.requireAuth.mockResolvedValue({ supabase: db.client });

        const first = await createBlankProjectAction(journeyFormData());
        const retry = await createBlankProjectAction(journeyFormData());
        expect(retry).toEqual(first);

        const row = await loadPersistedProjectForProposal(db.client, "project-1");
        expect(reviewStateFromPersistedProject(row, () => "k").saved.closing).toBe(mdMessage);
    });

    it("leaves closing empty when profile message is blank-eligible only", async () => {
        const db = fakeSupabase({ profiles: [{ id: JOURNEY_USER, md_message: "\u00A0\uFEFF" }], projects: [] });
        installA069CreateRpc(db, JOURNEY_USER);
        journeyAuth.requireAuth.mockResolvedValue({ supabase: db.client });

        const created = await createBlankProjectAction(journeyFormData());
        expect(created.success).toBe(true);
        if (!created.success) return;

        const row = await loadPersistedProjectForProposal(db.client, created.projectId);
        expect(row.closing_statement).toBeNull();
        expect(reviewStateFromPersistedProject(row, () => "k").draft.closing).toBe("");
    });

    it("does not rewrite closing from a later profile message change", async () => {
        const original = "Original saved closing";
        const db = fakeSupabase({ profiles: [{ id: JOURNEY_USER, md_message: original }], projects: [] });
        installA069CreateRpc(db, JOURNEY_USER);
        journeyAuth.requireAuth.mockResolvedValue({ supabase: db.client });

        const created = await createBlankProjectAction(journeyFormData());
        expect(created.success).toBe(true);
        if (!created.success) return;

        db.tables.profiles![0]!.md_message = "Profile changed after the job was created";
        const row = await loadPersistedProjectForProposal(db.client, created.projectId);
        expect(row.closing_statement).toBe(original);
        expect(reviewStateFromPersistedProject(row, () => "k").draft.closing).toBe(original);
    });
});
