import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ThemeProvider } from '@/lib/theme-context';
import DashboardShell from '@/components/dashboard-shell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect('/login');

    const [{ data: projects }, { data: profile }] = await Promise.all([
        supabase.from('projects').select('id, name, client_name').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('profiles').select('company_name, theme_preference').eq('id', user.id).single(),
    ]);

    const initialTheme = profile?.theme_preference || 'system-c';

    return (
        <ThemeProvider initialTheme={initialTheme}>
            <DashboardShell user={{ email: user.email }} projects={projects || []}>
                {children}
            </DashboardShell>
        </ThemeProvider>
    );
}
