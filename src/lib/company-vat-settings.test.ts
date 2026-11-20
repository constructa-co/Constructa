import { describe, expect, it, vi } from "vitest";
import { profileUpdateFromForm } from "./profile-update";
import {
    normalizeVatNumber,
    vatFromCompanyAndProject,
    PROFILE_VAT_SETTINGS_ENV,
    isProfileVatSettingsEnabled,
} from "./company-vat-settings";

describe("CON-018 company VAT settings", () => {
    it("normalises blank VAT numbers to null and uppercases registrations", () => {
        expect(normalizeVatNumber("  ")).toBeNull();
        expect(normalizeVatNumber("gb123456789")).toBe("GB123456789");
    });

    it("uses reverse charge on the project before company defaults", () => {
        expect(vatFromCompanyAndProject({ is_vat_reverse_charge: true }, { vat_registered: true, default_vat_rate: 20 })).toEqual({
            vatRate: 0,
            vatTreatment: "domestic_reverse_charge",
        });
    });

    it("uses 0% only when VAT registered is explicitly false and the gate is on", () => {
        vi.stubEnv(PROFILE_VAT_SETTINGS_ENV, "1");
        expect(vatFromCompanyAndProject({}, { vat_registered: false, default_vat_rate: 20 })).toEqual({
            vatRate: 0,
            vatTreatment: "standard",
        });
    });

    it("keeps legacy 20% when the gate is on but vat_registered is still null", () => {
        vi.stubEnv(PROFILE_VAT_SETTINGS_ENV, "1");
        expect(vatFromCompanyAndProject({}, { vat_registered: null, default_vat_rate: 5 })).toEqual({
            vatRate: 20,
            vatTreatment: "standard",
        });
        expect(vatFromCompanyAndProject({}, {})).toEqual({ vatRate: 20, vatTreatment: "standard" });
    });

    it("uses the saved rate only when vat_registered is true", () => {
        vi.stubEnv(PROFILE_VAT_SETTINGS_ENV, "1");
        expect(vatFromCompanyAndProject({}, { vat_registered: true, default_vat_rate: 5 })).toEqual({
            vatRate: 5,
            vatTreatment: "standard",
        });
    });

    it("keeps legacy 20% when the profile VAT gate is off", () => {
        const prev = process.env[PROFILE_VAT_SETTINGS_ENV];
        delete process.env[PROFILE_VAT_SETTINGS_ENV];
        expect(isProfileVatSettingsEnabled()).toBe(false);
        expect(vatFromCompanyAndProject({}, { vat_registered: false, default_vat_rate: 0 })).toEqual({
            vatRate: 20,
            vatTreatment: "standard",
        });
        if (prev !== undefined) process.env[PROFILE_VAT_SETTINGS_ENV] = prev;
    });

    it("omits gated VAT columns from profile saves until the rollout env is on", () => {
        vi.stubEnv(PROFILE_VAT_SETTINGS_ENV, "");
        const payload = profileUpdateFromForm("user-1", new FormData());
        expect(payload).not.toHaveProperty("vat_registered");
        expect(payload).not.toHaveProperty("default_vat_rate");
    });

    it("persists VAT settings only when the rollout gate is on", () => {
        vi.stubEnv(PROFILE_VAT_SETTINGS_ENV, "1");
        const data = new FormData();
        data.set("vat_registered", "true");
        data.set("default_vat_rate", "5");
        data.set("default_vat_reverse_charge", "on");
        expect(profileUpdateFromForm("user-1", data)).toMatchObject({
            vat_registered: true,
            default_vat_rate: 5,
            default_vat_reverse_charge: true,
        });
    });
});