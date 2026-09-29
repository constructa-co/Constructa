"use client";
import Link from "next/link";
import { ClipboardList, Calculator, CalendarDays, FileText, Scale, Layers, Activity, MessageSquare } from "lucide-react";
import { isCapabilityEnabled, type LaunchCapability } from "@/lib/launch-profile";

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
  return (
    <div className="mb-6 min-w-0 border-b border-slate-700/50">
      <nav aria-label="Project workflow" className="-mb-px flex max-w-full snap-x snap-mandatory gap-0 overflow-x-auto overscroll-x-contain">
        {TABS.filter(({ capability }) => isCapabilityEnabled(capability as LaunchCapability)).map(({ key, label, icon: Icon, href }) => {
          const isActive = activeTab === key;
          return (
            <Link key={key} href={href(projectId)}
              className={`flex min-h-11 snap-start items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:px-5 ${
                isActive
                  ? "border-blue-500 text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600"
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
