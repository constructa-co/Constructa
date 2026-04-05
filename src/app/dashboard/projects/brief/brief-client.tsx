"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Send, Loader2, Sparkles, ArrowRight, Save, MapPin, ClipboardList, Building2, User, Calendar, PoundSterling, AlignLeft, Layers } from "lucide-react";
import { processBriefChatAction, saveBriefAction, suggestEstimateLineItemsAction } from "./actions";

const ALL_TRADES = [
    'Site Setup & Preliminaries', 'Demolition & Strip Out', 'Asbestos Removal',
    'Temporary Works / Propping / Shoring', 'Groundworks & Civils', 'Drainage',
    'Utilities – Water', 'Utilities – Gas', 'Utilities – Electric / Ducting',
    'Utilities – Telecoms / Data Ducting', 'Attenuation / SuDS / Stormwater',
    'Piling', 'Underpinning & Structural Stabilisation', 'Concrete / RC Works',
    'Steel Frame / Steel Erection', 'Structural Timber / Framing',
    'Masonry / Brickwork / Blockwork', 'Cladding & Rainscreen', 'Roofing',
    'Waterproofing', 'Insulation', 'Windows, Doors & Glazing',
    'Builders / General Building', 'Landscaping & External Works',
    'Surfacing, Paving & Kerbing', 'Fencing & Gates',
    'Swimming Pools & Water Features', 'Signage', 'Line Marking & Road Furniture',
    'External Lighting', 'Domestic Electrical', 'Commercial Electrical',
    'Industrial Electrical', 'EV Chargers', 'Street Electrical / Feeder Pillars',
    'Substations', 'Domestic Plumbing', 'Commercial Plumbing / Public Health',
    'Mechanical / HVAC', 'Domestic Heating', 'Air Conditioning / Refrigeration',
    'Fire Alarm & Life Safety', 'Security / CCTV / Access Control',
    'Drylining & Partitions', 'Plastering & Rendering', 'Carpentry & Joinery',
    'Kitchen Installation', 'Bathroom Installation', 'Tiling', 'Flooring',
    'Ceilings', 'Painting & Decorating', 'Fire Stopping',
    'Passive Fire Protection / Intumescent', 'Diamond Drilling & Sawing',
    'Builderswork in Connection', 'Specialist Finishes', 'Waste Management / Logistics',
    'Scaffolding & Access',
];

interface Project {
    id: string;
    name: string;
    client_name: string;
    site_address: string;
    client_address?: string;
    postcode: string;
    potential_value: number;
    start_date: string;
    brief_scope: string;
    brief_trade_sections: string[];
    client_type: string;
    lat: number | null;
    lng: number | null;
    region: string;
    brief_completed: boolean;
    project_type: string;
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

interface Props {
    project: Project;
    activeEstimateId: string | null;
    projectId: string;
}

const inputCls = "w-full h-11 rounded-lg border border-slate-700 bg-slate-900/50 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors";
const readonlyCls = "w-full h-11 rounded-lg border border-slate-700/50 bg-slate-900/30 px-3 text-sm text-slate-400 cursor-default";

function SectionCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
    return (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-500" />
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</h2>
            </div>
            {children}
        </div>
    );
}

