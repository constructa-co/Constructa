"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProjectFromTemplateAction } from "./actions";
import { PROJECT_TEMPLATES } from "@/lib/templates";

// --- Inline UI Components (Re-added for Client Component) ---
function Card({ children, className }: { children: React.ReactNode; className?: string }) { return <div className={`rounded-xl border bg-card text-card-foreground shadow-sm bg-white ${className}`}>{children}</div>; }
function CardHeader({ children, className }: { children: React.ReactNode, className?: string }) { return <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>{children}</div>; }
function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) { return <h3 className={`font-semibold leading-none tracking-tight text-lg text-slate-900 ${className}`}>{children}</h3>; }
function CardContent({ children, className }: { children: React.ReactNode; className?: string }) { return <div className={`p-6 pt-0 ${className}`}>{children}</div>; }
function CardDescription({ children, className }: { children: React.ReactNode; className?: string }) { return <p className={`text-sm text-muted-foreground text-slate-500 ${className}`}>{children}</p>; }
function Label({ children, className }: { children: React.ReactNode; className?: string }) { return <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 ${className}`}>{children}</label>; }
function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-slate-200 bg-white text-slate-900 ${props.className}`} />; }


export default function NewProjectPage() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (formData: FormData) => {
        setLoading(true);

        // Call Server
        const result = await createProjectFromTemplateAction(formData);

        if (result.success) {
            // Success! Redirect manually
            router.push(`/dashboard/projects/costs?projectId=${result.projectId}`);
        } else {
            // Failure! Show the exact error
            alert(result.error);
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-8 min-h-screen flex flex-col justify-center">
            <div className="mb-8 text-center pt-10">
                <h1 className="text-4xl font-bold mb-2 text-slate-900">Start a New Project</h1>
                <p className="text-slate-500">Choose a template to preload your schedule and estimate items.</p>
            </div>

            <form action={handleSubmit} className="space-y-8">
                {/* DETAILS */}
                <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                    <div className="space-y-2">
                        <Label>Project Name</Label>
                        <Input name="name" placeholder="e.g. 12 High Street Extension" required className="bg-white" />
                    </div>
                    <div className="space-y-2">
                        <Label>Client Name</Label>
                        <Input name="client" placeholder="e.g. Mr & Mrs Jones" required className="bg-white" />
                    </div>
                </div>

                {/* TYPOLOGY SELECTION */}
                <div className="grid md:grid-cols-3 gap-6">
                    {PROJECT_TEMPLATES.map(t => (
                        <label key={t.id} className="cursor-pointer group relative block">
                            <input type="radio" name="typeId" value={t.id} className="peer sr-only" defaultChecked={t.id === 'extension_1'} />
                            <Card className="h-full border-2 peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:ring-1 peer-checked:ring-blue-600 hover:border-blue-400 transition-all cursor-pointer">
                                <CardHeader>
                                    <CardTitle className="group-hover:text-blue-700">{t.name}</CardTitle>
                                    <CardDescription>{t.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
                                        {t.items.slice(0, 4).map((i, idx) => (
                                            <li key={idx}>{i.name}</li>
                                        ))}
                                        {t.items.length > 4 && <li>+ {t.items.length - 4} more stages...</li>}
                                    </ul>
                                </CardContent>
                            </Card>
                            {/* Checkmark Icon for selected state */}
                            <div className="absolute top-4 right-4 text-blue-600 opacity-0 peer-checked:opacity-100 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </label>
                    ))}
                </div>

                <div className="text-center pb-10">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-64 bg-blue-700 hover:bg-blue-800 text-white rounded-md h-12 text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        {loading ? "Creating..." : "Create Project 🚀"}
                    </button>
                </div>
            </form>
        </div>
    );
}
