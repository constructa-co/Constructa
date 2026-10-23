"use client";

import { updateProjectAction, updateProjectStatusAction } from "./actions";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useTheme } from "@/lib/theme-context";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import { BEFORE_PROJECT_NAVIGATION } from "@/lib/project-navigation";
import { SETTINGS_LEAVE_WARNING, settingsFormSignature } from "./form-state";
import { JOB_TYPE_EXAMPLES } from "@/lib/job-type-options";
import { getPrecontractEditLockReason } from "@/lib/project-editability";

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
            className={`flex h-12 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 ${props.className || ""}`}
        />
    );
}
function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <textarea
            {...props}
            className={`flex min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none disabled:opacity-50 ${props.className || ""}`}
        />
    );
}
function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
    return (
        <select
            {...props}
            className={`flex h-12 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 ${props.className || ""}`}
        >
            {children}
        </select>
    );
}

const PAYMENT_TERMS = ["14 days", "21 days", "28 days", "30 days", "Stage payments"];

export default function ClientProjectSettings({ project }: { project: any }) {
    const [isPending, startTransition] = useTransition();
    const [dirty, setDirty] = useState(false);
    const [feedback, setFeedback] = useState<"idle" | "saved" | "error">("idle");
    const [statusDirty, setStatusDirty] = useState(false);
    const [statusFeedback, setStatusFeedback] = useState<"idle" | "saved" | "error">("idle");
    const [pendingIntent, setPendingIntent] = useState<"details" | "status" | null>(null);
    const [serverLock, setServerLock] = useState<{ of: object; message: string } | null>(null);
    const formRef = useRef<HTMLFormElement | null>(null);
    const confirmedSignature = useRef<string | null>(null);
    const statusFormRef = useRef<HTMLFormElement | null>(null);
    const confirmedStatusSignature = useRef<string | null>(null);
    const lockReason = getPrecontractEditLockReason(project) ?? (serverLock && serverLock.of === project ? serverLock.message : null);
    const lockRef = useRef(lockReason);
    const projectRef = useRef(project.id);
    const pendingRef = useRef(false);
    const aliveRef = useRef(true);
    useLayoutEffect(() => {
        lockRef.current = lockReason;
        projectRef.current = project.id;
    }, [lockReason, project.id]);
    useEffect(() => {
        aliveRef.current = true;
        return () => { aliveRef.current = false; };
    }, []);
    const mustWarn = dirty || statusDirty || isPending;
    useUnsavedGuard(mustWarn, SETTINGS_LEAVE_WARNING);
    useEffect(() => {
        if (!mustWarn) return;
        const confirmProjectChange = (event: Event) => {
            if (!window.confirm(SETTINGS_LEAVE_WARNING)) event.preventDefault();
        };
        window.addEventListener(BEFORE_PROJECT_NAVIGATION, confirmProjectChange);
        return () => window.removeEventListener(BEFORE_PROJECT_NAVIGATION, confirmProjectChange);
    }, [mustWarn]);
    const { theme } = useTheme();
    const isDark = theme === "dark";

    const handleSubmit = (formData: FormData) => {
        if (!aliveRef.current || pendingRef.current || lockRef.current || projectRef.current !== project.id) return;
        pendingRef.current = true;
        setPendingIntent("details");
        const submittedSignature = settingsFormSignature(formData);
        setFeedback("idle");
        startTransition(async () => {
            try {
                const result = await updateProjectAction(formData);
                if (!aliveRef.current || projectRef.current !== project.id) return;
                if (!result.success) {
                    if ("lockReason" in result && result.lockReason) {
                        lockRef.current = result.lockReason;
                        setServerLock({ of: project, message: result.lockReason });
                    }
                    setFeedback("error");
                    return;
                }
                if (lockRef.current) {
                    setFeedback("error");
                    return;
                }
                if (formRef.current) {
                    confirmedSignature.current = submittedSignature;
                    setDirty(settingsFormSignature(new FormData(formRef.current)) !== submittedSignature);
                }
                setFeedback("saved");
            } catch {
                if (aliveRef.current) setFeedback("error");
            } finally {
                pendingRef.current = false;
                if (aliveRef.current) setPendingIntent(null);
            }
        });
    };
    const handleStatusSubmit = (formData: FormData) => {
        if (!aliveRef.current || pendingRef.current || projectRef.current !== project.id) return;
        pendingRef.current = true;
        setPendingIntent("status");
        const submittedSignature = settingsFormSignature(formData);
        setStatusFeedback("idle");
        startTransition(async () => {
            try {
                const result = await updateProjectStatusAction(formData);
                if (!aliveRef.current || projectRef.current !== project.id) return;
                if (!result.success) { setStatusFeedback("error"); return; }
                if (statusFormRef.current) {
                    confirmedStatusSignature.current = submittedSignature;
                    setStatusDirty(settingsFormSignature(new FormData(statusFormRef.current)) !== submittedSignature);
                }
                setStatusFeedback("saved");
            } catch {
                if (aliveRef.current) setStatusFeedback("error");
            } finally {
                pendingRef.current = false;
                if (aliveRef.current) setPendingIntent(null);
            }
        });
    };
    const statusText = isPending && pendingIntent === "details" ? "Saving..." : feedback === "saved"
        ? dirty ? "Submitted changes saved. Newer edits are still unsaved." : "Saved"
        : dirty ? "Unsaved changes" : "";

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className={`text-2xl font-bold tracking-tight ${isDark ? "text-slate-100" : "text-slate-900"}`}>Project Settings</h1>
                    <p className={`text-sm mt-0.5 ${isDark ? "text-slate-300" : "text-slate-600"}`}>Manage the details for {project.name}</p>
                </div>
                <div className="bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-700">
                    {project.status || "Draft"}
                </div>
            </div>

            <form
                ref={form => {
                    formRef.current = form;
                    if (form && confirmedSignature.current === null) confirmedSignature.current = settingsFormSignature(new FormData(form));
                }}
                onChange={event => {
                    if (aliveRef.current && !lockRef.current) setDirty(settingsFormSignature(new FormData(event.currentTarget)) !== confirmedSignature.current);
                }}
                onSubmit={event => {
                    // A returned action failure must not reset uncontrolled inputs.
                    event.preventDefault();
                    handleSubmit(new FormData(event.currentTarget));
                }}
                className="space-y-5"
                aria-label="Job details"
            >
                <input type="hidden" name="projectId" value={project.id} />
                {lockReason && <p role="status" className={`text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`} data-settings-lock>{lockReason} Your current text remains here. Status changes can be saved separately below.</p>}
                <fieldset disabled={!!lockReason} className="min-w-0 space-y-5 border-0 p-0">

                {/* 1. Project Basics */}
                <Card>
                    <CardHeader>
                        <CardTitle>Project Basics</CardTitle>
                        <CardDescription>Core project information.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5">
                        <div className="grid lg:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="name">Project Name</Label>
                                <Input id="name" name="name" defaultValue={project.name} required />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="project_type">Project Type</Label>
                                {/[\r\n]/.test(project.project_type || "") ? (
                                    // A text input strips line endings, so retain the legacy select for these saved values.
                                    <Select id="project_type" name="project_type" defaultValue={project.project_type}>
                                        <option value={project.project_type}>{project.project_type}</option>
                                        {JOB_TYPE_EXAMPLES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </Select>
                                ) : (
                                    <Input id="project_type" name="project_type" type="text" list="settings-job-type-examples" defaultValue={project.project_type || "Extension"} />
                                )}
                                <datalist id="settings-job-type-examples">
                                    {JOB_TYPE_EXAMPLES.map(t => <option key={t} value={t} />)}
                                </datalist>
                                <p className="text-sm text-slate-500">{/[\r\n]/.test(project.project_type || "")
                                    ? "This saved multi-line type is retained. Choose an example to replace it."
                                    : "Write your own type of job, or choose an example."}</p>
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

                        {/* P1-1 — VAT Domestic Reverse Charge toggle (HMRC VAT Notice 735). */}
                        <div className="mt-5 p-4 rounded-lg border border-slate-200 bg-slate-50">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="is_vat_reverse_charge"
                                    defaultChecked={project.is_vat_reverse_charge === true}
                                    className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-2 focus:ring-blue-600"
                                />
                                <div className="flex-1">
                                    <div className="text-sm font-medium text-slate-900">
                                        VAT Domestic Reverse Charge applies
                                    </div>
                                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                        Turn this on if both you and your client are CIS-registered and these services are within the scope of CIS.
                                        Under HMRC VAT Notice 735 (effective 1 March 2021), VAT is not charged on the invoice — your customer
                                        accounts for it on their own return. Leave off for domestic end-user clients.
                                    </p>
                                </div>
                            </label>
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
                        <CardTitle><label htmlFor="project-scope">Scope Description</label></CardTitle>
                        <CardDescription>Brief executive summary (also editable in the Proposal Editor).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            id="project-scope"
                            name="scope"
                            placeholder="e.g. Construction of a single-storey rear extension including strip foundations..."
                            defaultValue={project.scope_description || ""}
                            rows={3}
                        />
                    </CardContent>
                </Card>

                </fieldset>
                {feedback === "error" ? (
                    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        Saving could not be confirmed. Your edits are still here. Try again.
                    </p>
                ) : statusText && (
                    <p role="status" className={`text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>{statusText}</p>
                )}
                <div className="flex justify-end gap-3">
                    <button
                        type="submit"
                        disabled={isPending || !!lockReason}
                        className="min-h-12 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-base font-bold rounded-lg disabled:opacity-60 transition-all"
                    >
                        {isPending && pendingIntent === "details" ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </form>
            <form
                aria-label="Project status"
                ref={form => {
                    statusFormRef.current = form;
                    if (form && confirmedStatusSignature.current === null) confirmedStatusSignature.current = settingsFormSignature(new FormData(form));
                }}
                onChange={event => {
                    if (aliveRef.current) setStatusDirty(settingsFormSignature(new FormData(event.currentTarget)) !== confirmedStatusSignature.current);
                }}
                onSubmit={event => {
                    event.preventDefault();
                    handleStatusSubmit(new FormData(event.currentTarget));
                }}
                className="space-y-5"
            >
                <input type="hidden" name="projectId" value={project.id} />
                <Card>
                    <CardHeader>
                        <CardTitle>Project Status</CardTitle>
                        <CardDescription>Save the status separately. This does not save any changes to the job details above.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Label htmlFor="status">Status</Label>
                        <Select id="status" name="status" defaultValue={project.status || "Draft"}>
                            {project.status && !["Draft", "Review", "Sent", "Won", "Lost"].includes(project.status) && (
                                <option value={project.status}>{project.status}</option>
                            )}
                            <option value="Draft">Draft</option>
                            <option value="Review">Under Review</option>
                            <option value="Sent">Proposal Sent</option>
                            <option value="Won">Won / Active</option>
                            <option value="Lost">Lost</option>
                        </Select>
                    </CardContent>
                </Card>
                {statusFeedback === "error" ? (
                    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">The status save could not be confirmed. Your selection is still here.</p>
                ) : (statusDirty || statusFeedback === "saved" || isPending && pendingIntent === "status") && (
                    <p role="status" className={`text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                        {isPending && pendingIntent === "status" ? "Saving status..." : statusFeedback === "saved"
                            ? statusDirty ? "Submitted status saved. Newer selection is still unsaved." : "Status saved"
                            : "Unsaved status change"}
                    </p>
                )}
                <div className="flex justify-end">
                    <button type="submit" disabled={isPending} className="min-h-12 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-base font-bold rounded-lg disabled:opacity-60 transition-all">
                        {isPending && pendingIntent === "status" ? "Saving status..." : "Save Status"}
                    </button>
                </div>
            </form>
        </div>
    );
}
