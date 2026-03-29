"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProjectFromTemplateAction } from "./actions";
import { PROJECT_TEMPLATES } from "@/lib/templates";
import { getProjectTypes } from "@/lib/project-types";
import PostcodeLookup from "@/components/postcode-lookup";

function StepIndicator({ current, total }: { current: number; total: number }) {
    return (
        <div className="flex items-center justify-center gap-3 mb-8">
            {Array.from({ length: total }, (_, i) => {
                const step = i + 1;
                const isActive = step === current;
                const isDone = step < current;
                return (
                    <div key={step} className="flex items-center gap-3">
                        <div className={`flex items-center gap-2`}>
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                                    isActive
                                        ? "bg-slate-900 text-white"
                                        : isDone
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-100 text-slate-400"
                                }`}
                            >
                                {isDone ? (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    step
                                )}
                            </div>
                            <span
                                className={`text-sm font-semibold hidden sm:block ${
                                    isActive ? "text-slate-900" : isDone ? "text-blue-600" : "text-slate-400"
                                }`}
                            >
                                {step === 1 ? "Project Details" : step === 2 ? "Choose Template" : "Review & Create"}
                            </span>
                        </div>
                        {step < total && (
                            <div className={`w-12 h-0.5 ${isDone ? "bg-blue-600" : "bg-slate-200"}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

interface FormState {
    name: string;
    client: string;
    clientEmail: string;
    clientPhone: string;
    clientAddress: string;
    siteAddress: string;
    projectType: string;
    startDate: string;
    potentialValue: string;
    typeId: string;
}

interface Props {
    businessType: string | null;
}

export default function NewProjectWizard({ businessType }: Props) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const projectTypes = getProjectTypes(businessType);

    const [form, setForm] = useState<FormState>({
        name: "",
        client: "",
        clientEmail: "",
        clientPhone: "",
        clientAddress: "",
        siteAddress: "",
        projectType: projectTypes[0],
        startDate: "",
        potentialValue: "",
        typeId: "extension_1",
    });

    const set = (field: keyof FormState, value: string) =>
        setForm((prev) => ({ ...prev, [field]: value }));

    // Filter templates to match selected project type
    const filteredTemplates = PROJECT_TEMPLATES.filter(t =>
        t.projectTypes.length === 0 || // blank always shows
        t.projectTypes.includes(form.projectType) ||
        (businessType && t.projectTypes.includes(businessType))
    );
    const templatesToShow = filteredTemplates.length > 1 ? filteredTemplates : PROJECT_TEMPLATES;
    const showNoMatchNote = filteredTemplates.length <= 1 && PROJECT_TEMPLATES.length > 1;

    const selectedTemplate = PROJECT_TEMPLATES.find((t) => t.id === form.typeId);

    const handleCreate = async () => {
        setLoading(true);
        const fd = new FormData();
        fd.set("name", form.name);
        fd.set("client", form.client);
        fd.set("clientEmail", form.clientEmail);
        fd.set("clientPhone", form.clientPhone);
        fd.set("clientAddress", form.clientAddress);
        fd.set("siteAddress", form.siteAddress);
        fd.set("projectType", form.projectType);
        fd.set("startDate", form.startDate);
        fd.set("potentialValue", form.potentialValue);
        fd.set("typeId", form.typeId);

        const result = await createProjectFromTemplateAction(fd);

        if (result.success) {
            router.push(`/dashboard/projects/proposal?projectId=${result.projectId}`);
        } else {
            alert(result.error);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-3xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">New Project</h1>
                    <p className="text-slate-500">Complete the details below to create your project and proposal.</p>
                </div>

                <StepIndicator current={step} total={3} />

                {/* ── STEP 1: Project Details ── */}
                {step === 1 && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 space-y-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Project Details</h2>
                            <p className="text-sm text-slate-500 mt-1">Tell us about the project and client.</p>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Project Name <span className="text-red-500">*</span></label>
                                <input
                                    value={form.name}
                                    onChange={(e) => set("name", e.target.value)}
                                    placeholder="e.g. 14 Oak Road — Rear Extension"
                                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Client Name <span className="text-red-500">*</span></label>
                                <input
                                    value={form.client}
                                    onChange={(e) => set("client", e.target.value)}
                                    placeholder="e.g. Mr & Mrs Jones"
                                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Client Email <span className="text-slate-400 font-normal">(optional)</span></label>
                                <input
                                    type="email"
                                    value={form.clientEmail}
                                    onChange={(e) => set("clientEmail", e.target.value)}
                                    placeholder="client@example.com"
                                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Client Phone <span className="text-slate-400 font-normal">(optional)</span></label>
                                <input
                                    type="tel"
                                    value={form.clientPhone}
                                    onChange={(e) => set("clientPhone", e.target.value)}
                                    placeholder="07700 900000"
                                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Client Address</label>
                            <PostcodeLookup onAddressFound={(addr) => set("clientAddress", form.clientAddress ? form.clientAddress : addr)} theme="light" />
                            <textarea
                                value={form.clientAddress}
                                onChange={(e) => set("clientAddress", e.target.value)}
                                placeholder="Client billing address..."
                                rows={2}
                                className="w-full px-3 py-2 mt-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400 resize-none"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700">Site Address <span className="text-slate-400 font-normal">(if different from client address)</span></label>
                            <PostcodeLookup onAddressFound={(addr) => set("siteAddress", form.siteAddress ? form.siteAddress : addr)} theme="light" />
                            <textarea
                                value={form.siteAddress}
                                onChange={(e) => set("siteAddress", e.target.value)}
                                placeholder="Works site address..."
                                rows={2}
                                className="w-full px-3 py-2 mt-2 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400 resize-none"
                            />
                        </div>

                        <div className="grid sm:grid-cols-3 gap-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Project Type</label>
                                <select
                                    value={form.projectType}
                                    onChange={(e) => set("projectType", e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                                >
                                    {projectTypes.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                                {businessType && (
                                    <p className="text-xs text-slate-400">Based on your trade profile. You can change this per project.</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Target Start Date</label>
                                <input
                                    type="date"
                                    value={form.startDate}
                                    onChange={(e) => set("startDate", e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-700">Contract Value (£)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="100"
                                    value={form.potentialValue}
                                    onChange={(e) => set("potentialValue", e.target.value)}
                                    placeholder="e.g. 45000"
                                    className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder:text-slate-400"
                                />
                                <p className="text-xs text-slate-400">Optional — you can set this after pricing in the estimator</p>
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                type="button"
                                disabled={!form.name.trim() || !form.client.trim()}
                                onClick={() => setStep(2)}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all"
                            >
                                Next: Choose Template →
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 2: Choose Template ── */}
                {step === 2 && (
                    <div className="space-y-6">
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
                            <h2 className="text-xl font-bold text-slate-900 mb-1">Choose a Template</h2>
                            <p className="text-sm text-slate-500 mb-1">Select a starting point for your schedule and estimate. You can customise everything after.</p>
                            {showNoMatchNote && (
                                <p className="text-xs text-amber-600 mb-5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                    No specific template for this project type — choose the closest match.
                                </p>
                            )}
                            {!showNoMatchNote && filteredTemplates.length > 1 && (
                                <p className="text-xs text-blue-600 mb-5">Showing templates relevant to: <strong>{form.projectType}</strong></p>
                            )}

                            <div className="grid md:grid-cols-3 gap-4">
                                {templatesToShow.map((t) => (
                                    <label key={t.id} className="cursor-pointer group relative block">
                                        <input
                                            type="radio"
                                            name="typeId"
                                            value={t.id}
                                            checked={form.typeId === t.id}
                                            onChange={() => set("typeId", t.id)}
                                            className="peer sr-only"
                                        />
                                        <div className="h-full border-2 border-slate-200 peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:ring-1 peer-checked:ring-blue-600 hover:border-blue-300 transition-all cursor-pointer rounded-xl p-5">
                                            <div className="flex items-start justify-between mb-2">
                                                <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 leading-tight">{t.name}</h3>
                                                {form.typeId === t.id && (
                                                    <div className="text-blue-600 flex-shrink-0 ml-2">
                                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 mb-3">{t.description}</p>
                                            {t.items.length > 0 ? (
                                                <ul className="text-xs text-slate-400 space-y-1">
                                                    {t.items.slice(0, 4).map((item, idx) => (
                                                        <li key={idx} className="flex items-center gap-1.5">
                                                            <span className="w-1 h-1 bg-slate-300 rounded-full flex-shrink-0" />
                                                            {item.name}
                                                        </li>
                                                    ))}
                                                    {t.items.length > 4 && (
                                                        <li className="text-slate-400">+ {t.items.length - 4} more stages</li>
                                                    )}
                                                </ul>
                                            ) : (
                                                <p className="text-xs text-slate-400 italic">Empty schedule — build from scratch</p>
                                            )}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-between">
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="px-5 py-2.5 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-all"
                            >
                                ← Back
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep(3)}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-all"
                            >
                                Next: Review →
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 3: Review & Create ── */}
                {step === 3 && (
                    <div className="space-y-6">
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
                            <h2 className="text-xl font-bold text-slate-900 mb-1">Review & Create</h2>
                            <p className="text-sm text-slate-500 mb-6">Check the details below before creating your project.</p>

                            <div className="space-y-4">
                                <div className="bg-slate-50 rounded-xl p-5 space-y-3">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Project</h3>
                                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-slate-500">Name</span>
                                            <p className="font-semibold text-slate-900">{form.name}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Type</span>
                                            <p className="font-semibold text-slate-900">{form.projectType}</p>
                                        </div>
                                        {form.startDate && (
                                            <div>
                                                <span className="text-slate-500">Target Start</span>
                                                <p className="font-semibold text-slate-900">
                                                    {new Date(form.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                                                </p>
                                            </div>
                                        )}
                                        {form.potentialValue && (
                                            <div>
                                                <span className="text-slate-500">Contract Value</span>
                                                <p className="font-bold text-blue-700 text-base">
                                                    £{Number(form.potentialValue).toLocaleString("en-GB")}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-xl p-5 space-y-3">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Client</h3>
                                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-slate-500">Name</span>
                                            <p className="font-semibold text-slate-900">{form.client}</p>
                                        </div>
                                        {form.clientEmail && (
                                            <div>
                                                <span className="text-slate-500">Email</span>
                                                <p className="font-semibold text-slate-900">{form.clientEmail}</p>
                                            </div>
                                        )}
                                        {form.clientPhone && (
                                            <div>
                                                <span className="text-slate-500">Phone</span>
                                                <p className="font-semibold text-slate-900">{form.clientPhone}</p>
                                            </div>
                                        )}
                                        {form.clientAddress && (
                                            <div>
                                                <span className="text-slate-500">Client Address</span>
                                                <p className="font-semibold text-slate-900 whitespace-pre-line">{form.clientAddress}</p>
                                            </div>
                                        )}
                                        {form.siteAddress && (
                                            <div>
                                                <span className="text-slate-500">Site Address</span>
                                                <p className="font-semibold text-slate-900 whitespace-pre-line">{form.siteAddress}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-xl p-5 space-y-3">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Template</h3>
                                    <p className="text-sm font-semibold text-slate-900">{selectedTemplate?.name || "None"}</p>
                                    {selectedTemplate && selectedTemplate.items.length > 0 && (
                                        <p className="text-xs text-slate-500">{selectedTemplate.items.length} stages will be pre-loaded into your schedule</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between">
                            <button
                                type="button"
                                onClick={() => setStep(2)}
                                className="px-5 py-2.5 border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-all"
                            >
                                ← Back
                            </button>
                            <button
                                type="button"
                                disabled={loading}
                                onClick={handleCreate}
                                className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Creating...
                                    </>
                                ) : (
                                    "Create Project & Open Proposal →"
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
