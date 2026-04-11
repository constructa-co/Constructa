"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
    Users,
    Truck,
    PieChart,
    Activity,
    BarChart2,
    HardHat,
    Key,
    Lightbulb,
    Smartphone,
    Package,
    Zap,
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
    isAdmin?: boolean;
}

// ── NavItem ───────────────────────────────────────────────────────────────────
function NavItem({
    href,
    icon: Icon,
    label,
    active,
    disabled,
}: {
    href: string;
    icon: any;
    label: string;
    active?: boolean;
    disabled?: boolean;
}) {
    if (disabled) {
        return (
            <div className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 rounded-lg cursor-not-allowed">
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                <span className="text-[10px] text-slate-700 rounded px-1.5 py-0.5 font-medium border border-slate-800">Soon</span>
            </div>
        );
    }
    return (
        <Link
            href={href}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all group text-sm ${
                active ? "bg-gray-900 text-white" : "text-slate-300 hover:text-white hover:bg-white/8"
            }`}
        >
            <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${active ? "text-blue-400" : "text-slate-400 group-hover:text-slate-200"}`} />
            <span className="truncate">{label}</span>
        </Link>
    );
}

// ── Collapsible Section — accordion style ────────────────────────────────────
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
        <div>
            <button
                onClick={() => onToggle(sectionKey)}
                className="w-full flex items-center justify-between px-3 py-2 group"
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
                <div className="space-y-0.5 pb-1">
                    {children}
                </div>
            )}
        </div>
    );
}

const SECTION_KEYS = ["company-profile", "work-winning", "pre-construction", "live-projects", "closed-projects"];

