import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAuth: vi.fn(), revalidatePath: vi.fn(), createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireAuth: mocks.requireAuth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { profileUpdateFromForm } from "@/lib/profile-update";
import { updateProfileAction } from "./actions";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STORED_STUDIES = [
    { id: "cs-1", projectName: "Kitchen at Example Road", whatWeDelivered: "We refitted the kitchen.", photos: [] },
    { id: "cs-2", projectName: "Loft at Sample Street", whatWeDelivered: "We converted the loft.", photos: [] },
];

/**
 * A stand-in for the contractor's own database session. `upsert` behaves as
 * the real one does for an existing row: columns that are sent are replaced,
 * columns that are not sent are left alone.
 */
function database(options: { error?: { message: string } } = {}) {
    const row: Record<string, unknown> = { id: USER_ID, company_name: "Old Name Ltd", phone: "0113 000 0000", case_studies: structuredClone(STORED_STUDIES) };
    const calls: Array<{ table: string; method: string; payload: Record<string, unknown>; options: unknown }> = [];
    const supabase = {
        from: (table: string) => ({
            upsert: async (payload: Record<string, unknown>, upsertOptions: unknown) => {
                calls.push({ table, method: "upsert", payload, options: upsertOptions });
                if (options.error) return { error: options.error };
                Object.assign(row, payload);
                return { error: null };
            },
        }),
    };
    return { row, calls, supabase };
}

function form(fields: Record<string, string> = {}): FormData {
    const data = new FormData();
    const base: Record<string, string> = { company_name: "Example Builders Ltd", full_name: "Sam Example", phone: "0113 496 0000", business_type: "Kitchens", pdf_theme: "navy", preferred_trades: '["Tiling"]', years_trading: "7" };
    for (const [name, value] of Object.entries({ ...base, ...fields })) data.set(name, value);
    return data;
}

let db: ReturnType<typeof database>;

beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    db = database();
    mocks.requireAuth.mockResolvedValue({ user: { id: USER_ID }, supabase: db.supabase });
});

describe("updateProfileAction never writes case studies", () => {
    const POSTED: Array<[string, Record<string, string>]> = [
        ["no case_studies field at all (the old code wrote an empty list)", {}],
        ["an empty string", { case_studies: "" }],
        ["an explicit empty list", { case_studies: "[]" }],
        ["a stale copy that is missing a study added elsewhere", { case_studies: JSON.stringify(STORED_STUDIES.slice(0, 1)) }],
        ["a different list entirely", { case_studies: JSON.stringify([{ id: "x", projectName: "Injected" }]) }],
        ["malformed JSON", { case_studies: "{not json" }],
        ["null", { case_studies: "null" }],
        ["something that is not a list", { case_studies: '{"id":"cs-1"}' }],
    ];

    it.each(POSTED)("posted with %s: nothing about case studies is sent, and what is stored is unchanged", async (_label, fields) => {
        const result = await updateProfileAction(form(fields));

        expect(result).toEqual({ success: true });
        expect(db.calls).toHaveLength(1);
        expect(db.calls[0]).toMatchObject({ table: "profiles", method: "upsert", options: { onConflict: "id" } });
        expect(Object.keys(db.calls[0].payload)).not.toContain("case_studies");
        expect(JSON.stringify(db.calls[0].payload)).not.toContain("Injected");
        expect(db.row.case_studies).toEqual(STORED_STUDIES);
        // The rest of the profile still saves.
        expect(db.row).toMatchObject({ company_name: "Example Builders Ltd", phone: "0113 496 0000", pdf_theme: "navy", preferred_trades: ["Tiling"], years_trading: 7 });
    });

    it("a profile saved from an out-of-date page no longer deletes a case study added since", async () => {
        // The page was loaded when there were two. A third was added on the case-studies page.
        const added = { id: "cs-3", projectName: "Bathroom at Test Lane", whatWeDelivered: "We refitted the bathroom.", photos: [] };
        (db.row.case_studies as unknown[]).push(added);

        await updateProfileAction(form({ case_studies: JSON.stringify(STORED_STUDIES) }));

        expect(db.row.case_studies).toEqual([...STORED_STUDIES, added]);
    });

    it("no field name the form could post reaches case studies", () => {
        const data = form({ case_studies: "[]", caseStudies: "[]", "case_studies[]": "x", selected_case_study_ids: "[]" });
        const payload = profileUpdateFromForm(USER_ID, data);
        expect(Object.keys(payload).filter((key) => /case/i.test(key))).toEqual([]);
    });
});

describe("updateProfileAction keeps its other behaviour", () => {
    it("saves exactly the fields it saved before, for the signed-in contractor only", async () => {
        await updateProfileAction(form({ md_name: "", md_message: "", data_consent: "true", logo_url: "https://images.example.test/logo.png" }));
        const payload = db.calls[0].payload;
        expect(Object.keys(payload).sort()).toEqual([
            "accounts_email", "accreditations", "address", "business_type", "capability_statement", "company_name", "company_number",
            "data_consent", "data_consent_at", "financial_year_start_month", "full_name", "id", "insurance_details", "logo_url", "md_message",
            "md_name", "pdf_theme", "phone", "preferred_trades", "sales_email", "sales_phone", "specialisms", "vat_number", "website", "years_trading",
        ]);
        expect(payload).toMatchObject({ id: USER_ID, md_name: null, md_message: null, data_consent: true, financial_year_start_month: 4, logo_url: "https://images.example.test/logo.png" });
        expect(typeof payload.data_consent_at).toBe("string");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/settings/profile");
    });

    it("a posted id cannot redirect the save to another contractor", async () => {
        await updateProfileAction(form({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }));
        expect(db.calls[0].payload.id).toBe(USER_ID);
    });

    it("keeps its defaults: theme, trades, years and consent", () => {
        const payload = profileUpdateFromForm(USER_ID, new FormData());
        expect(payload).toMatchObject({ pdf_theme: "slate", preferred_trades: [], years_trading: null, financial_year_start_month: 4, data_consent: false, data_consent_at: null });
        expect(profileUpdateFromForm(USER_ID, form({ preferred_trades: "{broken" })).preferred_trades).toEqual([]);
    });

    it("a failed save says so, changes nothing and does not claim success", async () => {
        db = database({ error: { message: "permission denied for table profiles" } });
        mocks.requireAuth.mockResolvedValue({ user: { id: USER_ID }, supabase: db.supabase });

        const result = await updateProfileAction(form({ case_studies: "[]" }));

        expect(result).toEqual({ success: false, error: "permission denied for table profiles" });
        expect(db.row).toMatchObject({ company_name: "Old Name Ltd", case_studies: STORED_STUDIES });
        expect(Object.keys(db.calls[0].payload)).not.toContain("case_studies");
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("a signed-out caller writes nothing", async () => {
        mocks.requireAuth.mockRejectedValue(new Error("Unauthorized: No user found."));
        await expect(updateProfileAction(form({ case_studies: "[]" }))).rejects.toThrow("Unauthorized");
        expect(db.calls).toEqual([]);
        expect(db.row.case_studies).toEqual(STORED_STUDIES);
        expect(mocks.createAdminClient).not.toHaveBeenCalled();
    });

    it("uses only the contractor's own session: no privileged client", async () => {
        await updateProfileAction(form());
        expect(mocks.createAdminClient).not.toHaveBeenCalled();
    });
});
