"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
    LayoutDashboard,
    FilePlus,
    BookOpen,
    Wrench,
    Building2,
    Images,
    Wand2,
    Archive,
    LogOut,
    Sun,
    Moon,
    ClipboardList,
    Calculator,
    CalendarDays,
    Scale,
    FileText,
    CreditCard,
    GitBranch,
    RefreshCw,
    TrendingUp,
    MessageSquare,
    FolderOpen,
    Receipt,
    BookMarked,
    Kanban,
    ChevronDown,
    ChevronRight,
    X,
    FolderKanban,
    Search,
} from "lucide-react";
import { useTheme } from "@/lib/theme-context";

interface Project {
    id: string;
    name: string;
    client_name?: string | null;
}

interface SidebarNavProps {
    user: { email?: string };
    projects: Project[];
}

// ── NavItem ───────────────────────────────────────────────────────────────────
function NavItem({
    href,
    icon: Icon,
    label,
    sublabel,
    active,
    badge,
    disabled,
}: {
    href: string;
    icon: any;
    label: string;
    sublabel?: string;
    active?: boolean;
    badge?: string;
    disabled?: boolean;
}) {
    if (disabled) {
        return (
            <div className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-400 opacity-60 rounded-lg cursor-not-allowed">
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
                <span className="ml-auto text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 font-medium">Soon</span>
            </div>
        );
    }

    return (
        <Link
            href={href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all group text-sm ${
                active
                    ? "bg-gray-900 text-white"
                    : "text-slate-300 hover:text-white hover:bg-white/8"
            }`}
        >
            <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${active ? "text-blue-400" : "text-slate-400 group-hover:text-slate-200"}`} />
            <div className="min-w-0 flex-1">
                <span className="truncate block">{label}</span>
                {sublabel && (
                    <span className="text-[10px] text-slate-500 truncate block">{sublabel}</span>
                )}
            </div>
            {badge && (
                <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${
                    active ? "text-blue-300 bg-blue-500/20" : "bg-gray-100 text-gray-500"
                }`}>
                    {badge}
                </span>
            )}
        </Link>
    );
}

// ── Collapsible Section ───────────────────────────────────────────────────────
function SidebarSection({
    label,
    sectionKey,
    collapsed,
    onToggle,
    children,
}: {
    label: string;
    sectionKey: string;
    collapsed: boolean;
    onToggle: (key: string) => void;
    children: React.ReactNode;
}) {
    return (
        <div className="pt-1">
            <button
                onClick={() => onToggle(sectionKey)}
                className="w-full flex items-center justify-between px-3 py-1.5 group"
            >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 group-hover:text-slate-400 transition-colors">
                    {label}
                </span>
                {collapsed
                    ? <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
                    : <ChevronDown className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
                }
            </button>
            {!collapsed && (
                <div className="space-y-0.5 mt-0.5">
                    {children}
                </div>
            )}
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SidebarNav({ user, projects }: SidebarNavProps) {
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark";

    // ── Project Selector State ─────────────────────────────────────────────
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const pickerRef = useRef<HTMLDivElement>(null);

    // ── Collapsed sections (stored in localStorage) ────────────────────────
    // Default: Company Profile and Closed Projects collapsed; Work Winning always open
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
        "company-profile": true,
        "pre-construction": true,
        "live-projects": true,
        "closed-projects": true,
    });

    // Load persisted state on mount
    useEffect(() => {
        const savedProject = localStorage.getItem("constructa_selected_project_id");
        const savedName    = localStorage.getItem("constructa_selected_project_name");
        if (savedProject && savedName) {
            const exists = projects.some(p => p.id === savedProject);
            if (exists) {
                setSelectedProjectId(savedProject);
                setSelectedProjectName(savedName);
            } else {
                localStorage.removeItem("constructa_selected_project_id");
                localStorage.removeItem("constructa_selected_project_name");
            }
        }

        const savedCollapsed = localStorage.getItem("constructa_sidebar_collapsed");
        if (savedCollapsed) {
            try { setCollapsed(JSON.parse(savedCollapsed)); } catch { /* ignore */ }
        }
    }, [projects]);

    // Auto-expand Pre-Construction + Live Projects when a project is selected
    useEffect(() => {
        if (selectedProjectId) {
            setCollapsed(prev => {
                const next = { ...prev, "pre-construction": false, "live-projects": false };
                localStorage.setItem("constructa_sidebar_collapsed", JSON.stringify(next));
                return next;
            });
        }
    }, [selectedProjectId]);

    // Close picker on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setPickerOpen(false);
                setSearchQuery("");
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const toggleSection = (key: string) => {
        setCollapsed(prev => {
            const next = { ...prev, [key]: !prev[key] };
            localStorage.setItem("constructa_sidebar_collapsed", JSON.stringify(next));
            return next;
        });
    };

    const selectProject = (id: string, name: string) => {
        setSelectedProjectId(id);
        setSelectedProjectName(name);
        localStorage.setItem("constructa_selected_project_id", id);
        localStorage.setItem("constructa_selected_project_name", name);
        setPickerOpen(false);
        setSearchQuery("");
    };

    const clearProject = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedProjectId(null);
        setSelectedProjectName(null);
        localStorage.removeItem("constructa_selected_project_id");
        localStorage.removeItem("constructa_selected_project_name");
    };

    // Project-aware link: appends ?projectId=X when selected
    const pLink = (base: string) =>
        selectedProjectId ? `${base}?projectId=${selectedProjectId}` : base;

    const is = (path: string) =>
        pathname != null &&
        (pathname === path ||
            pathname.startsWith(path + "/") ||
            pathname.startsWith(path + "?"));

    const filteredProjects = projects.filter(p =>
        searchQuery.length === 0 ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.client_name ?? "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <aside className="w-64 bg-[#0d0d0d] hidden md:flex flex-col h-screen fixed z-30">
            {/* Logo */}
            <div className="p-5 pb-3">
                <Link href="/dashboard" className="flex items-center gap-2.5 group">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-base group-hover:bg-blue-500 transition-colors">
                        C
                    </div>
                    <span className="text-lg font-bold tracking-tight text-white group-hover:text-blue-300 transition-colors">
                        Constructa
                    </span>
                </Link>
            </div>

            {/* Nav — scrollable */}
            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">

                {/* Overview — always visible */}
                <div className="pb-1">
                    <NavItem href="/dashboard/home" icon={LayoutDashboard} label="Overview" active={is("/dashboard/home")} />
                </div>

                {/* Company Profile — collapsible, default closed */}
                <SidebarSection
                    label="Company Profile"
                    sectionKey="company-profile"
                    collapsed={collapsed["company-profile"] ?? true}
                    onToggle={toggleSection}
                >
                    <NavItem href="/dashboard/settings/profile" icon={Building2} label="Profile" active={is("/dashboard/settings/profile")} />
                    <NavItem href="/dashboard/settings/case-studies" icon={Images} label="Case Studies" active={is("/dashboard/settings/case-studies")} />
                    <NavItem href="/onboarding?force=true" icon={Wand2} label="Setup Wizard" active={false} />
                </SidebarSection>

                {/* Work Winning — always expanded (primary section) */}
                <div className="pt-1">
                    <div className="px-3 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Work Winning</span>
                    </div>
                    <div className="space-y-0.5">
                        <NavItem href="/dashboard" icon={Kanban} label="Pipeline" active={pathname === "/dashboard"} />
                        <NavItem href="/dashboard/projects/new" icon={FilePlus} label="New Project" active={pathname?.includes("/projects/new") ?? false} />
                        <hr className="my-2 border-white/10" />
                        <NavItem href="/dashboard/library" icon={BookOpen} label="Cost Library" active={is("/dashboard/library")} />
                        <NavItem href="/dashboard/resources" icon={Wrench} label="Resources" active={is("/dashboard/resources")} />
                    </div>
                </div>

                {/* ── Active Project Selector ──────────────────────────── */}
                <div className="pt-3 pb-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-3 pb-1.5">
                        Active Project
                    </div>
                    <div ref={pickerRef} className="relative px-1">
                        <button
                            onClick={() => setPickerOpen(!pickerOpen)}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all border ${
                                selectedProjectId
                                    ? "bg-blue-600/15 border-blue-500/30 text-blue-300 hover:bg-blue-600/25"
                                    : "bg-white/5 border-white/8 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                            }`}
                        >
                            <FolderKanban className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="flex-1 text-left truncate font-medium">
                                {selectedProjectName ?? "Select a project…"}
                            </span>
                            {selectedProjectId ? (
                                <X
                                    className="w-3 h-3 flex-shrink-0 hover:text-white transition-colors"
                                    onClick={clearProject}
                                />
                            ) : (
                                <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${pickerOpen ? "rotate-180" : ""}`} />
                            )}
                        </button>

                        {/* Dropdown */}
                        {pickerOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden">
                                <div className="p-2 border-b border-white/10">
                                    <div className="relative">
                                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                                        <input
                                            autoFocus
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            placeholder="Search projects…"
                                            className="w-full bg-white/5 border border-white/10 rounded-md pl-6 pr-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="max-h-52 overflow-y-auto">
                                    {filteredProjects.length === 0 ? (
                                        <div className="px-3 py-4 text-xs text-slate-500 text-center">
                                            {projects.length === 0 ? "No projects yet" : "No matches"}
                                        </div>
                                    ) : (
                                        filteredProjects.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => selectProject(p.id, p.name)}
                                                className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/8 ${
                                                    selectedProjectId === p.id
                                                        ? "bg-blue-600/20 text-blue-300"
                                                        : "text-slate-300"
                                                }`}
                                            >
                                                <div className="font-medium truncate">{p.name}</div>
                                                {p.client_name && (
                                                    <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                                        {p.client_name}
                                                    </div>
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                                <div className="px-3 py-1.5 border-t border-white/10 text-[10px] text-slate-600">
                                    {selectedProjectId ? "Click × to deselect" : "Links below open this project"}
                                </div>
                            </div>
                        )}
                    </div>
                    {selectedProjectId && (
                        <p className="px-3 pt-1 text-[10px] text-slate-600 leading-tight">
                            Module links go directly to this project
                        </p>
                    )}
                </div>

                {/* Pre-Construction — collapsible, auto-expands when project selected */}
                <SidebarSection
                    label="Pre-Construction"
                    sectionKey="pre-construction"
                    collapsed={collapsed["pre-construction"] ?? true}
                    onToggle={toggleSection}
                >
                    <NavItem href={pLink("/dashboard/projects/brief")} icon={ClipboardList} label="Briefs" active={is("/dashboard/projects/brief")} />
                    <NavItem href={pLink("/dashboard/projects/costs")} icon={Calculator} label="Estimates" active={is("/dashboard/projects/costs")} />
                    <NavItem href={pLink("/dashboard/projects/schedule")} icon={CalendarDays} label="Programmes" active={is("/dashboard/projects/schedule")} />
                    <NavItem href={pLink("/dashboard/projects/contracts")} icon={Scale} label="Contracts" active={is("/dashboard/projects/contracts")} />
                    <NavItem href={pLink("/dashboard/projects/proposal")} icon={FileText} label="Proposals" active={is("/dashboard/projects/proposal")} />
                </SidebarSection>

                {/* Live Projects — collapsible, auto-expands when project selected */}
                <SidebarSection
                    label="Live Projects"
                    sectionKey="live-projects"
                    collapsed={collapsed["live-projects"] ?? true}
                    onToggle={toggleSection}
                >
                    <NavItem href="/dashboard/live" icon={LayoutDashboard} label="Overview" active={pathname === "/dashboard/live"} />
                    <NavItem href={pLink("/dashboard/projects/billing")} icon={CreditCard} label="Billing & Invoicing" active={is("/dashboard/projects/billing")} />
                    <NavItem href={pLink("/dashboard/projects/variations")} icon={GitBranch} label="Variations" active={is("/dashboard/projects/variations")} />
                    <NavItem href={pLink("/dashboard/projects/p-and-l")} icon={TrendingUp} label="Job P&L" active={is("/dashboard/projects/p-and-l")} />
                    <NavItem href="#" icon={RefreshCw} label="Change Management" disabled />
                    <NavItem href="#" icon={CalendarDays} label="Programme" disabled />
                    <NavItem href="#" icon={MessageSquare} label="Communications" disabled />
                </SidebarSection>

                {/* Closed Projects — collapsible, always collapsed by default */}
                <SidebarSection
                    label="Closed Projects"
                    sectionKey="closed-projects"
                    collapsed={collapsed["closed-projects"] ?? true}
                    onToggle={toggleSection}
                >
                    <NavItem href="#" icon={Archive} label="Archive" disabled />
                    <NavItem href="#" icon={Receipt} label="Final Accounts" disabled />
                    <NavItem href="#" icon={FolderOpen} label="Handover Documents" disabled />
                    <NavItem href="#" icon={BookMarked} label="Lessons Learned" disabled />
                </SidebarSection>

            </div>

            {/* Theme Toggle */}
            <div className="px-4 pb-3">
                <button
                    onClick={() => setTheme(isDark ? "system-c" : "dark")}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all text-xs font-medium"
                >
                    {isDark ? (
                        <>
                            <Sun className="w-3.5 h-3.5" />
                            <span>Light Mode</span>
                        </>
                    ) : (
                        <>
                            <Moon className="w-3.5 h-3.5" />
                            <span>Dark Mode</span>
                        </>
                    )}
                </button>
            </div>

            {/* User footer */}
            <div className="p-3 border-t border-white/10">
                <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {user.email?.[0].toUpperCase()}
                    </div>
                    <div className="overflow-hidden flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-200 truncate">{user.email?.split("@")[0]}</div>
                        <div className="text-[10px] text-slate-500 truncate">{user.email}</div>
                    </div>
                    <form action="/auth/signout" method="post">
                        <button className="p-1.5 rounded-md hover:bg-white/10 text-slate-500 hover:text-red-400 transition-colors">
                            <LogOut className="w-3.5 h-3.5" />
                        </button>
                    </form>
                </div>
            </div>
        </aside>
    );
}
