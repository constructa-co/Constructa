import React from "react";
import { createRoot } from "react-dom/client";
import DashboardShell from "../../src/components/dashboard-shell";
import ProjectNavBar from "../../src/components/project-navbar";
import { JOB_WORKFLOW } from "../../src/lib/job-workflow";

/**
 * C12 A004 shell boundary: the REAL DashboardShell (sidebar offset + phone top
 * padding) composing the REAL retained page header (ProjectNavBar) and a
 * harmless synthetic body — not the c09/20db synthetic flex scaffold.
 */

export interface ShellHierarchyFixture {
    projects: Array<{ id: string; name: string; client_name?: string }>;
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
    interface Window {
        __shellHierarchyOptions?: { theme: "system-c" | "dark" };
        __shellHierarchyLocal: ShellHierarchyFixture;
    }
}

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

function applyRoute(href: string) {
    const [path = "/", query = ""] = href.split("?");
    fixture.pathname = path;
    fixture.query = query;
    fixture.currentProjectId = new URLSearchParams(query).get("projectId");
    fixture.navigation.push(href);
    render();
}

const fixture: ShellHierarchyFixture = {
    projects: [
        { id: "job-1", name: "Synthetic job one", client_name: "Synthetic client" },
        { id: "job-2", name: "Other synthetic job", client_name: "Another client" },
    ],
    currentProjectId: "job-1",
    pathname: "/dashboard/projects/brief",
    query: "projectId=job-1",
    theme: window.__shellHierarchyOptions?.theme ?? "system-c",
    navigation: [],
    follow: applyRoute,
    rerender: () => render(),
    router: { push: applyRoute },
};
window.__shellHierarchyLocal = fixture;

function render() {
    const step = JOB_WORKFLOW.find(
        (s) => fixture.pathname === s.path || fixture.pathname.startsWith(`${s.path}/`),
    );
    const project = fixture.projects.find((p) => p.id === fixture.currentProjectId) ?? fixture.projects[0];
    root.render(
        <DashboardShell user={{ email: "local.operator@constructa.test" }} projects={fixture.projects}>
            {step ? (
                <ProjectNavBar projectId={project.id} projectName={project.name} activeTab={step.key} />
            ) : null}
            <section aria-label="Fixture page body" data-page={fixture.pathname}>
                <h1 className="text-2xl font-bold">Job brief</h1>
                <p>Local shell fixture body for {project.name}.</p>
            </section>
        </DashboardShell>,
    );
}
render();