export default function BriefClient({ project, activeEstimateId, projectId }: Props) {
    const [isPending, startTransition] = useTransition();

    // Brief form state
    const [scope, setScope] = useState(project.brief_scope);
    const [clientType, setClientType] = useState(project.client_type);
    const [selectedTrades, setSelectedTrades] = useState<string[]>(project.brief_trade_sections);
    const [estimatedValue, setEstimatedValue] = useState(project.potential_value);
    const [startDate, setStartDate] = useState(project.start_date);
    const [lat, setLat] = useState<number | null>(project.lat);
    const [lng, setLng] = useState<number | null>(project.lng);
    const [region, setRegion] = useState(project.region);

    // Chat state
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);

    // Suggest estimate lines state
    const [suggesting, setSuggesting] = useState(false);
    const [suggestResult, setSuggestResult] = useState<{ success: boolean; message: string } | null>(null);

    const handlePostcodeLookup = async (postcode: string) => {
        if (!postcode || postcode.length < 5) return;
        try {
            const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
            const res = await fetch(`https://api.postcodes.io/postcodes/${cleanPostcode}`);
            const data = await res.json();
            if (data.status === 200 && data.result) {
                setLat(data.result.latitude);
                setLng(data.result.longitude);
                setRegion(data.result.region || data.result.european_electoral_region || "");
            }
        } catch {
            // Silently fail — postcode API is optional
        }
    };

    const handleChatSend = async () => {
        if (!chatInput.trim() || chatLoading) return;
        const userMessage = chatInput.trim();
        setChatInput("");
        setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
        setChatLoading(true);

        try {
            const result = await processBriefChatAction(userMessage, {
                name: project.name,
                address: project.site_address || project.client_address || '',
                projectType: project.project_type,
            });

            if (result.scope) setScope(result.scope);
            if (result.clientType) setClientType(result.clientType);
            if (result.suggestedTrades?.length) {
                setSelectedTrades(prev => {
                    const combined = new Set([...prev, ...result.suggestedTrades]);
                    return Array.from(combined);
                });
            }
            if (result.estimatedValue > 0) setEstimatedValue(result.estimatedValue);

            setChatMessages(prev => [...prev, { role: "assistant", content: result.response }]);
        } catch {
            setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I had trouble processing that. Could you try again?" }]);
        }
        setChatLoading(false);
    };

    const handleSave = () => {
        startTransition(async () => {
            await saveBriefAction(project.id, {
                brief_scope: scope,
                brief_trade_sections: selectedTrades,
                client_type: clientType,
                lat: lat ?? undefined,
                lng: lng ?? undefined,
                region: region || undefined,
                brief_completed: true,
                potential_value: estimatedValue,
                start_date: startDate || undefined,
            });
            toast.success("Brief saved");
        });
    };

    const handleSuggestEstimateLines = async () => {
        if (!scope || selectedTrades.length === 0) {
            toast.error("Add a scope and select trades first");
            return;
        }
        setSuggesting(true);
        setSuggestResult(null);
        try {
            const result = await suggestEstimateLineItemsAction(projectId, scope, selectedTrades);
            if (!result) {
                setSuggestResult({ success: false, message: 'Server error — please try again.' });
                setSuggesting(false);
                return;
            }
            if (result.success) {
                setSuggestResult({
                    success: true,
                    message: `✓ ${result.linesCreated} line items created across ${result.sectionsCreated} sections — go to Estimating to review and add rates.`
                });
            } else {
                setSuggestResult({ success: false, message: `Failed to create estimate lines: ${result.error || 'Unknown error'}` });
            }
        } catch (err: any) {
            setSuggestResult({ success: false, message: err.message });
        } finally {
            setSuggesting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Hero */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <ClipboardList className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-white">Project Brief</h1>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                                <Sparkles className="h-3 w-3" />
                                AI-Powered
                            </span>
                        </div>
                        <p className="text-slate-400 text-sm mt-0.5">
                            Describe your project. The AI assistant can help you build the brief from a single sentence.
                        </p>
                    </div>
                </div>

                {/* Completion badge */}
                {project.brief_completed && (
                    <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                        Brief Complete
                    </span>
                )}
            </div>

            {/* Two-column layout */}
            <div className="grid lg:grid-cols-5 gap-6">

                {/* LEFT — Brief Form (3 cols) */}
                <div className="lg:col-span-3 space-y-4">

                    {/* Project Info */}
                    <SectionCard icon={Building2} title="Project Details">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-400">Project Name</label>
                                <input className={readonlyCls} value={project.name} readOnly />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-400">Client Name</label>
                                <input className={readonlyCls} value={project.client_name} readOnly />
                            </div>
                        </div>

                        {/* Client Type */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-400">Client Type</label>
                            <div className="flex gap-2">
                                {(["domestic", "commercial", "public"] as const).map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setClientType(t)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                                            clientType === t
                                                ? "bg-blue-600 text-white border-blue-600"
                                                : "bg-slate-900/50 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200"
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </SectionCard>

                    {/* Location & Dates */}
                    <SectionCard icon={MapPin} title="Location & Dates">
                        <div className="grid sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-2 space-y-1.5">
                                <label className="text-xs font-medium text-slate-400">Site Address</label>
                                <input className={readonlyCls} value={project.site_address || project.client_address || ''} readOnly />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-400">Postcode</label>
                                <div className="relative">
                                    <input
                                        className={inputCls}
                                        defaultValue={project.postcode}
                                        onBlur={e => handlePostcodeLookup(e.target.value)}
                                        placeholder="SW1A 1AA"
                                    />
                                    {lat && (
                                        <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-400" />
                                    )}
                                </div>
                                {region && <p className="text-xs text-slate-500">{region}</p>}
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-400">Target Start Date</label>
                                <input
                                    type="date"
                                    className={inputCls + " [color-scheme:dark]"}
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-400">Estimated Value (£)</label>
                                <input
                                    type="number"
                                    className={inputCls}
                                    value={estimatedValue || ""}
                                    onChange={e => setEstimatedValue(Number(e.target.value) || 0)}
                                    placeholder="60000"
                                />
                            </div>
                        </div>
                    </SectionCard>

                    {/* Scope */}
                    <SectionCard icon={AlignLeft} title="Scope of Works">
                        <textarea
                            className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors resize-none"
                            rows={5}
                            value={scope}
                            onChange={e => setScope(e.target.value)}
                            placeholder="Describe the works in detail — or use the AI assistant to generate this from a brief description..."
                        />
                    </SectionCard>

                    {/* Trade Sections */}
                    <SectionCard icon={Layers} title="Trade Sections">
                        <p className="text-xs text-slate-500 -mt-1">Select all trades involved in this project. The AI assistant can suggest these from your scope.</p>
                        {selectedTrades.length > 0 && (
                            <p className="text-xs text-blue-400 font-medium">{selectedTrades.length} trade{selectedTrades.length !== 1 ? 's' : ''} selected</p>
                        )}
                        <div className="grid grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-1">
                            {ALL_TRADES.map(trade => {
                                const isSelected = selectedTrades.includes(trade);
                                return (
                                    <button
                                        key={trade}
                                        type="button"
                                        onClick={() => {
                                            setSelectedTrades(prev =>
                                                isSelected ? prev.filter(t => t !== trade) : [...prev, trade]
                                            );
                                        }}
                                        className={`text-xs px-2 py-1.5 rounded-md border text-left transition-colors leading-tight ${
                                            isSelected
                                                ? "bg-blue-600/20 text-blue-300 border-blue-500/40"
                                                : "bg-slate-900/50 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200"
                                        }`}
                                    >
                                        {trade}
                                    </button>
                                );
                            })}
                        </div>
                    </SectionCard>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                            onClick={handleSave}
                            disabled={isPending}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-500 disabled:opacity-50 transition-colors"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isPending ? "Saving..." : "Save Brief"}
                        </button>

                        <button
                            onClick={handleSuggestEstimateLines}
                            disabled={suggesting || !scope || selectedTrades.length === 0}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg font-semibold text-sm hover:bg-emerald-600/30 disabled:opacity-40 transition-colors"
                        >
                            {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {suggesting ? "Generating..." : "Suggest Estimate Lines"}
                        </button>

                        <Link
                            href={`/dashboard/projects/costs?projectId=${projectId}`}
                            className="flex items-center gap-2 px-5 py-2.5 bg-slate-700/50 text-slate-300 border border-slate-600/50 rounded-lg font-semibold text-sm hover:bg-slate-700 transition-colors"
                        >
                            Go to Estimating
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    {suggestResult && (
                        <div className={`px-4 py-3 rounded-lg text-sm font-medium border ${
                            suggestResult.success
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                : "bg-red-500/10 border-red-500/20 text-red-400"
                        }`}>
                            {suggestResult.message}
                        </div>
                    )}
                </div>

                {/* RIGHT — AI Chat Assistant (2 cols) */}
                <div className="lg:col-span-2">
                    <div className="sticky top-24 bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden flex flex-col" style={{ height: "calc(100vh - 14rem)" }}>

                        {/* Chat header */}
                        <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-700/50 flex items-center gap-3 flex-shrink-0">
                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                <Sparkles className="h-4 w-4 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-white">AI Brief Assistant</h3>
                                <p className="text-xs text-slate-500">Describe your project and I'll help build the brief</p>
                            </div>
                        </div>

                        {/* Chat messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {chatMessages.length === 0 && (
                                <div className="text-center py-8 px-4">
                                    <div className="h-14 w-14 mx-auto mb-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                        <Sparkles className="h-7 w-7 text-blue-400" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-300">Tell me about your project</p>
                                    <p className="text-xs text-slate-500 mt-1">I'll extract the scope, trades and estimated value automatically</p>
                                    <div className="mt-4 bg-slate-700/30 border border-slate-700/50 rounded-lg px-3 py-2.5 text-xs text-slate-500 italic text-left">
                                        "Two-storey rear extension, brick and block, bifold doors, start April, about £60k"
                                    </div>
                                </div>
                            )}
                            {chatMessages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                                        msg.role === "user"
                                            ? "bg-blue-600 text-white"
                                            : "bg-slate-700/60 text-slate-200 border border-slate-600/50"
                                    }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {chatLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-700/60 border border-slate-600/50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                                        <span className="text-xs text-slate-500">Thinking…</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Chat input */}
                        <div className="border-t border-slate-700/50 p-3 flex-shrink-0">
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 h-10 rounded-lg border border-slate-700 bg-slate-900/50 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") handleChatSend(); }}
                                    placeholder="Describe your project..."
                                />
                                <button
                                    onClick={handleChatSend}
                                    disabled={chatLoading || !chatInput.trim()}
                                    className="h-10 w-10 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition-colors flex-shrink-0"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
