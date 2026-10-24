import React from "react";
import { createRoot } from "react-dom/client";
import SidebarNav from "../../src/components/sidebar-nav";
import ProjectNavBar from "../../src/components/project-navbar";
import { JOB_WORKFLOW } from "../../src/lib/job-workflow";

// 2125 A004 responsive boundary: the REAL single navigation hierarchy
// (SidebarNav + PhoneMenuFocus) with the REAL retained page header
// (ProjectNavBar, as composed on the actual project pages) under the ACTUAL
// compiled application stylesheet. Unlike the original scaffold, Tailwind
// visibility utilities are present, so desktop/phone surfaces are proven
// styled, not just present in the DOM.

export interface ResponsiveHierarchyFixture {
    projects: Array<{ id: string; name: string; client_name?: string | null }>;
    currentProjectId: string | null;
    pathname: string;
    query: string;
    theme: "system-c" | "dark";
    navigation: string[];
    follow: (href: string) => void;
    rerender: () => void;
    router: { push: (href: string) => void };
}

declare global {
    interface Window { __responsiveHierarchyLocal: ResponsiveHierarchyFixture }
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
function applyRoute(href: string) {
    const [path = "/", query = ""] = href.split("?");
    fixture.pathname = path;
    fixture.query = query;
    fixture.currentProjectId = new URLSearchParams(query).get("projectId");
    fixture.navigation.push(href);
    render();
}

const fixture: ResponsiveHierarchyFixture = {
    projects: [
        { id: "job-1", name: "Synthetic job one", client_name: "Synthetic client" },
        { id: "job-2", name: "Other synthetic job", client_name: "Another client" },
    ],
    currentProjectId: "job-1",
    pathname: "/dashboard/projects/brief",
    query: "projectId=job-1",
    theme: "system-c",
    navigation: [],
    follow: applyRoute,
    rerender: () => render(),
    router: { push: applyRoute },
};
window.__responsiveHierarchyLocal = fixture;

function render() {
    const step = JOB_WORKFLOW.find(
        (s) => fixture.pathname === s.path || fixture.pathname.startsWith(`${s.path}/`),
    );
    const project = fixture.projects.find((p) => p.id === fixture.currentProjectId) ?? fixture.projects[0];
    root.render(
        <>
            {/* Retained page header, exactly as the real project pages compose it. */}
            {step ? (
                <ProjectNavBar projectId={project.id} projectName={project.name} activeTab={step.key} />
            ) : null}
            <main aria-label="Fixture page body" data-page={fixture.pathname}>
                <h1 className="text-2xl font-bold">Job brief</h1>
                <p>Local styled fixture body for {project.name}.</p>
            </main>
            <SidebarNav user={{ email: "local.operator@constructa.test" }} projects={fixture.projects} />
        </>,
    );
}
render();
