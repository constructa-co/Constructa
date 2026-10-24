import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import SidebarNav from "../../src/components/sidebar-nav";
import ProjectNavBar from "../../src/components/project-navbar";
import { JOB_WORKFLOW } from "../../src/lib/job-workflow";
import { BEFORE_PROJECT_NAVIGATION } from "../../src/lib/project-navigation";

export interface LocalNavigationProject {
    id: string;
    name: string;
    client_name?: string | null;
}

export interface LocalNavigationFixture {
    projects: LocalNavigationProject[];
    currentProjectId: string | null;
    pathname: string;
    query: string;
    theme: "system-c" | "dark";
    navigation: string[];
    dirty: boolean;
    drafts: Record<string, string>;
    follow: (href: string) => void;
    setDirty: (value: boolean) => void;
    rerender: () => void;
    router: { push: (href: string) => void };
}

declare global {
    interface Window { __navigationLocal: LocalNavigationFixture }
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

const root = createRoot(document.getElementById("app")!);

// Mocked Next client routing: commit a fixture route and re-render the shell.
// A committed switch to a different project discards the synthetic editor's
// unsaved draft, mirroring "leave without saving" in the real clients.
function applyRoute(href: string) {
    const [path = "/", query = ""] = href.split("?");
    const nextProjectId = new URLSearchParams(query).get("projectId");
    const switchedProject = nextProjectId !== fixture.currentProjectId;
    fixture.pathname = path;
    fixture.query = query;
    fixture.currentProjectId = nextProjectId;
    fixture.navigation.push(href);
    if (switchedProject) {
        fixture.dirty = false;
        fixture.drafts = {};
    }
    render();
}

const fixture: LocalNavigationFixture = {
    projects: [
        { id: "job-1", name: "Synthetic job one", client_name: "Synthetic client" },
        { id: "job-2", name: "Other synthetic job", client_name: "Another client" },
    ],
    currentProjectId: "job-1",
    pathname: "/dashboard/projects/brief",
    query: "projectId=job-1",
    theme: "system-c",
    navigation: [],
    dirty: false,
    drafts: {},
    follow: applyRoute,
    setDirty: (value) => { fixture.dirty = value; render(); },
    rerender: () => render(),
    router: { push: applyRoute },
};
window.__navigationLocal = fixture;

// Synthetic active editor page. It is NOT a copied view: it only reproduces
// the unsaved-changes guard contract that the real brief/estimate/programme
// clients implement — a cancelable BEFORE_PROJECT_NAVIGATION listener using
// window.confirm, so SidebarNav's real requestProjectNavigation() call is what
// actually gates the project switch.
function SyntheticJobEditor() {
    const [draft, setDraft] = useState(fixture.drafts.brief ?? "");
    useEffect(() => {
        const confirmLeave = (event: Event) => {
            const leave = window.confirm(
                "SYNTHETIC EDITOR: this job has unsaved changes.\n\nPress Cancel to stay here and save them, or OK to leave without saving.",
            );
            if (!leave) {
                event.preventDefault();
                event.stopPropagation();
            }
        };
        const warnOnUnload = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener(BEFORE_PROJECT_NAVIGATION, confirmLeave);
        window.addEventListener("beforeunload", warnOnUnload);
        return () => {
            window.removeEventListener(BEFORE_PROJECT_NAVIGATION, confirmLeave);
            window.removeEventListener("beforeunload", warnOnUnload);
        };
    }, []);
    return (
        <section aria-label="Synthetic job editor">
            <label htmlFor="synthetic-draft">Synthetic draft</label>
            <textarea
                id="synthetic-draft"
                value={draft}
                onChange={(event) => {
                    setDraft(event.target.value);
                    fixture.drafts = { ...fixture.drafts, brief: event.target.value };
                }}
            />
        </section>
    );
}

function render() {
    const step = JOB_WORKFLOW.find(
        (s) => fixture.pathname === s.path || fixture.pathname.startsWith(`${s.path}/`),
    );
    const project = fixture.projects.find((p) => p.id === fixture.currentProjectId);
    root.render(
        <>
            {step ? (
                <ProjectNavBar
                    projectId={fixture.currentProjectId ?? ""}
                    projectName={project?.name}
                    activeTab={step.key}
                />
            ) : null}
            {fixture.dirty ? <SyntheticJobEditor /> : null}
            <SidebarNav user={{ email: "local.operator@constructa.test" }} projects={fixture.projects} />
        </>,
    );
}
render();
