import Link from "next/link";

// Inline Button Component
function Button({ children, className, variant, size }: { children: React.ReactNode; className?: string; variant?: 'default' | 'outline' | 'ghost'; size?: 'sm' | 'default' }) {
    const base = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
    const sizes = size === 'sm' ? "h-8 px-3 text-xs" : "h-10 px-4 py-2";
    const variants = {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 bg-slate-900 text-white",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground border-slate-200",
        ghost: "hover:bg-accent hover:text-accent-foreground hover:bg-slate-100"
    };
    const variantStyle = variants[variant || 'default'];

    return <button className={`${base} ${sizes} ${variantStyle} ${className}`}>{children}</button>;
}

export default function ProjectList({ projects, financials }: { projects: any[], financials: any }) {
    return (
        <div className="bg-white rounded-md border shadow-sm border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-slate-500 uppercase text-xs">
                    <tr>
                        <th className="px-4 py-3 font-medium">Project Name</th>
                        <th className="px-4 py-3 font-medium">Client</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 text-right font-medium">Value</th>
                        <th className="px-4 py-3 text-right font-medium">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {projects.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 group transition-colors">
                            <td className="px-4 py-3 font-medium">
                                <Link href={`/dashboard/projects/costs?projectId=${p.id}`} className="text-blue-600 hover:underline">
                                    {p.name}
                                </Link>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{p.client_name || '-'}</td>
                            <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border
                    ${p.status === 'Lead' ? 'bg-slate-50 text-slate-500 border-slate-200' :
                                        p.status === 'Estimating' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                            p.status === 'Proposal Sent' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                                p.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                                    'bg-zinc-50 text-zinc-600 border-zinc-200'}`}>
                                    {p.status || 'Lead'}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-700">
                                {financials[p.id] ? `£${financials[p.id].toLocaleString()}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right flex justify-end gap-2">
                                <Link href={`/dashboard/projects/costs?projectId=${p.id}`}>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500 hover:text-green-600">Cost Control</Button>
                                </Link>
                                <Link href={`/dashboard/foundations?projectId=${p.id}`}>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500 hover:text-blue-600">Estimator</Button>
                                </Link>
                            </td>
                        </tr>
                    ))}
                    {projects.length === 0 && (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-500">No projects found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
