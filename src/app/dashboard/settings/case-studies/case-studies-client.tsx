"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, Upload, Loader2, MapPin, Briefcase, Calendar, PoundSterling, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { saveCaseStudiesAction, enhanceCaseStudyAction } from "./actions";

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

export default function CaseStudiesClient({ initialCaseStudies, userId }: { initialCaseStudies: CaseStudy[]; userId: string }) {
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
        const supabase = createClient();
        const cs = caseStudies[csIndex];
        const ext = file.name.split(".").pop() || "jpg";
        const path = `case-studies/${cs.id}/${slot}.${ext}`;
        const { error } = await supabase.storage
            .from("proposal-photos")
            .upload(path, file, { upsert: true });
        if (!error) {
            const { data } = supabase.storage.from("proposal-photos").getPublicUrl(path);
            const newPhotos = [...(cs.photos || ["", "", ""])];
            newPhotos[slot] = data.publicUrl;
            updateCaseStudy(csIndex, "photos", newPhotos);
            toast.success("Photo uploaded");
        } else {
            toast.error("Upload failed: " + error.message);
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
}: {
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

    const handleEnhance = async () => {
        if (!cs.whatWeDelivered && !cs.valueAdded) return;
        setEnhancing(true);
        try {
            const result = await enhanceCaseStudyAction(cs.whatWeDelivered, cs.valueAdded, cs.projectName, cs.projectType);
            if (result.whatWeDelivered) onChange("whatWeDelivered", result.whatWeDelivered);
            if (result.valueAdded) onChange("valueAdded", result.valueAdded);
            toast.success("Case study enhanced");
        } catch {
            toast.error("AI enhance failed");
        }
        setEnhancing(false);
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
                            className="flex items-center gap-1.5 h-7 px-3 rounded-lg border border-purple-700 bg-purple-900/30 text-purple-300 hover:bg-purple-800/40 text-xs font-bold transition-colors disabled:opacity-60"
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
                            value={cs.whatWeDelivered}
                            onChange={e => onChange("whatWeDelivered", e.target.value)}
                            placeholder="Brief description of the works delivered..."
                        />
                    </div>

                    <div>
                        <label className={labelCls}>Value Added</label>
                        <textarea
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            rows={2}
                            value={cs.valueAdded}
                            onChange={e => onChange("valueAdded", e.target.value)}
                            placeholder="What made this project stand out..."
                        />
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
                                                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onPhotoUpload(slot, e.target.files[0])} />
                                            </label>
                                        </>
                                    ) : (
                                        <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700 transition-colors">
                                            <Upload className="w-5 h-5 text-slate-500 mb-1" />
                                            <span className="text-[10px] text-slate-500">Upload</span>
                                            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onPhotoUpload(slot, e.target.files[0])} />
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
