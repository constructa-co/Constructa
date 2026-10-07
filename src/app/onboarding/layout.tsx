import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import OnboardingFrame from './onboarding-frame';

/**
 * First-time setup sits outside the dashboard shell: no sidebar, project
 * picker or module navigation until the contractor has finished it.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) redirect('/login');

    return <OnboardingFrame>{children}</OnboardingFrame>;
}
