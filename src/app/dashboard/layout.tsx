import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import SidebarNav from '@/components/sidebar-nav';

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

    const { data: projects } = await supabase
        .from('projects')
        .select('id, name, client_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

    return (
        <div className="min-h-screen bg-slate-50 flex overflow-hidden">
            <Suspense fallback={null}>
                <SidebarNav
                    user={{ email: user.email }}
                    projects={projects || []}
                />
            </Suspense>

            {/* Main Content */}
            <main className="flex-1 ml-64 overflow-y-auto">
                <div className="min-h-screen">
                    {children}
                </div>
            </main>
        </div>
    );
}
