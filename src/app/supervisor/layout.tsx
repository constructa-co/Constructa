export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
    // Minimal layout — no dashboard shell (public token-based page)
    return <>{children}</>;
}
