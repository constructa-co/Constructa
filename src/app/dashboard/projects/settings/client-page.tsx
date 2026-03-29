"use client";

import { updateProjectAction } from "./actions";
import { useTransition } from "react";

// --- Inline UI Components ---
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={`rounded-xl border bg-white overflow-hidden shadow-sm ${className}`}>{children}</div>;
}
function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={`flex flex-col space-y-1.5 p-6 border-b border-slate-100 ${className}`}>{children}</div>;
}
function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
    return <h3 className={`font-semibold text-base text-slate-900 ${className}`}>{children}</h3>;
}
function CardDescription({ children, className }: { children: React.ReactNode; className?: string }) {
    return <p className={`text-sm text-slate-500 mt-0.5 ${className}`}>{children}</p>;
}
function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={`p-6 ${className}`}>{children}</div>;
}
function Label({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) {
    return <label htmlFor={htmlFor} className={`text-sm font-semibold text-slate-700 ${className}`}>{children}</label>;
}
function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            {...props}
            className={`flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 ${props.className || ""}`}
        />
    );
}
function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <textarea
            {...props}
            className={`flex min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none disabled:opacity-50 ${props.className || ""}`}
        />
    );
}
function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
    return (
        <select
            {...props}
            className={`flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 ${props.className || ""}`}
        >
            {children}
        </select>
    );
}

const PROJECT_TYPES = ["Extension", "Loft Conversion", "New Build", "Renovation", "Bathroom/Kitchen", "Roofing", "General Works", "Other"];
const PAYMENT_TERMS = ["14 days", "21 days", "28 days", "30 days", "Stage payments"];

export default function ClientProjectSettings({ project }: { project: any }) {
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (formData: FormData) => {
        startTransition(async () => {
            await updateProjectAction(formData);
        });
    };

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Project Settings</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Manage the details for {project.name}</p>
                </div>
                <div className="bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700">
                    {project.status || "Draft"}
                </div>
            </div>

            <form action={handleSubmit} className="space-y-5">
                <input type="hidden" name="projectId" value={project.id} />

                {/* 1. Project Basics */}
                <Card>
                    <CardHeader>
                        <CardTitle>Project Basics</CardTitle>
                        <CardDescription>Core project information.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="name">Project Name</Label>
                                <Input id="name" name="name" defaultValue={project.name} required />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="status">Status</Label>
                                <Select id="status" name="status" defaultValue={project.status || "Draft"}>
                                    <option value="Draft">Draft</option>
                                    <option value="Review">Under Review</option>
                                    <option value="Sent">Proposal Sent</option>
                                    <option value="Won">Won / Active</option>
                                    <option value="Lost">Lost</option>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="project_type">Project Type</Label>
                                <Select id="project_type" name="project_type" defaultValue={project.project_type || "Extension"}>
                                    {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="start_date">Target Start Date</Label>
                                <Input id="start_date" name="start_date" type="date" defaultValue={project.start_date || ""} />
                            </div>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="potential_value">Contract Value (£)</Label>
                                <Input
                                    id="potential_value"
                                    name="potential_value"
                                    type="number"
                                    min="0"
                                    step="100"
                                    defaultValue={project.potential_value || ""}
                                    placeholder="e.g. 45000"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="payment_terms">Payment Terms</Label>
                                <Select id="payment_terms" name="payment_terms" defaultValue={project.payment_terms || "21 days"}>
                                    {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Client Details */}
                <Card>
                    <CardHeader>
                        <CardTitle>Client Details</CardTitle>
                        <CardDescription>These details appear on the proposal PDF.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="client_name">Client Name</Label>
                                <Input id="client_name" name="client_name" defaultValue={project.client_name || ""} placeholder="e.g. Mr & Mrs Smith" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="client_email">Client Email</Label>
                                <Input id="client_email" name="client_email" type="email" defaultValue={project.client_email || ""} placeholder="client@example.com" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="client_phone">Client Phone</Label>
                                <Input id="client_phone" name="client_phone" type="tel" defaultValue={project.client_phone || ""} placeholder="07700 900000" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="client_address">Client Address</Label>
                            <Textarea
                                id="client_address"
                                name="client_address"
                                defaultValue={project.client_address || ""}
                                placeholder="Client billing address..."
                                rows={2}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="site_address">Site Address (if different)</Label>
                            <Textarea
                                id="site_address"
                                name="site_address"
                                defaultValue={project.site_address || ""}
                                placeholder="Works site address..."
                                rows={2}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Scope Description */}
                <Card>
                    <CardHeader>
                        <CardTitle>Scope Description</CardTitle>
                        <CardDescription>Brief executive summary (also editable in the Proposal Editor).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            name="scope"
                            placeholder="e.g. Construction of a single-storey rear extension including strip foundations..."
                            defaultValue={project.scope_description || ""}
                            rows={3}
                        />
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-3">
                    <button
                        type="submit"
                        disabled={isPending}
                        className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg disabled:opacity-60 transition-all"
                    >
                        {isPending ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </form>
        </div>
    );
}
