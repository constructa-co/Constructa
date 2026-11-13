"use client";

import Link from "next/link";
import { coreFocusVisibleRing, corePrimaryButton } from "@/lib/core-editing-palette";
import { NEW_PROJECT_PATH } from "@/lib/first-session";
import { useTheme } from "@/lib/theme-context";

/**
 * - `no-jobs`: the contractor has no jobs at all.
 * - `missing-id`: the address carries no usable job ID (absent or blank) and
 *   could not be resolved to one of their jobs.
 * - `job-not-found`: an ID was given but it is not one of their jobs.
 */
export type ProjectEmptyKind = "no-jobs" | "missing-id" | "job-not-found";

interface ProjectEmptyStateProps {
    kind: ProjectEmptyKind;
    /** Name of the step the contractor was opening, e.g. "Brief". */
    stepLabel: string;
    /** Their existing jobs, newest first. Offered as recovery links when present. */
    projects?: { id: string; name: string | null }[];
    /** Step path used to build "open this job" links, e.g. /dashboard/projects/brief. */
    path?: string;
}

const COPY: Record<ProjectEmptyKind, { title: string; body: (step: string) => string }> = {
    "no-jobs": {
        title: "Create a job to start",
        body: step => `${step} belongs to a job, and you have not created one yet. Create your first job, then come back here.`,
    },
    "missing-id": {
        title: "Choose a job to open",
        body: step => `This ${step} address does not say which job to open. Pick one of your jobs below, or go back to the pipeline.`,
    },
    "job-not-found": {
        title: "That job could not be found",
        body: step => `The job in this ${step} address is not one of yours, or has been removed. Pick one of your jobs below, or go back to the pipeline.`,
    },
};

/** Shared recovery panel for job-scoped steps that cannot open a job. */
export default function ProjectEmptyState({ kind, stepLabel, projects = [], path }: ProjectEmptyStateProps) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const copy = COPY[kind];
    const canListJobs = kind !== "no-jobs" && projects.length > 0 && Boolean(path);

    return (
        <section
            className={`mx-auto max-w-2xl px-4 py-8 sm:px-8 ${isDark ? "text-slate-100" : "text-slate-900"}`}
            aria-labelledby="project-empty-title"
            data-empty-kind={kind}
        >
            <h1 id="project-empty-title" className="text-xl font-semibold">{copy.title}</h1>
            <p role="status" className={`mt-2 text-base leading-relaxed ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                {copy.body(stepLabel)}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
                {kind === "no-jobs" && (
                    <Link
                        href={NEW_PROJECT_PATH}
                        className={`inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-medium ${corePrimaryButton} ${coreFocusVisibleRing}`}
                    >
                        Create a job
                    </Link>
                )}
                <Link
                    href="/dashboard"
                    className={`inline-flex min-h-11 items-center rounded-lg border border-current px-4 py-2 text-sm font-medium ${coreFocusVisibleRing}`}
                >
                    Back to pipeline
                </Link>
                {kind !== "no-jobs" && (
                    <Link
                        href={NEW_PROJECT_PATH}
                        className={`inline-flex min-h-11 items-center rounded-lg border border-current px-4 py-2 text-sm font-medium ${coreFocusVisibleRing}`}
                    >
                        Create a job
                    </Link>
                )}
            </div>

            {canListJobs && (
                <nav className="mt-6" aria-label="Your jobs">
                    <h2 className="text-sm font-semibold">Your jobs</h2>
                    <ul className="mt-2 space-y-2">
                        {projects.slice(0, 8).map(project => (
                            <li key={project.id}>
                                <Link
                                    href={`${path}?projectId=${encodeURIComponent(project.id)}`}
                                    className={`block min-h-11 rounded-lg border border-current px-4 py-2.5 text-sm underline-offset-2 hover:underline ${coreFocusVisibleRing}`}
                                >
                                    {project.name?.trim() || "Untitled job"}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
            )}
        </section>
    );
}
