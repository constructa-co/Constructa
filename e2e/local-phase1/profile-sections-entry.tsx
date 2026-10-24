/**
 * Local offline fixture: the actual company ProfileForm with its one-section-
 * at-a-time chooser, over an explicit MOCK save.
 *
 * REAL ProfileForm (all sections mounted, native validation, whole-form
 * FormData, save/newer-edit/refusal handling) with its bundled CSS module.
 * The injected `save` (the form's documented fixture seam) records every posted
 * FormData entry and answers only from the spec's script: ack, refuse, or hold
 * until the spec releases it. Real profile, upload and AI actions are excluded.
 * No server, account, database or provider.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import ProfileForm from "../../src/app/dashboard/settings/profile/profile-form";
import CompanyProfilePresentation from "../../src/components/company-profile-presentation";

type SaveAnswer = "ack" | "refuse" | "hold";
export interface LocalProfileSectionsFixture {
    /** Every posted FormData, as [name, value] pairs in posting order. */
    saves: Array<Array<[string, string]>>;
    script: SaveAnswer[];
    release: (() => void) | null;
    router: { push: (href: string) => void; refresh: () => void };
}
declare global {
    interface Window { __profileSectionsLocal: LocalProfileSectionsFixture }
}

const fixture: LocalProfileSectionsFixture = {
    saves: [],
    script: [],
    release: null,
    router: {
        push: (href) => { throw new Error(`Local profile fixture does not navigate: ${href}`); },
        refresh: () => undefined,
    },
};
window.__profileSectionsLocal = fixture;

const save = async (data: FormData) => {
    fixture.saves.push(Array.from(data.entries(), ([name, value]) => [name, typeof value === "string" ? value : `[file ${value.name}]`] as [string, string]));
    const answer = fixture.script.shift() ?? "refuse";
    if (answer === "hold") return new Promise<{ success: boolean; error?: string }>(resolve => { fixture.release = () => resolve({ success: true }); });
    if (answer === "ack") return { success: true };
    return { success: false, error: "Local fixture: profile save not acknowledged." };
};

const profile = {
    company_name: "TEST DATA - Example Builders Ltd",
    business_type: "Kitchen fitting",
    phone: "0113 496 0000",
    sales_email: "",
    pdf_theme: "slate",
    preferred_trades: [],
    md_name: "",
    md_message: "",
    data_consent: false,
    financial_year_start_month: 4,
};

createRoot(document.getElementById("app")!).render(
    <CompanyProfilePresentation>
        <ProfileForm profile={profile} userEmail="sam@example.invalid" save={save as Parameters<typeof ProfileForm>[0]["save"]} />
    </CompanyProfilePresentation>,
);
