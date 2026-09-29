"use client";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/lib/theme-context";
import SidebarNav from "./sidebar-nav";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Project {
  id: string;
  name: string;
  client_name?: string;
}

export default function DashboardShell({
  children,
  user,
  projects,
  isAdmin = false,
}: {
  children: React.ReactNode;
  user: { email?: string };
  projects: Project[];
  isAdmin?: boolean;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 768px)");
    const closeMobileNavigation = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileNavigationOpen(false);
    };

    desktopQuery.addEventListener("change", closeMobileNavigation);
    return () => desktopQuery.removeEventListener("change", closeMobileNavigation);
  }, []);

  return (
    <div className={`flex h-dvh min-w-0 overflow-hidden ${isDark ? "bg-[#0d0d0d]" : "bg-slate-50"}`}>
      {!mobileNavigationOpen && (
        <SidebarNav user={user} projects={projects} isAdmin={isAdmin} />
      )}

      <Dialog open={mobileNavigationOpen} onOpenChange={setMobileNavigationOpen}>
        <header className="fixed inset-x-0 top-0 z-40 flex h-[calc(4rem+env(safe-area-inset-top))] items-center justify-between border-b border-white/10 bg-[#0d0d0d]/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
          <Link href="/dashboard" className="flex min-h-11 items-center gap-2.5 rounded-lg pr-3 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-base font-bold">C</span>
            <span className="text-base font-bold tracking-tight">Constructa</span>
          </Link>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={mobileNavigationOpen}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </DialogTrigger>
        </header>

        <DialogContent
          closeButtonClassName="top-[calc(0.5rem+env(safe-area-inset-top))]"
          motion="drawer-left"
          className="left-0 top-0 h-dvh w-[min(20rem,calc(100vw-2rem))] max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 bg-[#0d0d0d] p-0 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-2xl"
        >
          <DialogTitle className="sr-only">Constructa navigation</DialogTitle>
          <SidebarNav
            user={user}
            projects={projects}
            isAdmin={isAdmin}
            mode="mobile"
            onNavigate={() => setMobileNavigationOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <main className={`ml-0 min-w-0 flex-1 overflow-y-auto pt-[calc(4rem+env(safe-area-inset-top))] md:ml-64 md:pt-0 ${isDark ? "bg-[#0d0d0d]" : "bg-slate-50"}`}>
        <div className="min-h-full min-w-0">{children}</div>
      </main>
    </div>
  );
}
