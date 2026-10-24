import React from "react";
import { createRoot } from "react-dom/client";
import SidebarNav from "../../src/components/sidebar-nav";
import ProjectNavBar from "../../src/components/project-navbar";
import BriefClient from "../../src/app/dashboard/projects/brief/brief-client";
import { JOB_WORKFLOW } from "../../src/lib/job-workflow";
import type { BriefSavePayload } from "../../src/lib/guided-brief";

// 1845 A004 boundary: the ACTUAL BriefClient (its real cancelable
// BEFORE_PROJECT_NAVIGATION / anchor / beforeunload guard, brief-client.tsx
// lines 128-155) wired to the actual SidebarNav / ProjectNavBar navigation,
// instead of the synthetic dirty editor used by the original scaffold.

type BriefProject = Parameters<typeof BriefClient>[0]["project"];

export interface LocalBriefNavigationFixture {
    projects: BriefProject[];
    currentProjectId: string | null;
    pathname: string;
    query: string;
    theme: "system-c" | "dark";
    navigation: string[];
    saves: Array<{ projectId: string; payload: BriefSavePayload }>;
    /** Explicit mock save limit: the first save is refused once, then acknowledged. */
    nextSave: "acknowledged" | "refused";
    follow: (href: string) => void;
    setNextSave: (value: "acknowledged" | "refused") => void;
    rerender: () => void;
    router: { push: (href: string) => void };
}

declare global {
    interface Window { __briefNavigationLocal: LocalBriefNavigationFixture }
}

// about:blank has no storage origin. Keep this fixture's storage in explicit
// memory; it does not exercise the application's durable persistence.
const memory = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
        get length() { return memory.size; },
        clear: () => memory.clear(),
        key: (index: number) => [...memory.keys()][index] ?? null,
        getItem: (key: string) => memory.get(String(key)) ?? null,
        setItem: (key: string, value: string) => { memory.set(String(key), String(value)); },
        removeItem: (key: string) => { memory.delete(String(key)); },
    } satisfies Storage,
});

// Existing NodeWebCrypto bridge pattern (e2e/local-phase1/first-job-entry):
// only used when the browser build lacks randomUUID; getRandomValues is native.
if (typeof crypto.randomUUID !== "function") {
    Object.defineProperty(crypto, "randomUUID", {
        configurable: true,
        value: () => {
            const bytes = crypto.getRandomValues(new Uint8Array(16));
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;
            const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
            return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        },
    });
}

const root = createRoot(document.getElementById("app")!);

// Mocked Next client routing: commit a fixture route and re-render the shell.
function applyRoute(href: string) {
    const [path = "/", query = ""] = href.split("?");
    fixture.pathname = path;
    fixture.query = query;
    fixture.currentProjectId = new URLSearchParams(query).get("projectId");
    fixture.navigation.push(href);
    render();
}

const fixture: LocalBriefNavigationFixture = {
    projects: [
        {
            id: "job-1", name: "Synthetic job one", client_name: "Synthetic client",
            site_address: "1 Synthetic Street", postcode: "SW1A 1AA",
            brief_scope: "", brief_trade_sections: [], client_type: "domestic",
            potential_value: null, start_date: "", lat: null, lng: null, region: "",
            brief_completed: false,
        },
        {
            id: "job-2", name: "Other synthetic job", client_name: "Another client",
            site_address: "2 Synthetic Avenue", postcode: "M1 2AB",
            brief_scope: "", brief_trade_sections: [], client_type: "domestic",
            potential_value: null, start_date: "", lat: null, lng: null, region: "",
            brief_completed: false,
        },
    ],
    currentProjectId: "job-1",
    pathname: "/dashboard/projects/brief",
    query: "projectId=job-1",
    theme: "system-c",
    navigation: [],
    saves: [],
    nextSave: "acknowledged",
    follow: applyRoute,
    setNextSave: (value) => { fixture.nextSave = value; },
    rerender: () => render(),
    router: { push: applyRoute },
};
window.__briefNavigationLocal = fixture;

function render() {
    const step = JOB_WORKFLOW.find(
        (s) => fixture.pathname === s.path || fixture.pathname.startsWith(`${s.path}/`),
    );
    const project = fixture.projects.find((p) => p.id === fixture.currentProjectId) ?? fixture.projects[0];
    root.render(
        <>
            {step ? (
                <ProjectNavBar projectId={project.id} projectName={project.name} activeTab={step.key} />
            ) : null}
            {/* key=project.id mirrors real navigation: leaving the brief for
                another job remounts the page, so unsaved state is gone. */}
            <BriefClient
                key={project.id}
                project={project}
                ask={async () => { throw new Error("No AI transport in the fixture"); }}
                save={async (projectId, payload) => {
                    fixture.saves.push({ projectId, payload: structuredClone(payload) });
                    if (fixture.nextSave === "refused") {
                        fixture.nextSave = "acknowledged";
                        return { success: false, error: "Local fixture: Brief save not acknowledged." };
                    }
                    return { success: true };
                }}
            />
            <SidebarNav user={{ email: "local.operator@constructa.test" }} projects={fixture.projects} />
        </>,
    );
}
render();
