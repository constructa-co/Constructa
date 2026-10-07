"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, Upload, Loader2, MapPin, Briefcase, Calendar, PoundSterling, Sparkles } from "lucide-react";
import { saveCaseStudiesAction, enhanceCaseStudyAction } from "./actions";
import type { CaseStudyResult, CaseStudySection } from "@/lib/cohort-ai/case-study-enhance";
import { pendingFrom, sectionState, settle, type PendingCaseStudySuggestion } from "@/lib/cohort-ai/case-study-suggestion";
import { uploadProfileImageAction } from "@/app/storage/actions";

type Enhance = (whatWeDelivered: string, valueAdded: string, projectName: string, projectType: string) => Promise<CaseStudyResult>;

interface CaseStudy {
    id: string;
    projectName: string;
    projectType: string;
    contractValue: string;
    programmeDuration: string;
    client: string;
    location: string;
    whatWeDelivered: string;
    valueAdded: string;
    photos: string[];
}

export default function CaseStudiesClient({ initialCaseStudies, userId, enhance = enhanceCaseStudyAction }: {
    initialCaseStudies: CaseStudy[];
    userId: string;
    /** Defaults to the real server action; replaced only by tests and the fixture harness. */
    enhance?: Enhance;
}) {
    const [caseStudies, setCaseStudies] = useState<CaseStudy[]>(initialCaseStudies);
    const [isPending, startTransition] = useTransition();

    const addCaseStudy = () => {
        setCaseStudies(prev => [...prev, {
            id: crypto.randomUUID(),
            projectName: "",
            projectType: "",
            contractValue: "",
            programmeDuration: "",
            client: "",
            location: "",
            whatWeDelivered: "",
            valueAdded: "",
            photos: ["", "", ""],
        }]);
    };

    const updateCaseStudy = (index: number, field: keyof CaseStudy, value: string | string[]) => {
        setCaseStudies(prev => prev.map((cs, i) => i === index ? { ...cs, [field]: value } : cs));
    };

    const removeCaseStudy = (index: number) => {
        setCaseStudies(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        startTransition(async () => {
            await saveCaseStudiesAction(caseStudies);
            toast.success("Case studies saved");
        });
    };

    const handlePhotoUpload = async (csIndex: number, slot: number, file: File) => {
        const cs = caseStudies[csIndex];
        const formData = new FormData();
        formData.set("file", file);
        formData.set("purpose", "case-study");
        const result = await uploadProfileImageAction(formData);
        if (result.url) {
            const newPhotos = [...(cs.photos || ["", "", ""])];
            newPhotos[slot] = result.url;
            updateCaseStudy(csIndex, "photos", newPhotos);
            toast.success("Photo uploaded");
        } else {
            toast.error(result.error || "Upload failed");
        }
    };

    const inputCls = "w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600";
    const labelCls = "text-xs font-medium text-slate-400 block mb-1";

    return (
        <div className="space-y-6">
            {caseStudies.length === 0 && (
                <div className="text-center py-16 border-2 border-dashed border-slate-700 rounded-xl">
                    <Briefcase className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                    <p className="text-slate-500 text-sm mb-3">No case studies yet. Add your first to showcase past work in proposals.</p>
                    <button onClick={addCaseStudy} className="text-sm font-semibold text-blue-400 hover:text-blue-300">
                        + Add Case Study
                    </button>
                </div>
            )}

            {caseStudies.map((cs, index) => (
                <CaseStudyCard
                    key={cs.id}
                    cs={cs}
                    index={index}
                    onChange={(field, value) => updateCaseStudy(index, field, value)}
                    onRemove={() => removeCaseStudy(index)}
                    onPhotoUpload={(slot, file) => handlePhotoUpload(index, slot, file)}
                    inputCls={inputCls}
                    labelCls={labelCls}
                    enhance={enhance}
                />
            ))}

            <div className="flex items-center justify-between pt-2">
                <button
                    onClick={addCaseStudy}
                    className="flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300 bg-blue-900/20 hover:bg-blue-900/40 border border-blue-700/40 rounded-lg px-4 py-2.5 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add Case Study
                </button>

                <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-bold text-sm transition-all"
                >
                    {isPending ? "Saving..." : "Save All Case Studies"}
                </button>
            </div>
        </div>
    );
}

function CaseStudyCard({
    cs,
    index,
    onChange,
    onRemove,
    onPhotoUpload,
    inputCls,
    labelCls,
    enhance,
}: {
    enhance: Enhance;
    cs: CaseStudy;
    index: number;
    onChange: (field: keyof CaseStudy, value: string | string[]) => void;
    onRemove: () => void;
    onPhotoUpload: (slot: number, file: File) => void;
    inputCls: string;
    labelCls: string;
}) {
    const [expanded, setExpanded] = useState(true);
    const [enhancing, setEnhancing] = useState(false);

    // A reply is held here until the contractor decides. It never replaces what is in the form by arriving.
    const [pending, setPending] = useState<PendingCaseStudySuggestion | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const handleEnhance = async () => {
        // One request at a time: the button is disabled while this runs, and this guards a double press.
        if (enhancing) return;
        if (!cs.whatWeDelivered && !cs.valueAdded) return;
        // What the suggestion will have been written from, in case the contractor edits while it is on its way.
        const askedFrom: Record<CaseStudySection, string> = { whatWeDelivered: cs.whatWeDelivered, valueAdded: cs.valueAdded };
        setEnhancing(true);
        setNotice(null);
        setPending(null);
        try {
            const result = await enhance(askedFrom.whatWeDelivered, askedFrom.valueAdded, cs.projectName, cs.projectType);
            const next = pendingFrom(result, askedFrom);
            setPending(next);
            // A suggestion is shown beside the text it is about, so that part of the card must be open.
            if (next) setExpanded(true);
            if (!result.suggested) setNotice(result.message ?? "The assistant isn't available right now. Nothing has been changed.");
            else if (!next) setNotice("The assistant had nothing to change. Your wording is as it was.");
            else setNotice("Suggested wording is shown below. Nothing changes unless you choose to use it.");
        } catch {
            setNotice("The assistant isn't available right now. Nothing has been changed.");
        }
        setEnhancing(false);
    };

    const suggestionPanel = (section: CaseStudySection, label: string) => {
        const state = sectionState(pending, section, cs[section]);
        if (state === "none" || !pending) return null;
        const suggestion = pending.suggestions[section] ?? "";
        return (
            <div data-case-study-suggestion={section} data-state={state} role="group" aria-label={`Suggested wording for ${label}`} className="mt-2 rounded-lg border border-dashed border-violet-300 bg-violet-950 p-3 space-y-2">
                <p className="text-xs font-semibold text-violet-100">
                    Suggested wording. Check it says only what you wrote. Nothing changes unless you use it.
                </p>
                {state === "stale" && (
                    <p className="text-xs font-semibold text-amber-200">
                        You have changed this since you asked. The suggestion was written from your earlier wording, not what is in the box now.
                    </p>
                )}
                <p className="text-sm text-slate-100 whitespace-pre-wrap break-words">{suggestion}</p>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => { onChange(section, suggestion); setPending(settle(pending, section)); }} className="min-h-11 px-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                        {state === "stale" ? "Replace what I have now with this" : "Use this wording"}
                    </button>
                    <button type="button" onClick={() => setPending(settle(pending, section))} className="min-h-11 px-3 rounded-lg border border-slate-400 text-sm font-semibold text-slate-100 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                        Keep my own
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-slate-800/60 border-b border-slate-700">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Case Study {index + 1}</span>
                    {cs.projectName && <span className="text-sm font-semibold text-slate-200">— {cs.projectName}</span>}
                </div>
                <div className="flex items-center gap-2">
                    {(cs.whatWeDelivered || cs.valueAdded) && (
                        <button
                            onClick={handleEnhance}
                            disabled={enhancing}
                            className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-purple-700 bg-purple-900/30 text-purple-300 hover:bg-purple-800/40 text-xs font-bold transition-colors disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        >
                            {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                            {enhancing ? "Enhancing..." : "AI Enhance"}
                        </button>
                    )}
                    <button onClick={() => setExpanded(!expanded)} className="p-1 text-slate-400 hover:text-white">
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={onRemove} className="p-1 text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Says what happened to a request for wording. Never a success unless there is a suggestion to look at. */}
            <p data-case-study-notice role="status" aria-live="polite" className={notice ? "px-5 py-3 text-sm font-semibold text-slate-100 bg-slate-950 border-b border-slate-700" : "sr-only"}>
                {notice ?? ""}
            </p>

            {expanded && (
                <div className="p-5 space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Project Name</label>
                            <input className={inputCls} value={cs.projectName} onChange={e => onChange("projectName", e.target.value)} placeholder="e.g. Smith Residence Extension" />
                        </div>
                        <div>
                            <label className={labelCls}>Project Type</label>
                            <input className={inputCls} value={cs.projectType} onChange={e => onChange("projectType", e.target.value)} placeholder="e.g. Residential Extension" />
                        </div>
                        <div>
                            <label className={labelCls}>Contract Value</label>
                            <input className={inputCls} value={cs.contractValue} onChange={e => onChange("contractValue", e.target.value)} placeholder="e.g. £85,000" />
                        </div>
                        <div>
                            <label className={labelCls}>Programme Duration</label>
                            <input className={inputCls} value={cs.programmeDuration} onChange={e => onChange("programmeDuration", e.target.value)} placeholder="e.g. 12 weeks" />
                        </div>
                        <div>
                            <label className={labelCls}>Client Name</label>
                            <input className={inputCls} value={cs.client} onChange={e => onChange("client", e.target.value)} placeholder="e.g. Mr & Mrs Smith" />
                        </div>
                        <div>
                            <label className={labelCls}>Location</label>
                            <input className={inputCls} value={cs.location} onChange={e => onChange("location", e.target.value)} placeholder="e.g. Surrey" />
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>What We Delivered</label>
                        <textarea
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            rows={3}
                            aria-label="What We Delivered"
                            value={cs.whatWeDelivered}
                            onChange={e => onChange("whatWeDelivered", e.target.value)}
                            placeholder="Brief description of the works delivered..."
                        />
                        {suggestionPanel("whatWeDelivered", "What We Delivered")}
                    </div>

                    <div>
                        <label className={labelCls}>Value Added</label>
                        <textarea
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            rows={2}
                            aria-label="Value Added"
                            value={cs.valueAdded}
                            onChange={e => onChange("valueAdded", e.target.value)}
                            placeholder="What made this project stand out..."
                        />
                        {suggestionPanel("valueAdded", "Value Added")}
                    </div>

                    {/* Photos */}
                    <div>
                        <label className={labelCls}>Photos (up to 3)</label>
                        <div className="flex gap-3">
                            {[0, 1, 2].map(slot => (
                                <div key={slot} className="w-32 h-24 border border-slate-700 rounded-lg overflow-hidden bg-slate-800 relative group">
                                    {(cs.photos || [])[slot] ? (
                                        <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={cs.photos[slot]} alt={`Photo ${slot + 1}`} className="w-full h-full object-cover" />
                                            <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                                <Upload className="w-5 h-5 text-white" />
                                                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => e.target.files?.[0] && onPhotoUpload(slot, e.target.files[0])} />
                                            </label>
                                        </>
                                    ) : (
                                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700 transition-colors">
                                            <Upload className="w-5 h-5 text-slate-500 mb-1" />
                                            <span className="text-[10px] text-slate-500">Upload</span>
                                            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => e.target.files?.[0] && onPhotoUpload(slot, e.target.files[0])} />
                                        </label>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
