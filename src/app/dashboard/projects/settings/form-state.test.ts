import { describe, expect, it } from "vitest";
import { settingsFormSignature } from "./form-state";

function form() {
    const data = new FormData();
    for (const [name, value] of Object.entries({ projectId: "project-b", name: "Example renovation", status: "Lead", project_type: "Domestic Renovation", start_date: "2026-10-19", potential_value: "", payment_terms: "21 days", client_name: "Example client", client_email: "", client_phone: "", client_address: "", site_address: "", scope: "" })) data.append(name, value);
    return data;
}

describe("complete settings edit signature", () => {
    it("tracks each existing submitted field, including blank values", () => {
        const baseline = settingsFormSignature(form());
        for (const key of form().keys()) {
            const edited = form();
            edited.set(key, "Local edit");
            expect(settingsFormSignature(edited), key).not.toBe(baseline);
        }
    });

    it("tracks the existing checkbox's checked versus omitted state", () => {
        const data = form();
        const baseline = settingsFormSignature(data);
        data.set("is_vat_reverse_charge", "on");
        expect(settingsFormSignature(data)).not.toBe(baseline);
        data.delete("is_vat_reverse_charge");
        expect(settingsFormSignature(data)).toBe(baseline);
    });

    it("becomes clean when typing is reverted exactly, without normalising whitespace", () => {
        const data = form();
        const baseline = settingsFormSignature(data);
        data.set("name", "Example renovation ");
        expect(settingsFormSignature(data)).not.toBe(baseline);
        data.set("name", "Example renovation");
        expect(settingsFormSignature(data)).toBe(baseline);
    });

    it("keeps a submitted snapshot distinct from later typing", () => {
        const data = form();
        const submitted = settingsFormSignature(data);
        data.set("scope", "Newer local scope");
        expect(settingsFormSignature(data)).not.toBe(submitted);
    });
});
