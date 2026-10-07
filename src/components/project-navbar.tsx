"use client";
import Link from "next/link";
import { ClipboardList, Calculator, CalendarDays, FileText, Scale, Layers, Activity, MessageSquare } from "lucide-react";
import { isCapabilityEnabled, type LaunchCapability } from "@/lib/launch-profile";
import { useTheme } from "@/lib/theme-context";

interface Props {
  projectId: string;
  activeTab: "overview" | "brief" | "estimating" | "programme" | "contracts" | "proposal" | "drawings" | "communications";
}

const TABS = [
  { key: "overview", capability: "extended-modules", label: "Overview", icon: Activity, href: (id: string) => `/dashboard/projects/overview?projectId=${id}` },
  { key: "brief", capability: "brief", label: "Brief", icon: ClipboardList, href: (id: string) => `/dashboard/projects/brief?projectId=${id}` },
  { key: "estimating", capability: "estimating", label: "Estimating", icon: Calculator, href: (id: string) => `/dashboard/projects/costs?projectId=${id}` },
  { key: "drawings", capability: "extended-modules", label: "Drawings", icon: Layers, href: (id: string) => `/dashboard/projects/drawings?projectId=${id}` },
  { key: "programme", capability: "programme", label: "Programme", icon: CalendarDays, href: (id: string) => `/dashboard/projects/schedule?projectId=${id}` },
  { key: "contracts", capability: "extended-modules", label: "Contracts", icon: Scale, href: (id: string) => `/dashboard/projects/contracts?projectId=${id}` },
  { key: "proposal", capability: "proposal", label: "Proposal", icon: FileText, href: (id: string) => `/dashboard/projects/proposal?projectId=${id}` },
  { key: "communications", capability: "extended-modules", label: "Comms", icon: MessageSquare, href: (id: string) => `/dashboard/projects/communications?projectId=${id}` },
];

export default function ProjectNavBar({ projectId, activeTab }: Props) {
  // The tabs sit on the page background, which follows the theme.
  const isDark = useTheme().theme === "dark";
  const activeCls = isDark ? "border-blue-500 text-white" : "border-blue-600 text-gray-900";
  const idleCls = isDark
    ? "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600"
    : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-400";

  return (
    <div className={`border-b mb-6 ${isDark ? "border-slate-700/50" : "border-gray-200"}`}>
      <nav className="flex gap-0 -mb-px overflow-x-auto">
        {TABS.filter(({ capability }) => isCapabilityEnabled(capability as LaunchCapability)).map(({ key, label, icon: Icon, href }) => {
          const isActive = activeTab === key;
          return (
            <Link key={key} href={href(projectId)}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-2 min-h-11 px-4 sm:px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                isActive ? activeCls : idleCls
              }`}>
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
