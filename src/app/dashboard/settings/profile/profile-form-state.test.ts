import { describe, expect, it, vi } from "vitest";
import { attemptProfileSave, profileFormSignature, PROFILE_SAVE_UNCONFIRMED } from "./profile-form-state";

const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    return data;
};

describe("profile form confirmation snapshots", () => {
    it("compares the complete payload independent of field order without trimming values", () => {
        expect(profileFormSignature(form({ phone: "1", company_name: "Example" })))
            .toBe(profileFormSignature(form({ company_name: "Example", phone: "1" })));
        expect(profileFormSignature(form({ company_name: "Example " })))
            .not.toBe(profileFormSignature(form({ company_name: "Example" })));
    });

    it("includes state-only choices, text, empty fields and checkbox presence", () => {
        const original = { company_name: "Example", pdf_theme: "slate", preferred_trades: "[]", logo_url: "", md_message: "" };
        const baseline = profileFormSignature(form(original));
        for (const [name, value] of Object.entries({ pdf_theme: "forest", preferred_trades: '["Roofing"]', logo_url: "new-logo", md_message: "Own words", data_consent: "true" })) {
            expect(profileFormSignature(form({ ...original, [name]: value })), name).not.toBe(baseline);
        }
        expect(profileFormSignature(form(original))).toBe(baseline);
    });

    it("does not treat a successful submitted snapshot as confirmation of newer edits", async () => {
        const submitted = form({ company_name: "Submitted" });
        const sent = profileFormSignature(submitted);
        const result = await attemptProfileSave(async () => ({ success: true }), submitted);
        expect(result.success).toBe(true);
        expect(profileFormSignature(form({ company_name: "Newer edit" }))).not.toBe(sent);
    });

    it("passes the original payload through exactly once and preserves returned failures", async () => {
        const data = form({ company_name: "Example" });
        const save = vi.fn(async () => ({ success: false, error: "Save refused" }));
        expect(await attemptProfileSave(save, data)).toEqual({ success: false, error: "Save refused" });
        expect(save).toHaveBeenCalledExactlyOnceWith(data);
    });

    it("turns a thrown or missing reply into an unconfirmed result, not a no-write claim", async () => {
        const data = form({});
        expect(await attemptProfileSave(async () => { throw Error("connection lost"); }, data))
            .toEqual({ success: false, error: PROFILE_SAVE_UNCONFIRMED });
        expect(await attemptProfileSave(vi.fn().mockResolvedValue(undefined), data))
            .toEqual({ success: false, error: PROFILE_SAVE_UNCONFIRMED });
        expect(PROFILE_SAVE_UNCONFIRMED).not.toMatch(/nothing (was changed|was saved)/i);
    });
});
