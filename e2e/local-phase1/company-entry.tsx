import React from "react";
import { createRoot } from "react-dom/client";
import OnboardingClient from "../../src/app/onboarding/onboarding-client";
import ReadinessClient from "../../src/app/dashboard/settings/profile/readiness/readiness-client";
import { FirstSessionFrame } from "../../src/components/first-session-frame";
import { buildCompanyReadiness } from "../../src/lib/company-readiness";
import { buildSetupPatch, resolvePostSetupPath, type SetupStepInput, type SetupProfileSnapshot } from "../../src/lib/first-session";

export interface LocalCompanyFixture {
    profile: SetupProfileSnapshot;
    calls: SetupStepInput[];
    navigation: string[];
    nextSave: "acknowledged" | "refused";
    route: string;
    router: { refresh(): void; push(path: string): void };
}

declare global {
    interface Window { __phase1Local: LocalCompanyFixture }
}

const root = createRoot(document.getElementById("app")!);
const completionPath = resolvePostSetupPath(0, "/dashboard", true);
const fixture: LocalCompanyFixture = {
    profile: {}, calls: [], navigation: [], nextSave: "acknowledged", route: "/onboarding",
    router: {
        refresh: () => { fixture.navigation.push("refresh"); },
        push: path => {
            fixture.navigation.push(path);
            if (path !== completionPath) throw Error("Unexpected fixture route");
            fixture.route = path;
            render();
        },
    },
};
window.__phase1Local = fixture;

// Only the transport/persistence is simulated. Validation and both screens
// below are the application modules, not recreated fixture UI.
async function saveStep(input: SetupStepInput) {
    fixture.calls.push(input);
    const built = buildSetupPatch(input);
    if (!built.ok) return { error: built.error };
    if (fixture.nextSave === "refused") {
        fixture.nextSave = "acknowledged";
        return { error: "Local fixture: save not acknowledged." };
    }
    fixture.profile = { ...fixture.profile, ...built.patch };
    return { ok: true };
}

function render() {
    root.render(fixture.route === "/onboarding" ? (
        <FirstSessionFrame signOut>
            <OnboardingClient initialStep="trade" initialBusinessType="" initialCompanyName="" initialFullName=""
                completionPath={completionPath} exitPath={null} saveStep={saveStep} />
        </FirstSessionFrame>
    ) : (
        <ReadinessClient readiness={buildCompanyReadiness(fixture.profile)} hasProjects={false} />
    ));
}
render();
