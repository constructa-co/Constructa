import { beforeEach, describe, expect, it, vi } from "vitest";
import { representativeInput } from "@/lib/__fixtures__/proposal";
import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { fakeDb } from "./__fixtures__/fake-db";
import { SITE, fakeNetwork, html } from "./__fixtures__/site";
import { IMPORT_PERMISSION_ERROR, IMPORT_PREVIEWS_PER_HOUR, IMPORT_RATE_ERROR, IMPORT_SAVE_ERROR, type ImportDraft } from "./draft";
import { IMPORT_DRAFT_GONE_ERROR, applyImport, latestImportDraft, previewImport, refreshAgainstProfile, toDraft } from "./service";

const ALPHA = "aaaaaaaa-0000-4000-8000-000000000001";
const BETA = "bbbbbbbb-0000-4000-8000-000000000002";
const URL_INPUT = { url: "www.smithbuilders.co.uk", permissionConfirmed: true };

const seed = () => fakeDb({
    profiles: [
        { id: ALPHA, company_name: "Smith Builders", phone: "0113 000 0000", website: null, specialisms: "", sales_email: null, address: null, company_number: null, vat_number: null, capability_statement: "Our own words." },
        { id: BETA, company_name: "Beta Joinery", phone: "0161 000 0000", website: null, specialisms: null, sales_email: null, address: null, company_number: null, vat_number: null },
    ],
});

async function previewed(db = seed(), net = fakeNetwork(SITE)) {
    const result = await previewImport({ supabase: db.client, userId: ALPHA, network: net.network }, URL_INPUT);
    if (!result.ok) throw new Error(`preview failed: ${result.error}`);
    return { db, net, draft: result.draft };
}

