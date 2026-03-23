export default function ProposalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Minimal layout — no Header/Footer (public acceptance page)
    return <>{children}</>;
}
