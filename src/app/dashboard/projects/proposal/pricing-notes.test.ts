import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";
import { minimalInput } from "@/lib/__fixtures__/proposal";
import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { buildProposalDocument } from "@/lib/proposal-document";
import { draftFromProject } from "@/lib/proposal-review";

const access = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/project-resource-access", () => ({ requireEditableProjectAccess: access }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { savePricingScopeNotesAction } from "./actions";

const id = "22222222-2222-4222-8222-222222222222", userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const source = { exclusions_text: null, clarifications_text: null, contract_exclusions: null, contract_clarifications: null };
const notes = { exclusions: "Client supplies appliances.\nNo decorating.", clarifications: "Daytime access only." };
let db: ReturnType<typeof fakeSupabase>;
beforeEach(() => {
    db = fakeSupabase({ projects: [{ id, user_id: userId, ...source, scope_text: "Keep scope", payment_schedule: [{ stage: "Keep payment", percentage: 40 }], tc_overrides: [{ body: "Keep terms" }], closing_statement: "Keep closing" }] });
    access.mockReset().mockResolvedValue({ supabase: db.client, user: { id: userId } });
});
describe("pricing exclusions and clarifications only", () => {
    it("writes only reviewed notes under owner and all source-value guards, with stored acknowledgement", async () => {
        const before = { ...db.tables.projects[0] };
        const result = await savePricingScopeNotesAction(id, source, notes);
        expect(result).toEqual({ success: true, source: { ...source, exclusions_text: notes.exclusions, clarifications_text: notes.clarifications } });
        expect(db.updates).toEqual([{ table: "projects", values: { exclusions_text: notes.exclusions, clarifications_text: notes.clarifications }, filters: { id, user_id: userId, ...source } }]);
        expect(db.tables.projects[0]).toEqual({ ...before, exclusions_text: notes.exclusions, clarifications_text: notes.clarifications });
    });
    it("carries confirmed notes into reopened proposal review, immutable snapshot and document", async () => {
        await savePricingScopeNotesAction(id, source, notes);
        const input = minimalInput(), project = { ...input.project, ...db.tables.projects[0] };
        const draft = draftFromProject(project, () => "unused");
        expect(draft.exclusions).toBe(notes.exclusions); expect(draft.clarifications).toBe(notes.clarifications);
        const snapshot = buildProposalPublicationSnapshot({ ...input, project });
        expect(snapshot.content.exclusions).toBe(notes.exclusions); expect(snapshot.content.clarifications).toBe(notes.clarifications);
        const document = buildProposalDocument(snapshot);
        const scope = document.sections.find(section => section.id === "scope")!;
        expect(scope.blocks).toContainEqual({ type: "bullets", items: ["Client supplies appliances.", "No decorating."] });
        expect(scope.blocks).toContainEqual({ type: "bullets", items: ["Daytime access only."] });
    });
    it("allows deliberate clearing when no legacy fallback would reappear", async () => {
        const current = { ...source, exclusions_text: "Previously not included" }; Object.assign(db.tables.projects[0], current);
        expect(await savePricingScopeNotesAction(id, current, { exclusions: " ", clarifications: "" })).toEqual({ success: true, source });
    });
    it.each(["exclusions", "clarifications"] as const)("retains the existing %s limit without truncation", async field => {
        expect((await savePricingScopeNotesAction(id, source, { ...notes, [field]: "x".repeat(10000) })).success).toBe(true);
        access.mockClear(); db.updates.length = 0;
        expect((await savePricingScopeNotesAction(id, source, { ...notes, [field]: "x".repeat(10001) })).success).toBe(false);
        expect(access).not.toHaveBeenCalled(); expect(db.updates).toEqual([]);
    });
    it("refuses stale proposal notes rather than overwriting another editor", async () => {
        db.tables.projects[0].exclusions_text = "Changed elsewhere";
        expect(await savePricingScopeNotesAction(id, source, notes)).toMatchObject({ success: false, error: expect.stringMatching(/changed/) });
        expect(db.updates).toEqual([]);
    });
    it("also refuses a legacy fallback changed after the contractor reviewed it", async () => {
        db.tables.projects[0].contract_clarifications = "New legacy clarification";
        expect((await savePricingScopeNotesAction(id, source, notes)).success).toBe(false); expect(db.updates).toEqual([]);
    });
    it.each(["exclusions", "clarifications"] as const)("does not pretend clearing %s removed legacy fallback notes", async field => {
        const current = { ...source, [`contract_${field}`]: "Existing contract note" }; Object.assign(db.tables.projects[0], current);
        expect(await savePricingScopeNotesAction(id, current, { ...notes, [field]: "" })).toMatchObject({ success: false, error: expect.stringMatching(/contract notes/) });
        expect(db.updates).toEqual([]); expect(db.tables.projects[0][`contract_${field}`]).toBe("Existing contract note");
    });
    it("permits a reviewed override without modifying legacy contract notes", async () => {
        const current = { ...source, contract_exclusions: "Old contract note" }; Object.assign(db.tables.projects[0], current);
        expect((await savePricingScopeNotesAction(id, current, notes)).success).toBe(true);
        expect(db.tables.projects[0].contract_exclusions).toBe("Old contract note");
    });
    it("refuses an edit lock or different owner before writing", async () => {
        access.mockRejectedValueOnce(Error("This proposal has been accepted. Record later scope or price changes as variations."));
        expect(await savePricingScopeNotesAction(id, source, notes)).toMatchObject({ success: false, error: expect.stringContaining("accepted") });
        expect(db.log).toEqual([]); db.tables.projects[0].user_id = "other";
        expect((await savePricingScopeNotesAction(id, source, notes)).success).toBe(false); expect(db.updates).toEqual([]);
    });
    it("refuses a missing or unreadable saved source", async () => {
        db.fail("projects", "select"); expect((await savePricingScopeNotesAction(id, source, notes)).success).toBe(false);
        db.tables.projects = []; expect((await savePricingScopeNotesAction(id, source, notes)).success).toBe(false); expect(db.updates).toEqual([]);
    });
    it("does not acknowledge a database rejection or lost affected row", async () => {
        db.fail("projects", "update"); expect(await savePricingScopeNotesAction(id, source, notes)).toMatchObject({ success: false, uncertain: true });
        const from = db.client.from;
        vi.spyOn(db.client, "from").mockImplementation(table => {
            const builder = from(table), update = builder.update;
            builder.update = values => { db.tables.projects[0].contract_exclusions = "Concurrent contract edit"; return update(values); };
            return builder;
        });
        expect(await savePricingScopeNotesAction(id, source, notes)).toMatchObject({ success: false, uncertain: true });
    });
});
