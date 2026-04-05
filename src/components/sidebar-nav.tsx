"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { useTheme } from "@/lib/theme-context";

interface SidebarNavProps {
    user: { email?: string };
    projects: any[];
}

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

function SectionLabel({ label }: { label: string }) {
    return (
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-3 py-2">
            {label}
        </div>
    );
}

export default function SidebarNav({ user }: SidebarNavProps) {
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark";

    const is = (path: string) => pathname != null && (pathname === path || pathname.startsWith(path + "/") || pathname.startsWith(path + "?"));

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

            {/* Nav */}
            <div className="flex-1 overflow-y-auto px-3 pb-4">

                {/* Overview — top-level, above all sections */}
                <div className="pt-1 pb-1">
                    <NavItem href="/dashboard/home" icon={LayoutDashboard} label="Overview" active={is("/dashboard/home")} />
                </div>

                {/* Company Profile */}
                <SectionLabel label="Company Profile" />
                <div className="space-y-0.5">
                    <NavItem href="/dashboard/settings/profile" icon={Building2} label="Profile" active={is("/dashboard/settings/profile")} />
                    <NavItem href="/dashboard/settings/case-studies" icon={Images} label="Case Studies" active={is("/dashboard/settings/case-studies")} />
                    <NavItem href="/onboarding?force=true" icon={Wand2} label="Setup Wizard" active={false} />
                </div>

                {/* Work Winning */}
                <SectionLabel label="Work Winning" />
                <div className="space-y-0.5">
                    <NavItem href="/dashboard" icon={Kanban} label="Pipeline" active={pathname === "/dashboard"} />
                    <NavItem href="/dashboard/projects/new" icon={FilePlus} label="New Project" active={pathname?.includes("/projects/new") ?? false} />
                    <hr className="my-2 border-white/10" />
                    <NavItem href="/dashboard/library" icon={BookOpen} label="Cost Library" active={is("/dashboard/library")} />
                    <NavItem href="/dashboard/resources" icon={Wrench} label="Resources" active={is("/dashboard/resources")} />
                </div>

                {/* Pre-Construction */}
                <SectionLabel label="Pre-Construction" />
                <div className="space-y-0.5">
                    <NavItem href="/dashboard/projects/brief" icon={ClipboardList} label="Briefs" active={is("/dashboard/projects/brief")} />
                    <NavItem href="/dashboard/projects/costs" icon={Calculator} label="Estimates" active={is("/dashboard/projects/costs")} />
                    <NavItem href="/dashboard/projects/schedule" icon={CalendarDays} label="Programmes" active={is("/dashboard/projects/schedule")} />
                    <NavItem href="/dashboard/projects/contracts" icon={Scale} label="Contracts" active={is("/dashboard/projects/contracts")} />
                    <NavItem href="/dashboard/projects/proposal" icon={FileText} label="Proposals" active={is("/dashboard/projects/proposal")} />
                </div>

                {/* Live Projects */}
                <SectionLabel label="Live Projects" />
                <div className="space-y-0.5">
                    <NavItem href="/dashboard/live" icon={LayoutDashboard} label="Overview" active={is("/dashboard/live")} />
                    <NavItem href="/dashboard/projects/billing" icon={CreditCard} label="Billing & Invoicing" active={is("/dashboard/projects/billing")} />
                    <NavItem href="/dashboard/projects/variations" icon={GitBranch} label="Variations" active={is("/dashboard/projects/variations")} />
                    <NavItem href="/dashboard/projects/p-and-l" icon={TrendingUp} label="Job P&L" active={is("/dashboard/projects/p-and-l")} />
                    <NavItem href="#" icon={RefreshCw} label="Change Management" disabled />
                    <NavItem href="#" icon={CalendarDays} label="Programme" disabled />
                    <NavItem href="#" icon={MessageSquare} label="Communications" disabled />
                </div>

                {/* Closed Projects */}
                <SectionLabel label="Closed Projects" />
                <div className="space-y-0.5">
                    <NavItem href="#" icon={Archive} label="Archive" disabled />
                    <NavItem href="#" icon={Receipt} label="Final Accounts" disabled />
                    <NavItem href="#" icon={FolderOpen} label="Handover Documents" disabled />
                    <NavItem href="#" icon={BookMarked} label="Lessons Learned" disabled />
                </div>

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