const item = (draft: ImportDraft, field: string) => draft.items.find((entry) => entry.field === field)!;
const contractorSeenByClients = (profile: Record<string, unknown>) =>
    buildProposalPublicationSnapshot({ ...representativeInput(), profile: { ...representativeInput().profile, ...profile } }).contractor;

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("previewImport", () => {
    it("does nothing without explicit permission: no lookup, no request, no draft", async () => {
        for (const permissionConfirmed of [false, undefined, "true", 1, null]) {
            const db = seed();
            const net = fakeNetwork(SITE);
            const result = await previewImport({ supabase: db.client, userId: ALPHA, network: net.network }, { url: "www.smithbuilders.co.uk", permissionConfirmed });
            expect(result).toEqual({ ok: false, error: IMPORT_PERMISSION_ERROR });
            expect(net.resolved).toEqual([]);
            expect(net.requests).toEqual([]);
            expect(db.writes).toEqual([]);
        }
    });

    it("shows suggestions beside what is saved, with source, excerpt and times, and changes nothing on the profile", async () => {
        const before = JSON.stringify(seed().tables.profiles);
        const { db, draft } = await previewed();

        expect(JSON.stringify(db.tables.profiles)).toBe(before);
        expect(db.writes.map((write) => `${write.op}:${write.table}`)).toEqual(["insert:company_import_drafts"]);
        expect(db.writes[0].values.user_id).toBe(ALPHA);

        expect(draft.website).toBe("https://www.smithbuilders.co.uk");
        expect(draft.sourceUrl).toBe("https://www.smithbuilders.co.uk/");
        expect(draft.fetchedAt).toBe("2026-10-07T10:00:00.000Z");
        expect(draft.permissionConfirmedAt).toBe("2026-10-07T10:00:00.000Z");
        expect(draft.pages).toHaveLength(4);

        expect(item(draft, "company_name")).toMatchObject({ existing: "Smith Builders", proposed: "Smith Builders Ltd", status: "pending", appliedAt: null });
        expect(item(draft, "phone")).toMatchObject({ existing: "0113 000 0000", proposed: "0113 496 0000", status: "pending" });
        expect(item(draft, "website")).toMatchObject({ existing: null, proposed: "https://www.smithbuilders.co.uk" });
        for (const entry of draft.items) {
            expect(entry.sourceUrl, entry.field).toMatch(/^https:\/\/www\.smithbuilders\.co\.uk\//);
            expect(entry.excerpt.length, entry.field).toBeGreaterThan(0);
        }
        // Bank details, logos, the company story and case studies are never suggested.
        expect(draft.items.map((entry) => entry.field).sort()).toEqual(["address", "company_name", "company_number", "phone", "sales_email", "specialisms", "vat_number", "website"]);
    });

    it("marks a suggestion that already matches as nothing to change", async () => {
        const db = seed();
        db.profile(ALPHA).phone = " 0113  496 0000 ";
        const { draft } = await previewed(db);
        expect(item(draft, "phone").status).toBe("same");
    });

    it("explains a hostile or unusable address without looking anything up", async () => {
        for (const url of ["http://169.254.169.254/latest/meta-data/", "http://localhost:3000", "https://admin:pw@www.smithbuilders.co.uk", "file:///etc/passwd", "http://[::1]/", "not a url"]) {
            const db = seed();
            const net = fakeNetwork(SITE);
            const result = await previewImport({ supabase: db.client, userId: ALPHA, network: net.network }, { url, permissionConfirmed: true });
            expect(result.ok, url).toBe(false);
            expect(net.resolved, url).toEqual([]);
            expect(db.writes, url).toEqual([]);
            // The message never repeats internal detail back.
            if (!result.ok) expect(result.error, url).not.toMatch(/169\.254|localhost|127\.0|::1|passwd/);
        }
    });

    it("reports an unavailable website, saves no draft, keeps manual entry open, and works on retry", async () => {
        const db = seed();
        const down = fakeNetwork({ ...SITE, "https://www.smithbuilders.co.uk/": html("down", 503) });
        const failed = await previewImport({ supabase: db.client, userId: ALPHA, network: down.network }, URL_INPUT);
        expect(failed.ok).toBe(false);
        if (!failed.ok) expect(failed.error).toContain("by hand");
        expect(db.writes).toEqual([]);
        expect(db.tables.company_import_drafts).toEqual([]);

        const retried = await previewImport({ supabase: db.client, userId: ALPHA, network: fakeNetwork(SITE).network }, URL_INPUT);
        expect(retried.ok).toBe(true);
        expect(db.tables.company_import_drafts).toHaveLength(1);
    });

    it("fails cleanly when the draft cannot be saved, and works on retry", async () => {
        const db = seed();
        db.fail("company_import_drafts", "insert");
        const failed = await previewImport({ supabase: db.client, userId: ALPHA, network: fakeNetwork(SITE).network }, URL_INPUT);
        expect(failed.ok).toBe(false);
        expect(db.tables.company_import_drafts).toEqual([]);
        expect((await previewImport({ supabase: db.client, userId: ALPHA, network: fakeNetwork(SITE).network }, URL_INPUT)).ok).toBe(true);
    });

    it("limits how often one contractor can have a website read, without affecting another", async () => {
        const db = seed();
        for (let index = 0; index < IMPORT_PREVIEWS_PER_HOUR; index += 1) await previewed(db);
        const net = fakeNetwork(SITE);
        expect(await previewImport({ supabase: db.client, userId: ALPHA, network: net.network }, URL_INPUT)).toEqual({ ok: false, error: IMPORT_RATE_ERROR });
        expect(net.resolved).toEqual([]);
        expect((await previewImport({ supabase: db.client, userId: BETA, network: fakeNetwork(SITE).network }, URL_INPUT)).ok).toBe(true);
    });

    it("does not fetch when recent use cannot be counted", async () => {
        const db = seed();
        db.fail("company_import_drafts", "select");
        const net = fakeNetwork(SITE);
        expect((await previewImport({ supabase: db.client, userId: ALPHA, network: net.network }, URL_INPUT)).ok).toBe(false);
        expect(net.resolved).toEqual([]);
    });
});

describe("applyImport", () => {
    it("saves only the ticked suggestions and leaves every other field alone", async () => {
        const { db, draft } = await previewed();
        const result = await applyImport({ supabase: db.client, userId: ALPHA }, {
            draftId: draft.id,
            approvals: [{ field: "phone", expectedExisting: "0113 000 0000" }, { field: "website", expectedExisting: null }],
        });

        expect(result.ok && result.outcomes).toEqual([{ field: "phone", outcome: "applied" }, { field: "website", outcome: "applied" }]);
        expect(db.profile(ALPHA)).toMatchObject({
            phone: "0113 496 0000",
            website: "https://www.smithbuilders.co.uk",
            company_name: "Smith Builders",
            specialisms: "",
            sales_email: null,
            address: null,
            capability_statement: "Our own words.",
        });
        const profileWrites = db.writes.filter((write) => write.table === "profiles").map((write) => Object.keys(write.values));
        expect(profileWrites).toEqual([["phone"], ["website"]]);

        const saved = toDraft(db.tables.company_import_drafts[0] as never);
        expect(item(saved, "phone")).toMatchObject({ status: "applied", existing: "0113 496 0000" });
        expect(item(saved, "phone").appliedAt).toBeTruthy();
        expect(item(saved, "company_name")).toMatchObject({ status: "pending", appliedAt: null });
    });

    it("takes the value from the saved draft, never from the request", async () => {
        const { db, draft } = await previewed();
        const result = await applyImport({ supabase: db.client, userId: ALPHA }, {
            draftId: draft.id,
            approvals: [{ field: "phone", expectedExisting: "0113 000 0000", proposed: "0900 PREMIUM", value: "0900 PREMIUM" }],
        });
        expect(result.ok).toBe(true);
        expect(db.profile(ALPHA).phone).toBe("0113 496 0000");
    });

    it("cannot be used to write a field the import does not own", async () => {
        const { db, draft } = await previewed();
        const before = JSON.stringify(db.tables.profiles);
        for (const field of ["bank_details", "logo_url", "capability_statement", "case_studies", "id", "email", "is_admin"]) {
            const result = await applyImport({ supabase: db.client, userId: ALPHA }, { draftId: draft.id, approvals: [{ field, expectedExisting: null }] });
            expect(result, field).toEqual({ ok: false, error: IMPORT_SAVE_ERROR });
        }
        expect(await applyImport({ supabase: db.client, userId: ALPHA }, { draftId: draft.id, approvals: [] })).toEqual({ ok: false, error: IMPORT_SAVE_ERROR });
        expect(await applyImport({ supabase: db.client, userId: ALPHA }, { draftId: "not-a-uuid", approvals: [{ field: "phone", expectedExisting: null }] })).toEqual({ ok: false, error: IMPORT_SAVE_ERROR });
        expect(JSON.stringify(db.tables.profiles)).toBe(before);
    });

    it("does not overwrite a value that changed after the preview, and lets the contractor decide again", async () => {
        const { db, draft } = await previewed();
        // The contractor edits their phone by hand in another tab after the preview.
        db.profile(ALPHA).phone = "0113 222 2222";

        const stale = await applyImport({ supabase: db.client, userId: ALPHA }, {
            draftId: draft.id,
            approvals: [{ field: "phone", expectedExisting: "0113 000 0000" }, { field: "website", expectedExisting: null }],
        });
        expect(stale.ok && stale.outcomes).toEqual([
            { field: "phone", outcome: "conflict", current: "0113 222 2222" },
            { field: "website", outcome: "applied" },
        ]);
        expect(db.profile(ALPHA).phone).toBe("0113 222 2222");
        expect(stale.ok && item(stale.draft, "phone")).toMatchObject({ existing: "0113 222 2222", status: "pending" });

        // Shown the newer value, they approve the replacement knowingly.
        const again = await applyImport({ supabase: db.client, userId: ALPHA }, { draftId: draft.id, approvals: [{ field: "phone", expectedExisting: "0113 222 2222" }] });
        expect(again.ok && again.outcomes).toEqual([{ field: "phone", outcome: "applied" }]);
        expect(db.profile(ALPHA).phone).toBe("0113 496 0000");
    });

    it("treats an empty saved value and no saved value as different things to be confirmed", async () => {
        const { db, draft } = await previewed();
        // specialisms is "" on the profile, not null.
        const wrong = await applyImport({ supabase: db.client, userId: ALPHA }, { draftId: draft.id, approvals: [{ field: "specialisms", expectedExisting: null }] });
        expect(wrong.ok && wrong.outcomes[0]).toEqual({ field: "specialisms", outcome: "conflict", current: "" });
        expect(db.profile(ALPHA).specialisms).toBe("");
        const right = await applyImport({ supabase: db.client, userId: ALPHA }, { draftId: draft.id, approvals: [{ field: "specialisms", expectedExisting: "" }] });
        expect(right.ok && right.outcomes[0].outcome).toBe("applied");
    });

    it("applies each suggestion once", async () => {
        const { db, draft } = await previewed();
        const approvals = [{ field: "phone", expectedExisting: "0113 000 0000" }];
        const twice = await applyImport({ supabase: db.client, userId: ALPHA }, { draftId: draft.id, approvals: [...approvals, ...approvals] });
        expect(twice.ok && twice.outcomes.map((entry) => entry.outcome)).toEqual(["applied", "unavailable"]);
        const later = await applyImport({ supabase: db.client, userId: ALPHA }, { draftId: draft.id, approvals: [{ field: "phone", expectedExisting: "0113 496 0000" }] });
        expect(later.ok && later.outcomes).toEqual([{ field: "phone", outcome: "unavailable" }]);
        expect(db.writes.filter((write) => write.table === "profiles")).toHaveLength(1);
    });

    it("changes nothing when the save fails, and saves on retry", async () => {
        const { db, draft } = await previewed();
        const before = JSON.stringify(db.tables.profiles);
        db.fail("profiles", "update");
        const input = { draftId: draft.id, approvals: [{ field: "phone", expectedExisting: "0113 000 0000" }] };

        const failed = await applyImport({ supabase: db.client, userId: ALPHA }, input);
        expect(failed).toMatchObject({ ok: false, error: IMPORT_SAVE_ERROR });
        expect(JSON.stringify(db.tables.profiles)).toBe(before);
        expect(item(toDraft(db.tables.company_import_drafts[0] as never), "phone").status).toBe("pending");

        const retried = await applyImport({ supabase: db.client, userId: ALPHA }, input);
        expect(retried.ok && retried.outcomes).toEqual([{ field: "phone", outcome: "applied" }]);
    });
});

describe("tenant isolation", () => {
    it("gives another contractor no way to read or use a draft", async () => {
        const { db, draft } = await previewed();
        const profilesBefore = JSON.stringify(db.tables.profiles);
        const draftBefore = JSON.stringify(db.tables.company_import_drafts);

        expect(await latestImportDraft({ supabase: db.client, userId: BETA })).toBeNull();
        const attempt = await applyImport({ supabase: db.client, userId: BETA }, { draftId: draft.id, approvals: [{ field: "phone", expectedExisting: "0161 000 0000" }] });
        expect(attempt).toEqual({ ok: false, error: IMPORT_DRAFT_GONE_ERROR });
        expect(JSON.stringify(db.tables.profiles)).toBe(profilesBefore);
        expect(JSON.stringify(db.tables.company_import_drafts)).toBe(draftBefore);
    });

    it("compares each contractor's draft with their own profile and writes only to it", async () => {
        const { db } = await previewed();
        const beta = await previewImport({ supabase: db.client, userId: BETA, network: fakeNetwork(SITE).network }, URL_INPUT);
        if (!beta.ok) throw new Error(beta.error);
        expect(item(beta.draft, "phone").existing).toBe("0161 000 0000");
        expect(db.tables.company_import_drafts.map((row) => row.user_id)).toEqual([ALPHA, BETA]);

        await applyImport({ supabase: db.client, userId: BETA }, { draftId: beta.draft.id, approvals: [{ field: "phone", expectedExisting: "0161 000 0000" }] });
        expect(db.profile(BETA).phone).toBe("0113 496 0000");
        expect(db.profile(ALPHA).phone).toBe("0113 000 0000");
        expect((await latestImportDraft({ supabase: db.client, userId: ALPHA }))?.id).not.toBe(beta.draft.id);
    });
});

describe("latestImportDraft", () => {
    it("brings back the last draft compared with the profile as it is now", async () => {
        const { db, draft } = await previewed();
        db.profile(ALPHA).phone = "0113 496 0000";
        db.profile(ALPHA).company_name = "Smith & Sons";
        const resumed = await latestImportDraft({ supabase: db.client, userId: ALPHA });
        expect(resumed?.id).toBe(draft.id);
        expect(item(resumed!, "phone").status).toBe("same");
        expect(item(resumed!, "company_name")).toMatchObject({ existing: "Smith & Sons", status: "pending" });
        expect(db.writes.filter((write) => write.op === "update")).toEqual([]);
    });

    it("drops anything in a saved draft that is not a well-formed item", () => {
        const draft = toDraft({
            id: "x", source_url: "https://a.co.uk/", website: "https://a.co.uk", permission_confirmed_at: "t", fetched_at: "t",
            pages: ["https://a.co.uk/", 7, null],
            items: [{ field: "bank_details", proposed: "x" }, "text", null, { field: "phone", proposed: "0113 496 0000", existing: null, sourceUrl: "https://a.co.uk/", excerpt: "e", basis: "contact-link", status: "pending", appliedAt: null }],
        });
        expect(draft.items.map((entry) => entry.field)).toEqual(["phone"]);
        expect(draft.pages).toEqual(["https://a.co.uk/"]);
        expect(refreshAgainstProfile(draft, null).items[0].existing).toBeNull();
    });
});

describe("immutable proposals", () => {
    it("a previewed but unapproved suggestion cannot appear in a published snapshot", async () => {
        const { db, draft } = await previewed();
        const published = contractorSeenByClients(db.profile(ALPHA));

        expect(published.company_name).toBe("Smith Builders");
        expect(published.phone).toBe("0113 000 0000");
        const text = JSON.stringify(published);
        for (const entry of draft.items.filter((candidate) => candidate.status === "pending")) {
            expect(text, entry.field).not.toContain(entry.proposed);
        }
    });

    it("only the approved change reaches a later snapshot; the rest stay out", async () => {
        const { db, draft } = await previewed();
        await applyImport({ supabase: db.client, userId: ALPHA }, { draftId: draft.id, approvals: [{ field: "phone", expectedExisting: "0113 000 0000" }] });
        const published = contractorSeenByClients(db.profile(ALPHA));

        expect(published.phone).toBe("0113 496 0000");
        expect(published.company_name).toBe("Smith Builders");
        expect(JSON.stringify(published)).not.toContain("Smith Builders Ltd");
        expect(JSON.stringify(published)).not.toContain("House extensions");
    });
});
