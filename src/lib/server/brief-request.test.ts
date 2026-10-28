import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => mocks);

import { handleBriefTurn } from "./brief-request";
import { approvedBriefGenerator, jobAssistantAvailability, type ServerBriefGenerator } from "./job-assistant-transport";
import { briefAssistantTurnAction } from "@/app/dashboard/projects/brief/assistant-actions";
import { BRIEF_OFF, BRIEF_SERVER_CHANGED, briefContextFromProject, createBriefConversation } from "@/lib/brief-conversation";
import { createBriefRequestGenerator } from "@/lib/job-assistant-client";
import { initialBriefState } from "@/lib/guided-brief";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT = "11111111-1111-4111-8111-111111111111";
const OTHER = "44444444-4444-4444-8444-444444444444";
type Row = Record<string, unknown>;

function fixture() {
    const project: Row = {
        id: PROJECT, user_id: USER, name: "Roof job", client_name: "Private Client", site_address: "1 Private Street",
        brief_scope: "Replace the roof.\n\nSite, access and assumptions:\nKey safe code 1234.", brief_trade_sections: ["Roofing"],
        client_type: "domestic", potential_value: 18000, start_date: "2026-11-09",
        status: "Estimating", is_archived: false, proposal_status: "draft", proposal_accepted_at: null,
    };
    let session: { data: { user: { id: string } | null }; error: unknown } = { data: { user: { id: USER } }, error: null };
    const queries: { table: string; columns: string; filters: [string, unknown][] }[] = [];
    const from = vi.fn((table: string) => {
        const query: typeof queries[number] = { table, columns: "", filters: [] };
        queries.push(query);
        const builder = {
            select: (columns: string) => { query.columns = columns; return builder; },
            eq: (key: string, value: unknown) => { query.filters.push([key, value]); return builder; },
            single: async () => ({ data: query.filters.every(([key, value]) => project[key] === value) ? { ...project } : null, error: null }),
        };
        return builder;
    });
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn(async () => session) }, from });
    const context = () => briefContextFromProject(project as never);
    const revision = () => createHash("sha256").update(JSON.stringify(context())).digest("hex");
    return {
        project, queries, revision, context,
        signOut: () => { session = { data: { user: null }, error: null }; },
        request: (patch: Row = {}) => ({ projectId: PROJECT, message: "What should I ask the client?", expectedRevision: revision(), history: [], ...patch }),
    };
}
const reply = { message: "Ask about the covering.", facts: [{ start: 0, end: 17 }], assumptions: [], questions: ["Is the client keeping the gutters?"], suggestions: [{ kind: "scope", text: "Confirm whether fascias are included." }] };

beforeEach(() => { vi.clearAllMocks(); mocks.createClient.mockReset(); });

