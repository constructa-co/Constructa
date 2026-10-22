"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { requestProjectNavigation } from "@/lib/project-navigation";
import { useTheme } from "@/lib/theme-context";

interface ProjectEntryProps {
    projects: { id: string; name: string | null }[];
    path: "/dashboard/projects/brief" | "/dashboard/projects/costs" | "/dashboard/projects/schedule" | "/dashboard/projects/proposal";
}

/** Resolve browser-only project memory before mounting a job's editable workspace. */
export default function ProjectEntry({ projects, path }: ProjectEntryProps) {
    const pathname = usePathname();
    const query = useSearchParams()?.toString() ?? "";
    const router = useRouter();
    const { theme } = useTheme();
    const attempted = useRef<string | null>(null);
    const [retry, setRetry] = useState(0);
    const [notice, setNotice] = useState<string | null>(null);

    const openProject = useEffectEvent((params: URLSearchParams) => {
        let rememberedId: string | null = null;
        try {
            rememberedId = window.localStorage.getItem("constructa_selected_project_id");
        } catch {
            // Storage may be unavailable. Keep the existing newest-project default.
        }
        const project = projects.find(item => item.id === rememberedId) ?? projects[0];
        if (!project) {
            setNotice("No projects are available. Choose or create a project from the dashboard.");
            return;
        }

        try {
            if (!requestProjectNavigation()) {
                setNotice("Your current work has been kept. Open the project when you are ready to leave it.");
                return;
            }
            params.set("projectId", project.id);
            setNotice(null);
            router.replace(`${path}?${params.toString()}${window.location.hash}`, { scroll: false });
        } catch {
            setNotice("The project could not be opened. Try again, or choose it from the dashboard.");
        }
    });

    useEffect(() => {
        const params = new URLSearchParams(query);
        if (pathname !== path || params.has("projectId")) return;
        const attemptKey = `${pathname}?${query}:${retry}`;
        if (attempted.current === attemptKey) return;
        attempted.current = attemptKey;
        openProject(params);
    }, [pathname, query, path, projects, retry]);

    return (
        <section className={`mx-auto max-w-2xl px-4 py-8 sm:px-8 ${theme === "dark" ? "text-slate-100" : "text-slate-900"}`} aria-label="Project selection">
            <p role="status" className="text-base leading-relaxed">
                {notice ?? "Opening your project..."}
            </p>
            {notice && <button type="button" className="mt-4 min-h-11 rounded-lg border border-current px-4 py-2" onClick={() => setRetry(value => value + 1)}>Try opening project again</button>}
            <a className="mt-4 block underline" href="/dashboard">Back to dashboard</a>
        </section>
    );
}