// ── Main Component ────────────────────────────────────────────────────────────
export default function SidebarNav({ user, projects, isAdmin = false }: SidebarNavProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark";

    // Project selector state
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const pickerRef = useRef<HTMLDivElement>(null);

    // Accordion: all sections collapsed by default
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
        "company-profile": true,
        "work-winning": true,
        "pre-construction": true,
        "live-projects": true,
        "closed-projects": true,
    });

    // Load localStorage on mount
    useEffect(() => {
        const savedId   = localStorage.getItem("constructa_selected_project_id");
        const savedName = localStorage.getItem("constructa_selected_project_name");
        if (savedId && savedName && projects.some(p => p.id === savedId)) {
            setSelectedProjectId(savedId);
            setSelectedProjectName(savedName);
        } else {
            localStorage.removeItem("constructa_selected_project_id");
            localStorage.removeItem("constructa_selected_project_name");
        }

        const savedCollapsed = localStorage.getItem("constructa_sidebar_collapsed");
        if (savedCollapsed) {
            try { setCollapsed(JSON.parse(savedCollapsed)); } catch { /* ignore */ }
        }
    }, [projects]);

    // Sprint 58 P1.6: sync active project from URL params.
    //
    // Perplexity live-app walkthrough caught that if a user navigated
    // straight to a project sub-page (e.g. /dashboard/projects/variations
    // ?projectId=XXX) the sidebar widget would still show "Select a
    // project…" because it only read from localStorage at mount. This
    // made the active-project indicator unreliable on deep links,
    // bookmarks, and any internal navigation that pre-filled projectId.
    //
    // Treat the URL `projectId` param as the source of truth whenever
    // it exists. Fall back to localStorage for non-project pages.
    useEffect(() => {
        const urlProjectId = searchParams?.get("projectId");
        if (!urlProjectId) return;
        // Only update if the URL param differs from current state AND
        // the project exists in the sidebar's known list (guards against
        // stale IDs that no longer map to a visible project).
        const match = projects.find((p) => p.id === urlProjectId);
        if (!match) return;
        if (urlProjectId === selectedProjectId) return;
        setSelectedProjectId(match.id);
        setSelectedProjectName(match.name);
        localStorage.setItem("constructa_selected_project_id", match.id);
        localStorage.setItem("constructa_selected_project_name", match.name);
    }, [searchParams, projects, selectedProjectId]);

    // Auto-expand Pre-Construction only when project is selected (accordion — closes all others)
    useEffect(() => {
        if (selectedProjectId) {
            setCollapsed(prev => {
                const next: Record<string, boolean> = {};
                SECTION_KEYS.forEach(k => { next[k] = k !== "pre-construction"; });
                localStorage.setItem("constructa_sidebar_collapsed", JSON.stringify(next));
                return next;
            });
        }
    }, [selectedProjectId]);

    // Close picker on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setPickerOpen(false);
                setSearchQuery("");
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    // Accordion toggle — opening one section ALWAYS closes all others
    const toggleSection = (key: string) => {
        setCollapsed(prev => {
            const isCurrentlyOpen = prev[key] === false; // false = open; true/undefined = closed
            const next: Record<string, boolean> = {};
            if (isCurrentlyOpen) {
                // Closing: just collapse this one, leave others as-is
                SECTION_KEYS.forEach(k => { next[k] = k === key ? true : (prev[k] ?? true); });
            } else {
                // Opening: collapse ALL, then open only this one
                SECTION_KEYS.forEach(k => { next[k] = k !== key; });
            }
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

    const pLink = (base: string) =>
        selectedProjectId ? `${base}?projectId=${selectedProjectId}` : base;

    const is = (path: string) =>
        pathname != null && (pathname === path || pathname.startsWith(path + "/") || pathname.startsWith(path + "?"));

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
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-base group-hover:bg-blue-500 transition-colors">C</div>
                    <span className="text-lg font-bold tracking-tight text-white group-hover:text-blue-300 transition-colors">Constructa</span>
                </Link>
            </div>

            {/* Scrollable nav */}
            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">

                {/* Overview — always visible */}
                <div className="pb-2">
                    <NavItem href="/dashboard/home" icon={LayoutDashboard} label="Overview" active={is("/dashboard/home")} />
                    <NavItem href="/dashboard/mobile" icon={Smartphone} label="On-site Hub" active={is("/dashboard/mobile")} />
                </div>

                {/* ── Active Project Selector — always visible, at top ─── */}
                <div className="pb-3">
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
                            {selectedProjectId
                                ? <X className="w-3 h-3 flex-shrink-0 hover:text-white transition-colors" onClick={clearProject} />
                                : <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${pickerOpen ? "rotate-180" : ""}`} />
                            }
                        </button>

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
                                    ) : filteredProjects.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => selectProject(p.id, p.name)}
                                            className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/8 ${
                                                selectedProjectId === p.id ? "bg-blue-600/20 text-blue-300" : "text-slate-300"
                                            }`}
                                        >
                                            <div className="font-medium truncate">{p.name}</div>
                                            {p.client_name && <div className="text-[10px] text-slate-500 truncate mt-0.5">{p.client_name}</div>}
                                        </button>
                                    ))}
                                </div>
                                <div className="px-3 py-1.5 border-t border-white/10 text-[10px] text-slate-600">
                                    {selectedProjectId ? "Click × to deselect" : "Select to focus module links"}
                                </div>
                            </div>
                        )}
                    </div>
                    {selectedProjectId && (
                        <p className="px-3 pt-1 text-[10px] text-slate-600">Module links open this project</p>
                    )}
                </div>

                <div className="border-t border-white/5 pt-1 space-y-0.5">

                    {/* Company Profile */}
                    <SidebarSection label="Company Profile" sectionKey="company-profile" collapsed={collapsed["company-profile"] ?? true} onToggle={toggleSection}>
                        <NavItem href="/dashboard/settings/profile" icon={Building2} label="Profile" active={is("/dashboard/settings/profile")} />
                        <NavItem href="/dashboard/settings/case-studies" icon={Images} label="Case Studies" active={is("/dashboard/settings/case-studies")} />
                        <NavItem href="/dashboard/settings/integrations" icon={RefreshCw} label="Integrations" active={is("/dashboard/settings/integrations")} />
                        <NavItem href="/dashboard/settings/api-keys" icon={Key} label="API Keys" active={is("/dashboard/settings/api-keys")} />
                        <NavItem href="/dashboard/resources/staff" icon={Users} label="Labour Rates" active={is("/dashboard/resources/staff")} />
                        <NavItem href="/dashboard/resources/plant" icon={Truck} label="Plant Rates" active={is("/dashboard/resources/plant")} />
                        <NavItem href="/dashboard/library" icon={BookOpen} label="Cost Library" active={is("/dashboard/library")} />
                        <NavItem href="/onboarding?force=true" icon={Wand2} label="Setup Wizard" active={false} />
                    </SidebarSection>

                    {/* Work Winning */}
                    <SidebarSection label="Work Winning" sectionKey="work-winning" collapsed={collapsed["work-winning"] ?? true} onToggle={toggleSection}>
                        <NavItem href="/dashboard" icon={Kanban} label="Pipeline" active={pathname === "/dashboard"} />
                        <NavItem href="/dashboard/projects/quick-quote" icon={Zap} label="Quick Quote" active={pathname?.includes("/projects/quick-quote") ?? false} />
                        <NavItem href="/dashboard/projects/new" icon={FilePlus} label="New Project" active={pathname?.includes("/projects/new") ?? false} />
                    </SidebarSection>

                    {/* Pre-Construction */}
                    <SidebarSection label="Pre-Construction" sectionKey="pre-construction" collapsed={collapsed["pre-construction"] ?? true} onToggle={toggleSection}>
                        <NavItem href={pLink("/dashboard/projects/brief")} icon={ClipboardList} label="Briefs" active={is("/dashboard/projects/brief")} />
                        <NavItem href={pLink("/dashboard/projects/costs")} icon={Calculator} label="Estimates" active={is("/dashboard/projects/costs")} />
                        <NavItem href={pLink("/dashboard/projects/schedule")} icon={CalendarDays} label="Programmes" active={is("/dashboard/projects/schedule")} />
                        <NavItem href={pLink("/dashboard/projects/contracts")} icon={Scale} label="Contracts" active={is("/dashboard/projects/contracts")} />
                        <NavItem href={pLink("/dashboard/projects/proposal")} icon={FileText} label="Proposals" active={is("/dashboard/projects/proposal")} />
                    </SidebarSection>

                    {/* Live Projects */}
                    <SidebarSection label="Live Projects" sectionKey="live-projects" collapsed={collapsed["live-projects"] ?? true} onToggle={toggleSection}>
                        <NavItem href={pLink("/dashboard/projects/overview")} icon={Activity} label="Project Overview" active={is("/dashboard/projects/overview")} />
                        <NavItem href={pLink("/dashboard/projects/contract-admin")} icon={Scale} label="Contract Admin" active={is("/dashboard/projects/contract-admin")} />
                        <NavItem href={pLink("/dashboard/projects/billing")} icon={CreditCard} label="Billing & Invoicing" active={is("/dashboard/projects/billing")} />
                        <NavItem href={pLink("/dashboard/projects/variations")} icon={GitBranch} label="Variations" active={is("/dashboard/projects/variations")} />
                        <NavItem href={pLink("/dashboard/projects/p-and-l")} icon={TrendingUp} label="Job P&L" active={is("/dashboard/projects/p-and-l")} />
                        <NavItem href={pLink("/dashboard/projects/change-management")} icon={RefreshCw} label="Change Management" active={is("/dashboard/projects/change-management")} />
                        <NavItem href={pLink("/dashboard/projects/programme")} icon={CalendarDays} label="Programme" active={is("/dashboard/projects/programme")} />
                        <NavItem href={pLink("/dashboard/projects/communications")} icon={MessageSquare} label="Communications" active={is("/dashboard/projects/communications")} />
                    </SidebarSection>

                    {/* Closed Projects */}
                    <SidebarSection label="Closed Projects" sectionKey="closed-projects" collapsed={collapsed["closed-projects"] ?? true} onToggle={toggleSection}>
                        <NavItem href="/dashboard/projects/archive" icon={Archive} label="Archive" active={is("/dashboard/projects/archive")} />
                        <NavItem href={pLink("/dashboard/projects/final-account")} icon={Receipt} label="Final Accounts" active={is("/dashboard/projects/final-account")} />
                        <NavItem href={pLink("/dashboard/projects/handover-documents")} icon={FolderOpen} label="Handover Documents" active={is("/dashboard/projects/handover-documents")} />
                        <NavItem href={pLink("/dashboard/projects/lessons-learned")} icon={BookMarked} label="Lessons Learned" active={is("/dashboard/projects/lessons-learned")} />
                    </SidebarSection>

                    {/* Resources — direct links, no accordion */}
                    <div className="pt-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-3 pb-1.5">Resources</div>
                        <NavItem href="/dashboard/resources/portfolio" icon={PieChart} label="Resource Portfolio" active={is("/dashboard/resources/portfolio")} />
                        <NavItem href="/dashboard/accounting" icon={Receipt} label="Accounting" active={is("/dashboard/accounting")} />
                    </div>

                    {/* Reporting — direct links, no accordion */}
                    <div className="pt-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-3 pb-1.5">Reporting</div>
                        <NavItem href="/dashboard/reporting" icon={FileText} label="Reports & Photos" active={is("/dashboard/reporting")} />
                        <NavItem href="/dashboard/management-accounts" icon={BarChart2} label="Management Accounts" active={is("/dashboard/management-accounts")} />
                        <NavItem href="/dashboard/cis" icon={HardHat} label="CIS Compliance" active={is("/dashboard/cis")} />
                        <NavItem href="/dashboard/intelligence" icon={Lightbulb} label="Business Intelligence" active={is("/dashboard/intelligence")} />
                        <NavItem href="/dashboard/materials" icon={Package} label="Material Rates" active={is("/dashboard/materials")} />
                    </div>

                </div>
            </div>

            {/* Admin Link — only shown to platform admin */}
            {isAdmin && (
                <div className="px-4 pb-1">
                    <a
                        href="/admin"
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-900/20 hover:bg-amber-900/40 text-amber-500 hover:text-amber-400 transition-all text-xs font-medium border border-amber-800/30"
                    >
                        <span className="text-base leading-none">⚡</span>
                        <span>Admin Dashboard</span>
                    </a>
                </div>
            )}

            {/* Theme Toggle
                Sprint 58 P3.1 — the app has two themes: `system-c` (default:
                dark sidebar + white-ish content) and `dark` (full dark). There
                is no true light theme. Previously the toggle advertised
                "Light Mode" which misled the user into expecting a full white
                UI; Perplexity flagged this on the live review. The honest
                labels are "Default" ↔ "Dark" with a brief hint so users know
                what they're switching to. */}
            <div className="px-4 pb-3">
                <button
                    onClick={() => setTheme(isDark ? "system-c" : "dark")}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all text-xs font-medium"
                    title={isDark ? "Switch to the default theme (dark sidebar, lighter content)" : "Switch to the full-dark theme"}
                >
                    {isDark ? (
                        <><Sun className="w-3.5 h-3.5" /><span>Default Theme</span></>
                    ) : (
                        <><Moon className="w-3.5 h-3.5" /><span>Full Dark Theme</span></>
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
