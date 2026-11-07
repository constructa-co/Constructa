"use client";
import Link from "next/link";
import { ClipboardList, Calculator, CalendarDays, FileText, Scale, Layers, Activity, MessageSquare } from "lucide-react";
import { isCapabilityEnabled, type LaunchCapability } from "@/lib/launch-profile";
import { useTheme } from "@/lib/theme-context";
import { JOB_WORKFLOW } from "@/lib/job-workflow";

interface Props {
  projectId: string;
  projectName?: string;
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

export default function ProjectNavBar({ projectId, projectName, activeTab }: Props) {
  // The tabs sit on the page background, which follows the theme.
  const isDark = useTheme().theme === "dark";
  if (!isCapabilityEnabled("extended-modules")) {
    const current = JOB_WORKFLOW.find(step => step.key === activeTab);
    return (
      <nav aria-label="Job context" data-route-job-header className={`mb-5 border-b pb-3 text-sm ${isDark ? "border-white/10 text-slate-400" : "border-gray-200 text-gray-600"}`}>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <li>
            <Link href="/dashboard" className={`inline-flex min-h-11 items-center rounded-md px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${isDark ? "text-[#c9efcf] hover:text-[#e0f9e3] focus-visible:outline-[#c9efcf]" : "text-emerald-800 hover:text-emerald-950 focus-visible:outline-emerald-700"}`}>Pipeline</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="min-w-0 max-w-full break-words">{projectName || "Current job"}</li>
          {current && <>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className={`font-semibold ${isDark ? "text-slate-100" : "text-gray-900"}`}>{current.label}</li>
          </>}
        </ol>
      </nav>
    );
  }
  const activeCls = isDark ? "border-[#c9efcf] text-white" : "border-emerald-700 text-gray-900";
  // Same brand focus outline as the cohort breadcrumb link above.
  const focusCls = isDark
    ? "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9efcf]"
    : "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";
  const idleCls = isDark
    ? "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600"
    : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-400";

  return (
    <div data-route-job-header className={`border-b mb-6 ${isDark ? "border-slate-700/50" : "border-gray-200"}`}>
      <nav className="flex gap-0 -mb-px overflow-x-auto" onFocusCapture={(event) => {
        const link = event.target;
        if (!(link instanceof HTMLAnchorElement)) return;
        const nav = event.currentTarget;
        const bounds = nav.getBoundingClientRect();
        const focused = link.getBoundingClientRect();
        // Reveal the focused tab without scrolling the page vertically.
        if (focused.left < bounds.left) nav.scrollLeft += focused.left - bounds.left;
        else if (focused.right > bounds.right) nav.scrollLeft += focused.right - bounds.right;
      }}>
        {TABS.filter(({ capability }) => isCapabilityEnabled(capability as LaunchCapability)).map(({ key, label, icon: Icon, href }) => {
          const isActive = activeTab === key;
          return (
            <Link key={key} href={href(projectId)}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-2 min-h-11 px-4 sm:px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${focusCls} ${
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
