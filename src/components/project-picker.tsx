"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, FolderOpen, ArrowRight, Plus } from "lucide-react";
import Link from "next/link";

interface Project {
    id: string;
    name: string;
    client_name?: string | null;
    project_type?: string | null;
    proposal_status?: string | null;
    potential_value?: number | null;
    updated_at?: string | null;
}

interface Props {
    projects: Project[];
    targetPath: string;  // e.g. "/dashboard/projects/billing"
    title: string;       // e.g. "Billing & Invoicing"
    description?: string;
}

function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function statusPill(status: string | null | undefined) {
    if (!status) return null;
    const map: Record<string, { label: string; cls: string }> = {
        accepted:  { label: "Accepted",  cls: "bg-green-500/15 text-green-400 border-green-500/20" },
        sent:      { label: "Sent",      cls: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
        viewed:    { label: "Viewed",    cls: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
        draft:     { label: "Draft",     cls: "bg-slate-500/15 text-slate-400 border-slate-500/20" },
        declined:  { label: "Declined",  cls: "bg-red-500/15 text-red-400 border-red-500/20" },
    };
    const config = map[status] ?? map.draft;
    return (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${config.cls}`}>
            {config.label}
        </span>
    );
}

export default function ProjectPicker({ projects, targetPath, title, description }: Props) {
    const [query, setQuery] = useState("");
    const router = useRouter();

    const filtered = projects.filter(p =>
        query.length === 0 ||
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.client_name ?? "").toLowerCase().includes(query.toLowerCase())
    );

    const handleSelect = (projectId: string) => {
        router.push(`${targetPath}?projectId=${projectId}`);
    };

    return (
        <div className="max-w-2xl mx-auto px-6 py-12">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="w-12 h-12 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <FolderOpen className="w-6 h-6 text-blue-400" />
                </div>
                <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
                <p className="text-slate-400 text-sm mt-1">
                    {description ?? "Select a project to continue"}
                </p>
            </div>

            {/* Search */}
            {projects.length > 5 && (
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search projects or clients…"
                        className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                    />
                </div>
            )}

            {/* Project list */}
            {filtered.length === 0 && projects.length === 0 ? (
                <div className="text-center py-12 bg-slate-800/30 border border-slate-700/50 rounded-xl">
                    <FolderOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">No projects yet</p>
                    <p className="text-slate-600 text-sm mt-1">Create a project to get started</p>
                    <Link
                        href="/dashboard/projects/new"
                        className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4" /> New Project
                    </Link>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                    No projects match &ldquo;{query}&rdquo;
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(project => (
                        <button
                            key={project.id}
                            onClick={() => handleSelect(project.id)}
                            className="w-full text-left bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/50 hover:border-slate-600 rounded-xl px-4 py-3.5 transition-all group"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-slate-100 truncate">{project.name}</span>
                                        {statusPill(project.proposal_status)}
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                                        {project.client_name && <span>{project.client_name}</span>}
                                        {project.project_type && <span>· {project.project_type}</span>}
                                        {project.potential_value && project.potential_value > 0 && (
                                            <span>· £{project.potential_value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}</span>
                                        )}
                                        {project.updated_at && <span>· {timeAgo(project.updated_at)}</span>}
                                    </div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 flex-shrink-0 transition-colors" />
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Footer hint */}
            {projects.length > 0 && (
                <p className="text-center text-xs text-slate-600 mt-6">
                    Showing {filtered.length} of {projects.length} projects ·{" "}
                    <Link href="/dashboard/projects/new" className="text-blue-500 hover:text-blue-400 transition-colors">
                        + New Project
                    </Link>
                </p>
            )}
        </div>
    );
}
