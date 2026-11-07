import React from "react";
import { createRoot } from "react-dom/client";
import BriefClient from "../../src/app/dashboard/projects/brief/brief-client";
import EstimateClient from "../../src/app/dashboard/projects/costs/estimate-client";
import type { BriefSavePayload } from "../../src/lib/guided-brief";
import type { EstimatingServer } from "../../src/lib/simple-estimate";

type Project = Parameters<typeof BriefClient>[0]["project"];
export interface LocalBriefPriceFixture {
    project: Project;
    saves: Array<{ projectId: string; payload: BriefSavePayload }>;
    navigation: string[];
    priceWrites: string[];
    nextSave: "success" | "refused";
    router: { push: (href: string) => void };
}
declare global { interface Window { __briefPriceLocal: LocalBriefPriceFixture } }

// about:blank has no storage origin. Keep this fixture's storage ephemeral;
// it does not exercise the application's browser or durable persistence.
const sessionValues = new Map<string, string>();
Object.defineProperty(window, "sessionStorage", { value: {
    get length() { return sessionValues.size; },
    clear: () => sessionValues.clear(),
    key: (index: number) => [...sessionValues.keys()][index] ?? null,
    getItem: (key: string) => sessionValues.get(key) ?? null,
    setItem: (key: string, value: string) => { sessionValues.set(String(key), String(value)); },
    removeItem: (key: string) => { sessionValues.delete(key); },
} satisfies Storage });

const root = createRoot(document.getElementById("app")!);
const refusedPriceWrite = async () => {
    window.__briefPriceLocal.priceWrites.push("Unexpected attempted price write");
    return { ok: false as const, error: "Local fixture: price persistence is excluded." };
};
const server: EstimatingServer = {
    saveLine: refusedPriceWrite, updateLine: refusedPriceWrite,
    deleteLine: refusedPriceWrite, saveAdjustments: refusedPriceWrite,
};
const fixture: LocalBriefPriceFixture = {
    project: { id: "local-brief-price-job", name: "Offline roof repair", client_name: "Synthetic client", site_address: "Existing synthetic site", postcode: "", brief_scope: "", brief_trade_sections: [], client_type: "domestic", potential_value: 1234.5678, start_date: "", lat: null, lng: null, region: "", brief_completed: false },
    saves: [], navigation: [], priceWrites: [], nextSave: "success",
    router: { push: href => {
        if (href !== "/dashboard/projects/costs?projectId=local-brief-price-job") throw Error("Unexpected fixture destination");
        fixture.navigation.push(href);
        root.render(<EstimateClient estimates={[]} project={{ id: fixture.project.id, name: fixture.project.name, client_name: fixture.project.client_name, brief_scope: fixture.project.brief_scope ?? "", brief_trade_sections: fixture.project.brief_trade_sections }} server={server}
            loadAdvancedData={async () => ({ ok: false, error: "Advanced tools are outside this fixture." })} />);
    } },
};
window.__briefPriceLocal = fixture;
root.render(<BriefClient project={fixture.project} ask={async () => { throw Error("No AI transport in the fixture"); }} save={async (projectId, payload) => {
    fixture.saves.push({ projectId, payload: structuredClone(payload) });
    if (fixture.nextSave === "refused") { fixture.nextSave = "success"; return { success: false, error: "Local fixture: Brief save not acknowledged." }; }
    fixture.project = { ...fixture.project, ...payload, start_date: payload.start_date ?? "" };
    return { success: true };
}} />);
