"use client";

import { updateDependencyAction } from "./actions";
import { useTransition, useMemo } from "react";

// --- Inline UI Components ---
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={`rounded-xl border bg-card text-card-foreground shadow-sm bg-white overflow-hidden ${className}`}>{children}</div>;
}
function CardHeader({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>;
}
function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
    return <h3 className={`font-semibold leading-none tracking-tight text-lg ${className}`}>{children}</h3>;
}
function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}
function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-slate-200 text-slate-900 ${props.className}`}
        />
    );
}

// --- LOGIC: THE CRITICAL PATH ENGINE ---
const calculateSchedule = (estimates: any[], dependencies: any[]) => {
    // 1. Map Data
    const tasks = estimates.map(e => ({
        id: e.id,
        name: e.version_name,
        duration: e.manual_duration_days || Math.ceil((e.estimate_lines.reduce((acc: number, l: any) => {
            // Simple heuristic for auto-duration
            if (l.unit?.includes('hour')) return acc + (l.quantity / 8);
            if (l.unit?.includes('day')) return acc + l.quantity;
            return acc;
        }, 0)) || 1),
        startDay: 0,
        endDay: 0,
        predecessors: dependencies.filter(d => d.successor_id === e.id)
    }));

    // 2. Forward Pass (Iterative approach to resolve chains)
    let changed = true;
    let iterations = 0;

    while (changed && iterations < 100) { // Limit to prevent infinite loops
        changed = false;
        tasks.forEach(task => {
            let maxPrevEnd = 0;

            // Find end day of all predecessors
            task.predecessors.forEach(dep => {
                const prevTask = tasks.find(t => t.id === dep.predecessor_id);
                if (prevTask) {
                    maxPrevEnd = Math.max(maxPrevEnd, prevTask.endDay + (dep.lag_days || 0));
                }
            });

            const newStart = maxPrevEnd;
            const newEnd = newStart + task.duration;

            if (task.startDay !== newStart || task.endDay !== newEnd) {
                task.startDay = newStart;
                task.endDay = newEnd;
                changed = true;
            }
        });
        iterations++;
    }

    return tasks.sort((a, b) => a.startDay - b.startDay); // Critical: Sort visuals by time
};

export default function ClientSchedulePage({ project, estimates, dependencies }: { project: any, estimates: any[], dependencies: any[] }) {
    const [isPending, startTransition] = useTransition();

    // Memoize logic
    const schedule = useMemo(() => calculateSchedule(estimates, dependencies), [estimates, dependencies]);
    const maxDay = Math.max(...schedule.map(s => s.endDay), 20);

    const handleSubmit = (formData: FormData) => {
        startTransition(async () => {
            await updateDependencyAction(formData);
        });
    };

    return (
        <div className="max-w-6xl mx-auto p-8 space-y-6">
            <h1 className="text-3xl font-bold text-slate-900">Programme: {project.name}</h1>
            <Card>
                <CardHeader><CardTitle>Task Dependencies & Critical Path</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        {schedule.map((task) => (
                            <form key={task.id} action={handleSubmit} className="grid grid-cols-12 gap-4 items-center border-b border-slate-100 pb-4 last:border-0 text-sm">
                                <input type="hidden" name="successor" value={task.id} />

                                {/* Info */}
                                <div className="col-span-3">
                                    <div className="font-bold text-slate-900">{task.name}</div>
                                    <div className="text-xs text-slate-500">Day {task.startDay} → Day {task.endDay}</div>
                                </div>

                                {/* Duration Input */}
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Duration</label>
                                    <Input name="duration" type="number" defaultValue={task.duration} className="h-8" onChange={(e) => e.target.form?.requestSubmit()} />
                                </div>

                                {/* Dependency Dropdown */}
                                <div className="col-span-3">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Start After...</label>
                                    <select name="predecessor" className="w-full h-8 text-sm border border-slate-200 rounded text-slate-700 bg-white"
                                        defaultValue={task.predecessors[0]?.predecessor_id || "none"}
                                        onChange={(e) => e.target.form?.requestSubmit()}
                                    >
                                        <option value="none">-- Start of Project --</option>
                                        {schedule.filter(t => t.id !== task.id).map(opt => (
                                            <option key={opt.id} value={opt.id}>{opt.name} (Ends Day {opt.endDay})</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Visual Bar */}
                                <div className="col-span-4 relative h-8 bg-slate-100 rounded overflow-hidden mt-4">
                                    <div
                                        className="absolute h-full bg-blue-600 rounded opacity-90 text-white text-[10px] flex items-center justify-center whitespace-nowrap transition-all duration-500"
                                        style={{
                                            left: `${(task.startDay / maxDay) * 100}%`,
                                            width: `${Math.max((task.duration / maxDay) * 100, 2)}%`
                                        }}
                                    >
                                        {task.duration}d
                                    </div>
                                </div>
                            </form>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {isPending && <div className="fixed bottom-4 right-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-pulse">Calculating Schedule...</div>}
        </div>
    );
}
