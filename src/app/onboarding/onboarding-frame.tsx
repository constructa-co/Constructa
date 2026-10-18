import { FirstSessionFrame } from '@/components/first-session-frame';

/**
 * The plain frame around first-time setup: brand mark and sign out only.
 * No sidebar, project picker or module navigation.
 */
export default function OnboardingFrame({ children }: { children: React.ReactNode }) {
    return (
        <FirstSessionFrame signOut>{children}</FirstSessionFrame>
    );
}
