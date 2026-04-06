/**
 * Admin Layout — server-side auth guard.
 *
 * Access control:
 *  1. User must be authenticated (middleware already redirects unauthenticated users)
 *  2. User's email must match ADMIN_EMAIL environment variable
 *
 * Required env vars:
 *   ADMIN_EMAIL=your@email.com        (in .env.local + Vercel)
 *   SUPABASE_SERVICE_ROLE_KEY=...     (in .env.local + Vercel)
 */
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
    title: "Constructa Admin",
    robots: "noindex, nofollow",
};

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    // Must be logged in
    if (!user) redirect("/login");

    // Must match ADMIN_EMAIL
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || user.email !== adminEmail) {
        redirect("/dashboard");
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100">
            {/* Admin top bar */}
            <header className="border-b border-zinc-800 bg-zinc-900">
                <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-amber-500 flex items-center justify-center">
                            <span className="text-xs font-bold text-zinc-900">CA</span>
                        </div>
                        <div>
                            <h1 className="text-sm font-semibold text-zinc-100 tracking-wide">
                                Constructa Admin
                            </h1>
                            <p className="text-xs text-zinc-500">Platform management</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-zinc-500">{user.email}</span>
                        <a
                            href="/dashboard"
                            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                            ← Back to Dashboard
                        </a>
                    </div>
                </div>
            </header>

            {/* Page content */}
            <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
        </div>
    );
}
