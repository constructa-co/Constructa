"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Building2, Banknote, Clock, Pencil } from "lucide-react";
import { updateCaseStudiesAction } from "./actions";

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

export default function CaseStudiesClient({ initialCaseStudies }: { initialCaseStudies: CaseStudy[] }) {
    const [caseStudies, setCaseStudies] = useState<CaseStudy[]>(initialCaseStudies || []);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const addCaseStudy = () => {
        const newCs: CaseStudy = {
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
        };
        const updated = [...caseStudies, newCs];
        setCaseStudies(updated);
        setEditingId(newCs.id);
    };

    const updateCaseStudy = (id: string, updates: Partial<CaseStudy>) => {
        setCaseStudies(prev => prev.map(cs => cs.id === id ? { ...cs, ...updates } : cs));
    };

    const deleteCaseStudy = (id: string) => {
        setCaseStudies(prev => prev.filter(cs => cs.id !== id));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateCaseStudiesAction(caseStudies);
            setEditingId(null);
            toast.success("Case studies saved");
        } catch {
            toast.error("Failed to save");
        }
        setSaving(false);
    };

    const inputCls = "w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600";
    const textareaCls = "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600";

    return (
        <div className="space-y-6">
            {/* Case study cards */}
            <div className="grid md:grid-cols-2 gap-4">
                {caseStudies.map(cs => {
                    const isEditing = editingId === cs.id;
                    return (
                        <div key={cs.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                            {isEditing ? (
                                <div className="p-5 space-y-3">
                                    <input className={inputCls} placeholder="Project Name" value={cs.projectName} onChange={e => updateCaseStudy(cs.id, { projectName: e.target.value })} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <input className={inputCls} placeholder="Project Type (e.g. Extension)" value={cs.projectType} onChange={e => updateCaseStudy(cs.id, { projectType: e.target.value })} />
                                        <input className={inputCls} placeholder="Contract Value (e.g. £85,000)" value={cs.contractValue} onChange={e => updateCaseStudy(cs.id, { contractValue: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <input className={inputCls} placeholder="Client Name" value={cs.client} onChange={e => updateCaseStudy(cs.id, { client: e.target.value })} />
                                        <input className={inputCls} placeholder="Location" value={cs.location} onChange={e => updateCaseStudy(cs.id, { location: e.target.value })} />
                                    </div>
                                    <input className={inputCls} placeholder="Programme Duration (e.g. 8 weeks)" value={cs.programmeDuration} onChange={e => updateCaseStudy(cs.id, { programmeDuration: e.target.value })} />
                                    <textarea className={textareaCls} rows={3} placeholder="What we delivered..." value={cs.whatWeDelivered} onChange={e => updateCaseStudy(cs.id, { whatWeDelivered: e.target.value })} />
                                    <textarea className={textareaCls} rows={2} placeholder="Value we added..." value={cs.valueAdded} onChange={e => updateCaseStudy(cs.id, { valueAdded: e.target.value })} />
                                    <div className="flex gap-2">
                                        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                                            {saving ? "Saving..." : "Save"}
                                        </button>
                                        <button onClick={() => setEditingId(null)} className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm">Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="font-bold text-slate-100">{cs.projectName || "Untitled Project"}</h3>
                                            {cs.projectType && <span className="text-xs text-slate-400">{cs.projectType}</span>}
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => setEditingId(cs.id)} className="p-1.5 text-slate-500 hover:text-blue-400 rounded">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => deleteCaseStudy(cs.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 text-xs text-slate-400">
                                        {cs.client && (
                                            <div className="flex items-center gap-1.5">
                                                <Building2 className="w-3 h-3" />
                                                <span>{cs.client}</span>
                                            </div>
                                        )}
                                        {cs.location && (
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="w-3 h-3" />
                                                <span>{cs.location}</span>
                                            </div>
                                        )}
                                        {cs.contractValue && (
                                            <div className="flex items-center gap-1.5">
                                                <Banknote className="w-3 h-3" />
                                                <span>{cs.contractValue}</span>
                                            </div>
                                        )}
                                        {cs.programmeDuration && (
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3 h-3" />
                                                <span>{cs.programmeDuration}</span>
                                            </div>
                                        )}
                                    </div>
                                    {cs.whatWeDelivered && (
                                        <p className="text-xs text-slate-300 mt-3 line-clamp-3">{cs.whatWeDelivered}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {caseStudies.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                    <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No case studies yet. Add your best projects to showcase in proposals.</p>
                </div>
            )}

            <button
                onClick={addCaseStudy}
                className="w-full py-3 border-2 border-dashed border-slate-700 rounded-xl text-sm text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors flex items-center justify-center gap-2"
            >
                <Plus className="w-4 h-4" />
                Add Case Study
            </button>
        </div>
    );
}
