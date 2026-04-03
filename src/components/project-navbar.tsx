"use client";
import Link from "next/link";
import { ClipboardList, Calculator, CalendarDays, FileText, Scale } from "lucide-react";

interface Props {
  projectId: string;
  activeTab: "brief" | "estimating" | "programme" | "contracts" | "proposal";
}

const TABS = [
  { key: "brief",      label: "Brief",      icon: ClipboardList, href: (id: string) => `/dashboard/projects/brief?projectId=${id}` },
  { key: "estimating", label: "Estimating", icon: Calculator,    href: (id: string) => `/dashboard/projects/costs?projectId=${id}` },
  { key: "programme",  label: "Programme",  icon: CalendarDays,  href: (id: string) => `/dashboard/projects/schedule?projectId=${id}` },
  { key: "contracts",  label: "Contracts",  icon: Scale,         href: (id: string) => `/dashboard/projects/contracts?projectId=${id}` },
  { key: "proposal",   label: "Proposal",   icon: FileText,      href: (id: string) => `/dashboard/projects/proposal?projectId=${id}` },
];

export default function ProjectNavBar({ projectId, activeTab }: Props) {
  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="flex gap-0 -mb-px overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon, href }) => {
          const isActive = activeTab === key;
          return (
            <Link key={key} href={href(projectId)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
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