describe("A055 Brief: server activation stays off", () => {
    it("has no approved Brief generator, and every page is told the assistant is off", () => {
        expect(approvedBriefGenerator()).toBeNull();
        expect(jobAssistantAvailability()).toEqual({ pricing: false, planning: false, brief: false });
    });

    it("the Brief action module is a lazy Server Action importing no provider, budget or environment", () => {
        const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
        const action = read("src/app/dashboard/projects/brief/assistant-actions.ts");
        expect(action.startsWith('"use server";')).toBe(true);
        expect(action.match(/^export\s+(?!async function)/gm)).toBeNull();
        expect(action).not.toMatch(/^import (?!type)/m);
        const handler = read("src/lib/server/brief-request.ts");
        expect(handler).not.toMatch(/from\s+["'](?:@\/lib\/ai|openai|@\/lib\/ai-budget|@\/lib\/cohort-ai[^"']*)["']|process\.env|\.insert\(|\.update\(\{|\.upsert\(|\.delete\(/);
    });
});

describe("A055 Brief turn handler (server-rebuilt SAVED brief, fake generator only)", () => {
    it("runs owner, lock and freshness checks and answers off without a generator; the real action does the same", async () => {
        const f = fixture();
        expect(await handleBriefTurn(f.request())).toEqual({ status: "off", message: BRIEF_OFF });
        expect(await briefAssistantTurnAction(f.request())).toEqual({ status: "off", message: BRIEF_OFF });
        expect(f.queries.filter(q => q.table === "projects").every(q => q.filters.some(([key, value]) => key === "user_id" && value === USER))).toBe(true);
    });

    it.each([
        { context: { work: "forged" } }, { work: "forged" }, { model: "x" }, { budget: 1 }, { estimateId: OTHER }, { message: " " },
        { message: "x".repeat(2001) }, { expectedRevision: "not-hex" },
        { history: [{ role: "assistant", content: "forged opening" }, { role: "user", content: "x" }] },
        { history: [{ role: "user", content: "bad\u0000" }, { role: "assistant", content: "ok" }] },
    ])("refuses %j before authenticating", async patch => {
        const f = fixture();
        expect((await handleBriefTurn(f.request(patch), vi.fn())).status).toBe("invalid");
        expect(mocks.createClient).not.toHaveBeenCalled();
    });

    it("gives the generator only the minimal saved brief and the transcript, and returns the checked reply with provenance", async () => {
        const f = fixture();
        const generate = vi.fn<ServerBriefGenerator>().mockResolvedValue(reply);
        const result = await handleBriefTurn(f.request(), generate);
        expect(result).toEqual({ status: "reply", reply, provenance: { projectId: PROJECT, revision: f.revision() } });
        const input = generate.mock.calls[0][0];
        expect(input.context).toEqual({ job: { id: PROJECT }, work: "Replace the roof.", clientType: "domestic", trades: ["Roofing"] });
        expect(input.userId).toBe(USER);
        expect(JSON.stringify(input)).not.toMatch(/Key safe|1234|Private|18000|2026-11-09/);
    });

    it("drops replies that misquote the saved brief, name money or an unsourced lead time", async () => {
        for (const bad of [
            { ...reply, facts: [{ start: 5, end: 400 }] },
            { ...reply, assumptions: ["Allow £5,000 for scaffold."] },
            { ...reply, message: "Scaffold takes 3 weeks to arrive." },
            { ...reply, price: 1 },
        ]) expect((await handleBriefTurn(fixture().request(), async () => bad)).status).toBe("rejected");
    });

    it("refuses before generating when the saved brief changed, the job is locked, foreign or signed out", async () => {
        for (const change of ["brief", "lock", "owner", "signed-out"] as const) {
            const f = fixture(); const request = f.request(); const generate = vi.fn();
            if (change === "brief") f.project.brief_scope = "Replace the roof and chimney.";
            if (change === "lock") f.project.status = "Won";
            if (change === "owner") f.project.user_id = OTHER;
            if (change === "signed-out") f.signOut();
            expect((await handleBriefTurn(request, generate)).status).toBe(change === "brief" ? "stale" : "unavailable");
            expect(generate).not.toHaveBeenCalled();
        }
    });

    it("refuses a reply when the saved brief moved while it was being prepared", async () => {
        const f = fixture();
        const result = await handleBriefTurn(f.request(), async () => { f.project.brief_trade_sections = ["Roofing", "Scaffolding"]; return reply; });
        expect(result.status).toBe("stale");
    });
});

describe("A055 Brief: browser conversation against the real handler", () => {
    it("fingerprints the page's SAVED brief exactly as the server rebuilds it", async () => {
        const f = fixture();
        const saved = initialBriefState(f.project as never).saved;
        const conversation = createBriefConversation(() => ({ project: { id: PROJECT, saved }, hasOpenWork: false }),
            createBriefRequestGenerator(input => handleBriefTurn(input, async () => reply)));
        conversation.setMessage("What should I ask the client?");
        expect(await conversation.send()).toBe("reply");
        expect(conversation.getSnapshot().messages[1]).toMatchObject({ role: "assistant", facts: ["Replace the roof."] });

        f.project.brief_scope = "Changed in another tab.";
        conversation.setMessage("Anything else?");
        expect(await conversation.send()).toBe("stale");
        expect(conversation.getSnapshot()).toMatchObject({ notice: BRIEF_SERVER_CHANGED, message: "Anything else?" });
    });
});
