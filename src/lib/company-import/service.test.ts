import { beforeEach, describe, expect, it, vi } from "vitest";
import { representativeInput } from "@/lib/__fixtures__/proposal";
import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { fakeDb } from "./__fixtures__/fake-db";
import { SITE, fakeNetwork, html } from "./__fixtures__/site";
import {
    IMPORT_DRAFT_GONE_ERROR,
    IMPORT_EXPIRED_ERROR,
    IMPORT_GENERIC_ERROR,
    IMPORT_IN_FLIGHT_ERROR,
    IMPORT_PERMISSION_ERROR,
    IMPORT_RATE_ERROR,
    IMPORT_READS_PER_HOUR,
    IMPORT_REFRESH_ERROR,
    IMPORT_SAVE_ERROR,
    type ImportDraft,
} from "./draft";
import { applyImport, latestImportDraft, previewImport, refreshAgainstProfile, toDraft } from "./service";

const ALPHA = "aaaaaaaa-0000-4000-8000-000000000001";
const BETA = "bbbbbbbb-0000-4000-8000-000000000002";
const URL_INPUT = { url: "www.smithbuilders.co.uk", permissionConfirmed: true };
const HOUR = 60 * 60 * 1000;
const DOWN = { ...SITE, "https://www.smithbuilders.co.uk/": html("down", 503) };

type Db = ReturnType<typeof fakeDb>;
const seed = () => fakeDb({
    profiles: [
        { id: ALPHA, company_name: "Smith Builders", phone: "0113 000 0000", website: null, specialisms: "", sales_email: null, address: null, company_number: null, vat_number: null, capability_statement: "Our own words." },
        { id: BETA, company_name: "Beta Joinery", phone: "0161 000 0000", website: null, specialisms: null, sales_email: null, address: null, company_number: null, vat_number: null },
    ],
});
const as = (db: Db, userId: string, network = fakeNetwork(SITE).network) => ({ supabase: db.user, admin: db.admin, userId, network });

async function previewed(db = seed(), net = fakeNetwork(SITE)) {
    const result = await previewImport(as(db, ALPHA, net.network), URL_INPUT);
    if (!result.ok) throw new Error(`preview failed: ${result.error}`);
    return { db, net, draft: result.draft };
}

