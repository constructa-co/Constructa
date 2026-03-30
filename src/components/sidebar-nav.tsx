"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
    LayoutDashboard,
    FilePlus,
    FileText,
    BookOpen,
    Calculator,
    Wrench,
    User,
    LogOut,
    ChevronRight,
    Search,
    Clock,
    Receipt,
    GitBranch,
    CalendarDays,
    Building2,
} from "lucide-react";

interface Project {
    id: string;
    name: string;
    client_name?: string;
}

interface SidebarNavProps {
    user: { email?: string };
    projects: Project[];
}

function NavItem({
    href,
    icon: Icon,
    label,
    active,
    badge,
    disabled,
    indent,
}: {
    href: string;
    icon: any;
    label: string;
    active?: boolean;
    badge?: string;
    disabled?: boolean;
    indent?: boolean;
}) {
    if (disabled) {
        return (
            <div className={`flex items-center gap-3 px-3 py-2 rounded-md opacity-40 cursor-not-allowed ${indent ? "ml-2" : ""}`}>
                <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-400 font-medium">{label}</span>
                {badge && (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {badge}
                    </span>
                )}
            </div>
        );
    }

    return (
        <Link
            href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-all group ${indent ? "ml-2" : ""} ${
                active
                    ? "bg-blue-50 text-blue-700 border border-blue-100"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
        >
            <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`} />
            <span className="text-sm truncate">{label}</span>
            {badge && (
                <span className={`ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    active ? "text-blue-600 bg-blue-100" : "text-slate-400 bg-slate-100"
                }`}>
                    {badge}
                </span>
            )}
        </Link>
    );
}

function SectionLabel({ label }: { label: string }) {
    return (
        <div className="px-3 pt-5 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {label}
        </div>
    );
}

export default function SidebarNav({ user, projects }: SidebarNavProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const activeProjectId = searchParams.get("projectId");

    const is = (path: string) => pathname === path || pathname.startsWith(path + "/") || pathname.startsWith(path + "?");

    return (
        <aside className="w-64 border-r border-slate-200 bg-white hidden md:flex flex-col h-screen fixed z-30">
            {/* Logo */}
            <div className="p-5 pb-3">
                <Link href="/dashboard" className="flex items-center gap-2.5 group">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-base group-hover:bg-blue-700 transition-colors">
                        C
                    </div>
                    <span className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                        Constructa
                    </span>
                </Link>
            </div>

            {/* Search */}
            <div className="px-4 pb-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-slate-400 text-sm border border-slate-200 cursor-not-allowed opacity-60">
                    <Search className="w-3.5 h-3.5" />
                    <span className="text-xs">Search...</span>
                </div>
            </div>

            {/* Nav */}
            <div className="flex-1 overflow-y-auto px-3 pb-4">

                {/* Main */}
                <div className="space-y-0.5 pt-1">
                    <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" active={pathname === "/dashboard"} />
                </div>

                {/* Proposals */}
                <SectionLabel label="Proposals" />
                <div className="space-y-0.5">
                    <NavItem href="/dashboard/projects/new" icon={FilePlus} label="New Project" active={pathname.includes("/projects/new")} />

                    {projects.length > 0 && (
                        <div className="pt-1 space-y-0.5">
                            {projects.map((p) => {
                                const isActive = activeProjectId === p.id || (pathname.includes("/projects/") && searchParams.get("projectId") === p.id);
                                return (
                                    <Link
                                        key={p.id}
                                        href={`/dashboard/projects/proposal?projectId=${p.id}`}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-md ml-1 transition-all group ${
                                            isActive
                                                ? "bg-blue-50 text-blue-700 border border-blue-100"
                                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                        }`}
                                    >
                                        <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-blue-500" : "text-slate-300 group-hover:text-slate-400"}`} />
                                        <div className="overflow-hidden flex-1 min-w-0">
                                            <div className="text-xs font-semibold truncate">{p.name}</div>
                                            {p.client_name && (
                                                <div className="text-[10px] text-slate-400 truncate">{p.client_name}</div>
                                            )}
                                        </div>
                                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
                                    </Link>
                                );
                            })}
                        </div>
                    )}

                    {projects.length === 0 && (
                        <div className="px-3 py-2 ml-1 text-xs text-slate-400 italic">
                            No projects yet
                        </div>
                    )}
                </div>

                {/* Pricing Tools */}
                <SectionLabel label="Pricing Tools" />
                <div className="space-y-0.5">
                    <NavItem href="/dashboard/foundations" icon={Calculator} label="Estimator" active={is("/dashboard/foundations")} />
                    <NavItem href="/dashboard/library" icon={BookOpen} label="Cost Library" active={is("/dashboard/library")} />
                    <NavItem href="/dashboard/resources" icon={Wrench} label="Resources" active={is("/dashboard/resources")} />
                </div>

                {/* Project Modules (coming soon) */}
                <SectionLabel label="Project Modules" />
                <div className="space-y-0.5">
                    <NavItem href="/dashboard/projects/billing" icon={Receipt} label="Billing & Valuations" active={is("/dashboard/projects/billing")} disabled />
                    <NavItem href="/dashboard/projects/variations" icon={GitBranch} label="Variations" active={is("/dashboard/projects/variations")} disabled />
                    <NavItem href="/dashboard/projects/schedule" icon={CalendarDays} label="Programme" active={is("/dashboard/projects/schedule")} disabled />
                    <NavItem href="/dashboard/projects/contracts" icon={FileText} label="Contracts" active={is("/dashboard/projects/contracts")} disabled />
                </div>

                {/* Account */}
                <SectionLabel label="Account" />
                <div className="space-y-0.5">
                    <NavItem href="/dashboard/settings/profile" icon={Building2} label="Company Profile" active={is("/dashboard/settings/profile")} />
                    <NavItem href="/onboarding" icon={User} label="Setup Wizard" active={false} />
                </div>

            </div>

            {/* User footer */}
            <div className="p-3 border-t border-slate-100 bg-white">
                <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {user.email?.[0].toUpperCase()}
                    </div>
                    <div className="overflow-hidden flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">{user.email?.split("@")[0]}</div>
                        <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
                    </div>
                    <form action="/auth/signout" method="post">
                        <button className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-red-500 transition-colors">
                            <LogOut className="w-3.5 h-3.5" />
                        </button>
                    </form>
                </div>
            </div>
        </aside>
    );
}
