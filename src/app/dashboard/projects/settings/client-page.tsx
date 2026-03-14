"use client";

import { updateProjectAction } from "./actions";
import { useTransition } from "react";

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
function CardDescription({ children, className }: { children: React.ReactNode; className?: string }) {
    return <p className={`text-sm text-muted-foreground text-gray-500 mt-1 ${className}`}>{children}</p>;
}
function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
    return <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 ${className}`}>{children}</label>;
}
function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-slate-200 text-slate-900"
        />
    );
}
function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <textarea
            {...props}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-slate-200 text-slate-900"
        />
    );
}
function Button({ children, type = "button", disabled, className, variant, onClick }: { children: React.ReactNode; type?: "button" | "submit"; disabled?: boolean; className?: string; variant?: 'default' | 'outline' | 'ghost'; onClick?: () => void }) {
    const base = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2";
    const styles = variant === 'outline' ? "border border-input bg-background hover:bg-accent hover:text-accent-foreground text-slate-700" : "bg-primary text-primary-foreground hover:bg-primary/90 bg-slate-900 text-white";
    return <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${styles} ${className}`}>{children}</button>;
}

export default function ClientProjectSettings({ project }: { project: any }) {
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (formData: FormData) => {
        startTransition(async () => {
            await updateProjectAction(formData);
        });
    };

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Project Settings</h1>
                    <p className="text-slate-500">Manage the details for {project.name}</p>
                </div>
                <div className="bg-slate-100 px-3 py-1 rounded text-sm font-medium text-slate-700">Status: {project.status || 'Draft'}</div>
            </div>

            <form action={handleSubmit} className="space-y-6">
                <input type="hidden" name="projectId" value={project.id} />

                {/* 1. General Info */}
                <Card>
                    <CardHeader><CardTitle>Project Basics</CardTitle></CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <Label>Project Internal Name</Label>
                            <Input name="name" defaultValue={project.name} required />
                        </div>
                        <div className="grid gap-2">
                            <Label>Status</Label>
                            <select name="status" defaultValue={project.status || 'Draft'} className="flex h-10 w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-slate-900 outline-none">
                                <option value="Draft">Draft</option>
                                <option value="Review">Under Review</option>
                                <option value="Sent">Proposal Sent</option>
                                <option value="Won">Won / Active</option>
                                <option value="Lost">Lost</option>
                            </select>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Client & Site (The CRM Layer) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Client & Site Details</CardTitle>
                        <CardDescription>These details will appear on the PDF Proposal.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Client Name</Label>
                                <Input name="client_name" defaultValue={project.client_name || ''} placeholder="e.g. Mr & Mrs Smith" />
                            </div>
                            <div className="space-y-2">
                                <Label>Target Start Date</Label>
                                <Input name="start_date" type="date" defaultValue={project.start_date || ''} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Client Billing Address</Label>
                            <Input name="client_address" defaultValue={project.client_address || ''} placeholder="e.g. 123 High St, London" />
                        </div>
                        <div className="space-y-2">
                            <Label>Site Address (If different)</Label>
                            <Input name="site_address" defaultValue={project.site_address || ''} placeholder="e.g. Plot 4, Green Estate..." />
                        </div>
                    </CardContent>
                </Card>

                {/* 3. The Narrative (Scope) */}
                <Card>
                    <CardHeader>
                        <CardTitle>Scope of Works</CardTitle>
                        <CardDescription>The "Executive Summary" for the proposal introduction.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            name="scope"
                            placeholder="e.g. Construction of a single-storey rear extension including strip foundations, brickwork to match existing..."
                            defaultValue={project.scope_description || ''}
                        />
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-4">
                    {/* Note: In a real app we might use a Link or router.back() via a wrapper, but simple hydration safe div here */}
                    <Button type="submit" disabled={isPending}>
                        {isPending ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
