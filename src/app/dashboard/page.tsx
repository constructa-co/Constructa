import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import ProjectBoard from "./project-board";
import ProjectList from "./project-list"; // Import the list view

export const dynamic = "force-dynamic";

// Inline Button Component (Enhanced to support variants)
function Button({ children, className, variant, size }: { children: React.ReactNode; className?: string; variant?: 'default' | 'outline' | 'ghost' | 'secondary'; size?: 'sm' | 'default' }) {
    const base = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
    const sizes = size === 'sm' ? "h-8 px-3 text-xs" : "h-10 px-4 py-2";
    const variants = {
        default: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground border-slate-200 bg-white text-slate-700",
        ghost: "hover:bg-slate-100 text-slate-600 hover:text-slate-900",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200"
    };
    const variantStyle = variants[variant || 'default'];

    return <button className={`${base} ${sizes} ${variantStyle} ${className}`}>{children}</button>;
}

export default async function Dashboard({ searchParams }: { searchParams: { view?: string } }) {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;

    // 1. Fetch Projects — scoped to user_id (projects table has no organization_id column)
    const { data: projects } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

    // 2. Fetch Financials
    const { data: allEstimates } = await supabase
        .from("estimates")
        .select("project_id, total_cost, profit_pct, overhead_pct, risk_pct")
        .in("project_id", projects?.map(p => p.id) || []);

    const financialMap: Record<string, number> = {};
    projects?.forEach(p => {
        const projEsts = allEstimates?.filter(e => e.project_id === p.id) || [];
        const total = projEsts.reduce((sum, e) => {
            const markup = 1 + ((e.profit_pct || 0) + (e.overhead_pct || 0) + (e.risk_pct || 0)) / 100;
            return sum + (e.total_cost * markup);
        }, 0);
        financialMap[p.id] = total;
    });

    const currentView = searchParams.view || 'board';

    return (
        <div className="p-8 pt-24 h-screen flex flex-col space-y-6">

            {/* HEADER & QUICK ACTIONS */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Business Command</h1>
                    <p className="text-slate-500">Welcome back, {user?.email}</p>
                </div>

                {/* GLOBAL TOOLBAR */}
                <div className="flex items-center gap-2">
                    <Link href="/dashboard/data/labor">
                        <Button variant="outline" size="sm">👤 Labour Rates</Button>
                    </Link>
                    <Link href="/dashboard/data/materials">
                        <Button variant="outline" size="sm">🧱 Materials</Button>
                    </Link>
                    <Link href="/dashboard/data/plant">
                        <Button variant="outline" size="sm">🚜 Plant</Button>
                    </Link>
                    <Link href="/dashboard/projects/new">
                        <Button className="ml-2">+ New Project</Button>
                    </Link>
                </div>
            </div>

            {/* VIEW TOGGLE */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
                <span className="text-sm font-bold text-slate-500 mr-2">VIEW:</span>
                <Link href="/dashboard?view=board">
                    <Button variant={currentView === 'board' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs">
                        Kanban Board
                    </Button>
                </Link>
                <Link href="/dashboard?view=list">
                    <Button variant={currentView === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs">
                        List Table
                    </Button>
                </Link>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-x-auto pb-4">
                {currentView === 'board' ? (
                    <ProjectBoard projects={projects || []} financials={financialMap} />
                ) : (
                    <ProjectList projects={projects || []} financials={financialMap} />
                )}
            </div>
        </div>
    );
}
