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

    it("uses 0% when not VAT registered once the rollout gate is on", () => {
        const prev = process.env[PROFILE_VAT_SETTINGS_ENV];
        process.env[PROFILE_VAT_SETTINGS_ENV] = "1";
        expect(vatFromCompanyAndProject({}, { vat_registered: false, default_vat_rate: 20 })).toEqual({
            vatRate: 0,
            vatTreatment: "standard",
        });
        if (prev === undefined) delete process.env[PROFILE_VAT_SETTINGS_ENV];
        else process.env[PROFILE_VAT_SETTINGS_ENV] = prev;
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