const item = (draft: ImportDraft, field: string) => draft.items.find((entry) => entry.field === field)!;
const savedItem = (db: Db, field: string) => (db.tables.company_import_drafts[0].items as Array<Record<string, unknown>>).find((entry) => entry.field === field)!;
const attempts = (db: Db, userId = ALPHA) => db.tables.company_import_attempts.filter((row) => row.user_id === userId).map((row) => row.outcome);
const calls = (db: Db) => db.rpcCalls.map((call) => call.name.replace("company_import_", ""));
const contractorSeenByClients = (profile: Record<string, unknown>) =>
    buildProposalPublicationSnapshot({ ...representativeInput(), profile: { ...representativeInput().profile, ...profile } }).contractor;

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("previewImport", () => {
    it("does nothing without explicit permission: no budget claim, no lookup, no request, no draft", async () => {
        for (const permissionConfirmed of [false, undefined, "true", 1, null]) {
            const db = seed();
            const net = fakeNetwork(SITE);
            const result = await previewImport(as(db, ALPHA, net.network), { url: "www.smithbuilders.co.uk", permissionConfirmed });
            expect(result).toEqual({ ok: false, error: IMPORT_PERMISSION_ERROR });
            expect(net.resolved).toEqual([]);
            expect(net.requests).toEqual([]);
            expect(db.rpcCalls).toEqual([]);
        }
    });

    it("shows suggestions beside what is saved, with source, excerpt and times, and changes nothing on the profile", async () => {
        const before = JSON.stringify(seed().tables.profiles);
        const { db, draft } = await previewed();

        expect(JSON.stringify(db.tables.profiles)).toBe(before);
        expect(db.profileWrites).toEqual([]);
        expect(calls(db)).toEqual(["reserve_attempt", "save_draft"]);
        expect(db.rpcCalls.every((call) => call.args.p_user_id === ALPHA)).toBe(true);
        expect(attempts(db)).toEqual(["drafted"]);

        expect(draft.website).toBe("https://www.smithbuilders.co.uk");
        expect(draft.sourceUrl).toBe("https://www.smithbuilders.co.uk/");
        expect(draft.fetchedAt).toBe("2026-10-07T10:00:00.000Z");
        expect(draft.permissionConfirmedAt).toBe("2026-10-07T10:00:00.000Z");
        expect(Date.parse(draft.expiresAt) - Date.parse(String(db.tables.company_import_drafts[0].created_at))).toBe(24 * HOUR);
        expect(draft.expired).toBe(false);
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

    it("never writes through the contractor's own client", async () => {
        const { db, draft } = await previewed();
        await applyImport(as(db, ALPHA), { draftId: draft.id, approvals: [{ field: "phone", expectedExisting: "0113 000 0000" }] });
        await latestImportDraft(as(db, ALPHA));
        expect(db.deniedWrites).toEqual([]);
        // And that client could not have: the boundary refuses it.
        expect((await db.user.from("company_import_drafts").insert({ user_id: ALPHA })).error.code).toBe("42501");
        expect((await db.user.from("company_import_drafts").update({ items: [] }).eq("id", draft.id)).error.code).toBe("42501");
        expect((await db.user.from("company_import_drafts").delete().eq("id", draft.id)).error.code).toBe("42501");
    });

    it("marks a suggestion that already matches as nothing to change", async () => {
        const db = seed();
        db.profile(ALPHA).phone = " 0113  496 0000 ";
        const { draft } = await previewed(db);
        expect(item(draft, "phone").status).toBe("same");
    });

    it("explains a hostile or unusable address without claiming budget or looking anything up", async () => {
        for (const url of ["http://169.254.169.254/latest/meta-data/", "http://localhost:3000", "https://admin:pw@www.smithbuilders.co.uk", "file:///etc/passwd", "http://[::1]/", "not a url"]) {
            const db = seed();
            const net = fakeNetwork(SITE);
            const result = await previewImport(as(db, ALPHA, net.network), { url, permissionConfirmed: true });
            expect(result.ok, url).toBe(false);
            expect(net.resolved, url).toEqual([]);
            expect(db.rpcCalls, url).toEqual([]);
            // The message never repeats internal detail back.
            if (!result.ok) expect(result.error, url).not.toMatch(/169\.254|localhost|127\.0|::1|passwd/);
        }
    });

    it("reports an unavailable website, saves no draft, counts the attempt, keeps manual entry open, and works on retry", async () => {
        const db = seed();
        const failed = await previewImport(as(db, ALPHA, fakeNetwork(DOWN).network), URL_INPUT);
        expect(failed.ok).toBe(false);
        if (!failed.ok) expect(failed.error).toContain("by hand");
        expect(db.tables.company_import_drafts).toEqual([]);
        expect(attempts(db)).toEqual(["failed:unavailable"]);

        expect((await previewImport(as(db, ALPHA), URL_INPUT)).ok).toBe(true);
        expect(attempts(db)).toEqual(["failed:unavailable", "drafted"]);
    });

    it("fails cleanly when the draft cannot be saved, frees the in-flight slot, and works on retry", async () => {
        const db = seed();
        db.fail("company_import_save_draft");
        expect(await previewImport(as(db, ALPHA), URL_INPUT)).toEqual({ ok: false, error: IMPORT_GENERIC_ERROR });
        expect(db.tables.company_import_drafts).toEqual([]);
        expect(attempts(db)).toEqual(["failed:draft-save"]);
        expect((await previewImport(as(db, ALPHA), URL_INPUT)).ok).toBe(true);
    });

    it("does not fetch when the budget cannot be claimed", async () => {
        const db = seed();
        db.fail("company_import_reserve_attempt");
        const net = fakeNetwork(SITE);
        expect(await previewImport(as(db, ALPHA, net.network), URL_INPUT)).toEqual({ ok: false, error: IMPORT_GENERIC_ERROR });
        expect(net.resolved).toEqual([]);
        expect(net.requests).toEqual([]);
    });

    it("counts failed reads against the hourly budget, so failing on purpose buys nothing", async () => {
        const db = seed();
        for (let index = 0; index < IMPORT_READS_PER_HOUR; index += 1) {
            expect((await previewImport(as(db, ALPHA, fakeNetwork(DOWN).network), URL_INPUT)).ok).toBe(false);
        }
        expect(attempts(db)).toEqual(Array(IMPORT_READS_PER_HOUR).fill("failed:unavailable"));

        const net = fakeNetwork(SITE);
        expect(await previewImport(as(db, ALPHA, net.network), URL_INPUT)).toEqual({ ok: false, error: IMPORT_RATE_ERROR });
        expect(net.resolved).toEqual([]);
        expect(attempts(db)).toHaveLength(IMPORT_READS_PER_HOUR);

        // Another contractor is unaffected, and the budget returns after an hour.
        expect((await previewImport(as(db, BETA), URL_INPUT)).ok).toBe(true);
        db.advance(HOUR + 1000);
        expect((await previewImport(as(db, ALPHA), URL_INPUT)).ok).toBe(true);
    });

    it("lets only one of several simultaneous calls read the website", async () => {
        const db = seed();
        const net = fakeNetwork(SITE);
        const results = await Promise.all(Array.from({ length: 5 }, () => previewImport(as(db, ALPHA, net.network), URL_INPUT)));

        expect(results.filter((result) => result.ok)).toHaveLength(1);
        expect(results.filter((result) => !result.ok).map((result) => (result.ok ? "" : result.error))).toEqual(Array(4).fill(IMPORT_IN_FLIGHT_ERROR));
        // One crawl's worth of requests, not five.
        expect(net.requests.map((request) => request.url.pathname)).toEqual(["/robots.txt", "/", "/contact-us", "/about", "/services"]);
        expect(db.tables.company_import_drafts).toHaveLength(1);
        expect(attempts(db)).toEqual(["drafted"]);

        // The slot is free again once the read has finished.
        expect((await previewImport(as(db, ALPHA), URL_INPUT)).ok).toBe(true);
    });

    it("frees the in-flight slot when the read throws something unexpected", async () => {
        const db = seed();
        const net = fakeNetwork(SITE);
        net.network.request = async () => { throw new Error("socket exploded"); };
        expect((await previewImport(as(db, ALPHA, net.network), URL_INPUT)).ok).toBe(false);
        expect(attempts(db)).toEqual(["failed:unavailable"]);
        expect((await previewImport(as(db, ALPHA), URL_INPUT)).ok).toBe(true);
    });
});

describe("applyImport", () => {
    it("saves only the ticked suggestions and leaves every other field alone", async () => {
        const { db, draft } = await previewed();
        const result = await applyImport(as(db, ALPHA), {
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
        expect(db.profileWrites.map((write) => `${write.userId}:${write.field}`)).toEqual([`${ALPHA}:phone`, `${ALPHA}:website`]);

        // The result shows what the database holds.
        expect(result.ok && item(result.draft, "phone")).toMatchObject({ status: "applied", existing: "0113 496 0000" });
        expect(result.ok && item(result.draft, "phone").appliedAt).toBeTruthy();
        expect(result.ok && item(result.draft, "company_name")).toMatchObject({ status: "pending", appliedAt: null });
    });

    it("takes the value from the saved draft, never from the request", async () => {
        const { db, draft } = await previewed();
        const result = await applyImport(as(db, ALPHA), {
            draftId: draft.id,
            approvals: [{ field: "phone", expectedExisting: "0113 000 0000", proposed: "0900 PREMIUM", value: "0900 PREMIUM" }],
        });
        expect(result.ok).toBe(true);
        expect(db.profile(ALPHA).phone).toBe("0113 496 0000");
        expect(db.rpcCalls.at(-1)?.args).toEqual({ p_user_id: ALPHA, p_draft_id: draft.id, p_field: "phone", p_expected_existing: "0113 000 0000" });
    });

    it("cannot be used to write a field the import does not own", async () => {
        const { db, draft } = await previewed();
        const before = JSON.stringify(db.tables.profiles);
        const callsBefore = db.rpcCalls.length;
        for (const field of ["bank_details", "logo_url", "capability_statement", "case_studies", "id", "email", "is_admin"]) {
            expect(await applyImport(as(db, ALPHA), { draftId: draft.id, approvals: [{ field, expectedExisting: null }] }), field).toEqual({ ok: false, error: IMPORT_SAVE_ERROR });
        }
        expect(await applyImport(as(db, ALPHA), { draftId: draft.id, approvals: [] })).toEqual({ ok: false, error: IMPORT_SAVE_ERROR });
        expect(await applyImport(as(db, ALPHA), { draftId: "not-a-uuid", approvals: [{ field: "phone", expectedExisting: null }] })).toEqual({ ok: false, error: IMPORT_SAVE_ERROR });
        expect(JSON.stringify(db.tables.profiles)).toBe(before);
        expect(db.rpcCalls.length).toBe(callsBefore);
    });

    it("does not overwrite a value that changed after the preview, and lets the contractor decide again", async () => {
        const { db, draft } = await previewed();
        // The contractor edits their phone by hand in another tab after the preview.
        db.profile(ALPHA).phone = "0113 222 2222";

        const stale = await applyImport(as(db, ALPHA), {
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
        const again = await applyImport(as(db, ALPHA), { draftId: draft.id, approvals: [{ field: "phone", expectedExisting: "0113 222 2222" }] });
        expect(again.ok && again.outcomes).toEqual([{ field: "phone", outcome: "applied" }]);
        expect(db.profile(ALPHA).phone).toBe("0113 496 0000");
    });

    it("treats an empty saved value and no saved value as different things to be confirmed", async () => {
        const { db, draft } = await previewed();
        // specialisms is "" on the profile, not null.
        const wrong = await applyImport(as(db, ALPHA), { draftId: draft.id, approvals: [{ field: "specialisms", expectedExisting: null }] });
        expect(wrong.ok && wrong.outcomes[0]).toEqual({ field: "specialisms", outcome: "conflict", current: "" });
        expect(db.profile(ALPHA).specialisms).toBe("");
        const right = await applyImport(as(db, ALPHA), { draftId: draft.id, approvals: [{ field: "specialisms", expectedExisting: "" }] });
        expect(right.ok && right.outcomes[0].outcome).toBe("applied");
    });

    it("applies each suggestion once, including when two tabs approve it at the same moment", async () => {
        const { db, draft } = await previewed();
        const input = { draftId: draft.id, approvals: [{ field: "phone", expectedExisting: "0113 000 0000" }] };
        const tabs = await Promise.all([applyImport(as(db, ALPHA), input), applyImport(as(db, ALPHA), input), applyImport(as(db, ALPHA), input)]);
        expect(tabs.flatMap((tab) => tab.outcomes ?? []).map((entry) => entry.outcome).sort()).toEqual(["applied", "unavailable", "unavailable"]);
        expect(db.profileWrites).toHaveLength(1);

        const later = await applyImport(as(db, ALPHA), { draftId: draft.id, approvals: [{ field: "phone", expectedExisting: "0113 496 0000" }] });
        expect(later.ok && later.outcomes).toEqual([{ field: "phone", outcome: "unavailable" }]);
        expect(db.profileWrites).toHaveLength(1);
    });

    it("changes nothing when the save fails, says so, and saves on retry", async () => {
        const { db, draft } = await previewed();
        const before = JSON.stringify(db.tables.profiles);
        db.fail("company_import_approve_item");
        const input = { draftId: draft.id, approvals: [{ field: "phone", expectedExisting: "0113 000 0000" }] };

        const failed = await applyImport(as(db, ALPHA), input);
        expect(failed).toMatchObject({ ok: false, error: IMPORT_SAVE_ERROR, outcomes: [] });
        expect(JSON.stringify(db.tables.profiles)).toBe(before);
        expect(savedItem(db, "phone").status).toBe("pending");

        const retried = await applyImport(as(db, ALPHA), input);
        expect(retried.ok && retried.outcomes).toEqual([{ field: "phone", outcome: "applied" }]);
    });

    it("does not change the profile when the approval cannot be recorded with it", async () => {
        const { db, draft } = await previewed();
        const before = JSON.stringify(db.tables.profiles);
        db.fail("record-approval");
        const input = { draftId: draft.id, approvals: [{ field: "phone", expectedExisting: "0113 000 0000" }] };

        const failed = await applyImport(as(db, ALPHA), input);
        expect(failed).toMatchObject({ ok: false, error: IMPORT_SAVE_ERROR, outcomes: [] });
        expect(JSON.stringify(db.tables.profiles)).toBe(before);
        expect(db.profileWrites).toEqual([]);
        expect(savedItem(db, "phone")).toMatchObject({ status: "pending", appliedAt: null });

        expect((await applyImport(as(db, ALPHA), input)).ok).toBe(true);
        expect(savedItem(db, "phone").status).toBe("applied");
    });

    it("reports a failure part-way honestly: what was saved is shown as saved, the rest is not", async () => {
        const { db, draft } = await previewed();
        const input = { draftId: draft.id, approvals: [{ field: "phone", expectedExisting: "0113 000 0000" }, { field: "website", expectedExisting: null }, { field: "address", expectedExisting: null }] };
        // The second approval fails.
        const original = db.admin.rpc;
        let approvals = 0;
        db.admin.rpc = async (name: string, args: Record<string, unknown>) => {
            if (name === "company_import_approve_item" && (approvals += 1) === 2) return { data: null, error: { code: "08006", message: "connection lost" } };
            return original(name, args);
        };

        const result = await applyImport(as(db, ALPHA), input);
        expect(result.ok).toBe(false);
        expect(result).toMatchObject({ error: IMPORT_SAVE_ERROR, outcomes: [{ field: "phone", outcome: "applied" }] });
        expect(approvals, "nothing is attempted after the failure").toBe(2);
        expect(db.profile(ALPHA)).toMatchObject({ phone: "0113 496 0000", website: null, address: null });
        expect(result.draft && item(result.draft, "phone").status).toBe("applied");
        expect(result.draft && item(result.draft, "website").status).toBe("pending");
    });

    it("says so when the changes were saved but the page could not be refreshed", async () => {
        const { db, draft } = await previewed();
        db.fail("select:company_import_drafts");
        const result = await applyImport(as(db, ALPHA), { draftId: draft.id, approvals: [{ field: "phone", expectedExisting: "0113 000 0000" }] });
        expect(result).toEqual({ ok: false, error: IMPORT_REFRESH_ERROR, outcomes: [{ field: "phone", outcome: "applied" }] });
        expect(db.profile(ALPHA).phone).toBe("0113 496 0000");
    });

    it("refuses to approve anything from a draft more than a day old", async () => {
        const net = fakeNetwork(SITE);
        const { db, draft } = await previewed(seed(), net);
        const before = JSON.stringify(db.tables.profiles);
        db.advance(24 * HOUR + 1000);
        net.advance(24 * HOUR + 2000);

        const result = await applyImport(as(db, ALPHA, net.network), {
            draftId: draft.id,
            approvals: [{ field: "phone", expectedExisting: "0113 000 0000" }, { field: "website", expectedExisting: null }],
        });
        expect(result).toMatchObject({ ok: false, error: IMPORT_EXPIRED_ERROR, outcomes: [] });
        expect(result.draft?.expired).toBe(true);
        expect(JSON.stringify(db.tables.profiles)).toBe(before);
        expect(db.rpcCalls.filter((call) => call.name === "company_import_approve_item"), "it stops at the first refusal").toHaveLength(1);

        // A fresh check gives a fresh draft that can be approved.
        const fresh = await previewImport(as(db, ALPHA, net.network), URL_INPUT);
        expect(fresh.ok && fresh.draft.expired).toBe(false);
    });
});

describe("tenant isolation", () => {
    it("gives another contractor no way to read or use a draft", async () => {
        const { db, draft } = await previewed();
        const profilesBefore = JSON.stringify(db.tables.profiles);
        const draftBefore = JSON.stringify(db.tables.company_import_drafts);

        expect(await latestImportDraft(as(db, BETA))).toBeNull();
        const attempt = await applyImport(as(db, BETA), { draftId: draft.id, approvals: [{ field: "phone", expectedExisting: "0161 000 0000" }] });
        expect(attempt).toEqual({ ok: false, error: IMPORT_DRAFT_GONE_ERROR, outcomes: [] });
        expect(JSON.stringify(db.tables.profiles)).toBe(profilesBefore);
        expect(JSON.stringify(db.tables.company_import_drafts)).toBe(draftBefore);
    });

    it("compares each contractor's draft with their own profile and writes only to it", async () => {
        const { db } = await previewed();
        const beta = await previewImport(as(db, BETA), URL_INPUT);
        if (!beta.ok) throw new Error(beta.error);
        expect(item(beta.draft, "phone").existing).toBe("0161 000 0000");
        expect(db.tables.company_import_drafts.map((row) => row.user_id)).toEqual([ALPHA, BETA]);

        await applyImport(as(db, BETA), { draftId: beta.draft.id, approvals: [{ field: "phone", expectedExisting: "0161 000 0000" }] });
        expect(db.profile(BETA).phone).toBe("0113 496 0000");
        expect(db.profile(ALPHA).phone).toBe("0113 000 0000");
        expect((await latestImportDraft(as(db, ALPHA)))?.id).not.toBe(beta.draft.id);
    });

    it("passes the authenticated contractor, and no one else, to every privileged call", async () => {
        const { db, draft } = await previewed();
        await applyImport(as(db, ALPHA), { draftId: draft.id, approvals: [{ field: "phone", expectedExisting: "0113 000 0000", userId: BETA, p_user_id: BETA }] });
        await previewImport(as(db, ALPHA, fakeNetwork(DOWN).network), { ...URL_INPUT, userId: BETA, p_user_id: BETA });
        expect(db.rpcCalls.length).toBeGreaterThan(4);
        expect(new Set(db.rpcCalls.map((call) => call.args.p_user_id))).toEqual(new Set([ALPHA]));
        expect(db.profile(BETA).phone).toBe("0161 000 0000");
    });
});

describe("latestImportDraft", () => {
    it("brings back the last draft compared with the profile as it is now, writing nothing", async () => {
        const { db, draft } = await previewed();
        const callsBefore = db.rpcCalls.length;
        db.profile(ALPHA).phone = "0113 496 0000";
        db.profile(ALPHA).company_name = "Smith & Sons";
        const resumed = await latestImportDraft(as(db, ALPHA));
        expect(resumed?.id).toBe(draft.id);
        expect(resumed?.expired).toBe(false);
        expect(item(resumed!, "phone").status).toBe("same");
        expect(item(resumed!, "company_name")).toMatchObject({ existing: "Smith & Sons", status: "pending" });
        expect(db.rpcCalls.length).toBe(callsBefore);
        expect(db.deniedWrites).toEqual([]);
    });

    it("marks a draft more than a day old as expired", async () => {
        const net = fakeNetwork(SITE);
        const { db } = await previewed(seed(), net);
        net.advance(23 * HOUR);
        expect((await latestImportDraft(as(db, ALPHA, net.network)))?.expired).toBe(false);
        net.advance(2 * HOUR);
        expect((await latestImportDraft(as(db, ALPHA, net.network)))?.expired).toBe(true);
    });

    it("drops anything in a saved draft that is not a well-formed item, and treats an unreadable expiry as expired", () => {
        const row = {
            id: "x", source_url: "https://a.co.uk/", website: "https://a.co.uk", permission_confirmed_at: "t", fetched_at: "t", expires_at: "2026-10-08T10:00:00.000Z",
            pages: ["https://a.co.uk/", 7, null],
            items: [{ field: "bank_details", proposed: "x" }, "text", null, { field: "phone", proposed: "0113 496 0000", existing: null, sourceUrl: "https://a.co.uk/", excerpt: "e", basis: "contact-link", status: "pending", appliedAt: null }],
        };
        const draft = toDraft(row, Date.parse("2026-10-07T10:00:00.000Z"));
        expect(draft.items.map((entry) => entry.field)).toEqual(["phone"]);
        expect(draft.pages).toEqual(["https://a.co.uk/"]);
        expect(draft.expired).toBe(false);
        expect(refreshAgainstProfile(draft, null).items[0].existing).toBeNull();
        expect(toDraft({ ...row, expires_at: "not a date" }, 0).expired).toBe(true);
        expect(toDraft(row, Date.parse("2026-10-08T10:00:00.000Z")).expired).toBe(true);
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
        await applyImport(as(db, ALPHA), { draftId: draft.id, approvals: [{ field: "phone", expectedExisting: "0113 000 0000" }] });
        const published = contractorSeenByClients(db.profile(ALPHA));

        expect(published.phone).toBe("0113 496 0000");
        expect(published.company_name).toBe("Smith Builders");
        expect(JSON.stringify(published)).not.toContain("Smith Builders Ltd");
        expect(JSON.stringify(published)).not.toContain("House extensions");
    });
});
