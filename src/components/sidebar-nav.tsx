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
    HardHat,
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
    Eye,
    BarChart3,
    RefreshCw,
    FileCheck,
    FolderOpen,
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
            <div className="flex items-center gap-3 px-3 py-2 rounded-md opacity-30 cursor-not-allowed">
                <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                    <span className="text-sm text-slate-400 font-medium block truncate">{label}</span>
                </div>
                {badge && (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-white/5 px-1.5 py-0.5 rounded flex-shrink-0">
                        {badge}
                    </span>
                )}
            </div>
        );
    }

    return (
        <Link
            href={href}
            className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-all group ${
                active
                    ? "bg-white/10 text-white"
                    : "text-slate-300 hover:text-white hover:bg-white/8"
            }`}
        >
            <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${active ? "text-blue-400" : "text-slate-400 group-hover:text-slate-200"}`} />
            <div className="min-w-0 flex-1">
                <span className="text-sm truncate block">{label}</span>
                {sublabel && (
                    <span className="text-[10px] text-slate-500 truncate block">{sublabel}</span>
                )}
            </div>
            {badge && (
                <span className={`ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${
                    active ? "text-blue-300 bg-blue-500/20" : "text-slate-500 bg-white/5"
                }`}>
                    {badge}
                </span>
            )}
        </Link>
    );
}

function SectionLabel({ label }: { label: string }) {
    return (
        <div className="px-3 pt-5 pb-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {label}
        </div>
    );
}

export default function SidebarNav({ user }: SidebarNavProps) {
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const isDark = theme === "dark";

    const is = (path: string) => pathname === path || pathname.startsWith(path + "/") || pathname.startsWith(path + "?");

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
                    <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard (CRM)" active={pathname === "/dashboard"} />
                    <NavItem href="/dashboard/projects/new" icon={FilePlus} label="New Project" active={pathname.includes("/projects/new")} />
                </div>

                {/* Pre-Construction */}
                <SectionLabel label="Pre-Construction" />
                <div className="space-y-0.5">
                    <NavItem href="/dashboard/projects/brief" icon={ClipboardList} label="Brief" active={is("/dashboard/projects/brief")} />
                    <NavItem href="/dashboard/projects/costs" icon={Calculator} label="Estimating" active={is("/dashboard/projects/costs")} />
                    <NavItem href="/dashboard/projects/schedule" icon={CalendarDays} label="Programme" active={is("/dashboard/projects/schedule")} />
                    <NavItem href="/dashboard/projects/contracts" icon={Scale} label="Contracts" active={is("/dashboard/projects/contracts")} />
                    <NavItem href="/dashboard/projects/proposal" icon={FileText} label="Proposal" active={is("/dashboard/projects/proposal")} />
                    <div className="my-2 border-t border-white/10" />
                    <NavItem href="/dashboard/library" icon={BookOpen} label="Cost Library" active={is("/dashboard/library")} />
                    <NavItem href="/dashboard/resources" icon={Wrench} label="Resources" active={is("/dashboard/resources")} />
                </div>

                {/* Live Projects */}
                <SectionLabel label="Live Projects" />
                <div className="space-y-0.5">
                    <NavItem href="/dashboard/live" icon={Eye} label="Overview" active={is("/dashboard/live")} />
                    <NavItem href="#" icon={BarChart3} label="Finance" disabled badge="Soon" />
                    <NavItem href="#" icon={CalendarDays} label="Programme" disabled badge="Soon" />
                    <NavItem href="#" icon={RefreshCw} label="Change Mgmt" disabled badge="Soon" />
                    <NavItem href="#" icon={CreditCard} label="Billing" disabled badge="Soon" />
                    <NavItem href="#" icon={GitBranch} label="Variations" disabled badge="Soon" />
                </div>

                {/* Post-Construction */}
                <SectionLabel label="Post-Construction" />
                <div className="space-y-0.5">
                    <NavItem href="#" icon={FileCheck} label="Close-Out" disabled badge="Soon" />
                    <NavItem href="#" icon={Archive} label="Final Account" disabled badge="Soon" />
                    <NavItem href="#" icon={FolderOpen} label="Handover Docs" disabled badge="Soon" />
                    <NavItem href="#" icon={HardHat} label="Records" disabled badge="Soon" />
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
