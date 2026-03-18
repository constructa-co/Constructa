import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import {
    LayoutDashboard,
    Calculator,
    Database,
    Library,
    Settings,
    LogOut,
    Briefcase,
    ChevronRight,
    Search
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    if (!user) {
        redirect('/login');
    }

    let projects: any[] = [];
    if (user) {
        const { data } = await supabase
            .from('projects')
            .select('id, name')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        projects = data || [];
    }

    const navItems = [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Estimator', href: '/dashboard/foundations', icon: Calculator },
        { label: 'Library', href: '/dashboard/library', icon: Library },
        { label: 'Resources', href: '/dashboard/resources', icon: Database },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 border-r border-slate-200 bg-white hidden md:flex flex-col h-screen fixed">
                <div className="p-6">
                    <Link href="/dashboard" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl group-hover:bg-blue-700 transition-colors">
                            C
                        </div>
                        <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                            Constructa
                        </span>
                    </Link>
                </div>

                <div className="px-4 mb-4">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-md text-slate-500 text-sm border border-slate-200">
                        <Search className="w-4 h-4" />
                        <span className="opacity-60">Search...</span>
                    </div>
                </div>

                <ScrollArea className="flex-1 px-3">
                    <div className="space-y-1 py-2">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium transition-all group"
                            >
                                <item.icon className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                                {item.label}
                            </Link>
                        ))}
                    </div>

                    <Separator className="my-4 opacity-50" />

                    <div className="py-2">
                        <div className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex justify-between items-center">
                            <span>Projects</span>
                            <Link href="/dashboard/projects/settings" className="hover:text-slate-900 transition-colors">
                                <Settings className="w-3 h-3" />
                            </Link>
                        </div>

                        <div className="space-y-1">
                            {projects.length > 0 ? (
                                projects.map((p: any) => (
                                    <Link
                                        key={p.id}
                                        href={`/dashboard/projects/costs?projectId=${p.id}`}
                                        className="flex items-center justify-between group px-3 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-all"
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <Briefcase className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                                            <span className="truncate">{p.name}</span>
                                        </div>
                                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </Link>
                                ))
                            ) : (
                                <div className="px-3 py-2 text-xs text-slate-400 italic font-medium">
                                    No active projects
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                <div className="p-4 mt-auto border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white transition-colors border border-transparent hover:border-slate-200 group">
                        <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm">
                            {user.email?.[0].toUpperCase()}
                        </div>
                        <div className="overflow-hidden flex-1">
                            <div className="text-sm font-semibold text-slate-900 truncate">{user.email?.split('@')[0]}</div>
                            <form action="/auth/signout" method="post">
                                <button className="text-[11px] text-slate-500 hover:text-red-500 transition-colors font-medium flex items-center gap-1">
                                    <LogOut className="w-3 h-3" />
                                    Sign out
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 overflow-y-auto">
                <div className="min-h-screen">
                    {children}
                </div>
            </main>
        </div>
    );
}
