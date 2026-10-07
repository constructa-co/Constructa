import { LogOut } from 'lucide-react';

/**
 * The plain frame around first-time setup: brand mark and sign out only.
 * No sidebar, project picker or module navigation.
 */
export default function OnboardingFrame({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col">
            <header className="h-14 flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 border-b border-white/10">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-base flex-shrink-0">C</div>
                    <span className="text-lg font-bold tracking-tight truncate">Constructa</span>
                </div>
                <form action="/auth/signout" method="post">
                    <button className="h-11 px-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/10 flex items-center gap-2">
                        <LogOut className="w-4 h-4" /> Sign out
                    </button>
                </form>
            </header>
            <main className="flex-1 min-w-0">{children}</main>
        </div>
    );
}
