"use client";
import { useTheme } from "@/lib/theme-context";
import SidebarNav from "./sidebar-nav";

interface Project {
  id: string;
  name: string;
  client_name?: string;
}

export default function DashboardShell({
  children,
  user,
  projects,
}: {
  children: React.ReactNode;
  user: { email?: string };
  projects: Project[];
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={`min-h-screen flex overflow-hidden ${isDark ? "bg-[#0d0d0d]" : "bg-slate-50"}`}>
      <SidebarNav user={user} projects={projects} />
      <main className={`flex-1 ml-64 overflow-y-auto ${isDark ? "bg-[#0d0d0d]" : "bg-slate-50"}`}>
        <div className="min-h-screen">{children}</div>
      </main>
    </div>
  );
}
