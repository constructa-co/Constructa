"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Send, Loader2, Sparkles, ArrowRight, Save, MapPin } from "lucide-react";
import { processBriefChatAction, saveBriefAction, suggestEstimateLineItemsAction } from "./actions";
import { addLineItemAction, createEstimateAction } from "../costs/actions";

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

    const handlePostcodeLookup = async (postcode: string) => {
        if (!postcode || postcode.length < 5) return;
        try {
            const cleanPostcode = postcode.replace(/\s+/g, '');
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
                address: project.site_address,
                projectType: project.project_type,
            });

            // Auto-fill form fields
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
        try {
            const result = await suggestEstimateLineItemsAction(scope, selectedTrades);

            // Ensure there's an estimate to add lines to
            let estId = activeEstimateId;
            if (!estId) {
                const newEst = await createEstimateAction(projectId, "From Brief");
                if (newEst?.id) {
                    estId = newEst.id;
                } else {
                    toast.error("Failed to create estimate");
                    setSuggesting(false);
                    return;
                }
            }

            // Add the suggested lines
            let lineCount = 0;
            for (const section of result.sections) {
                for (const line of section.lines) {
                    await addLineItemAction(estId!, section.trade, {
                        description: line.description,
                        quantity: line.quantity,
                        unit: line.unit,
                        unit_rate: 0,
                    });
                    lineCount++;
                }
            }
            toast.success(`Added ${lineCount} suggested line items to estimate`);
        } catch {
            toast.error("Failed to suggest estimate lines");
        }
        setSuggesting(false);
    };

    const inputCls = "w-full h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900";

    return (
        <div className="grid lg:grid-cols-5 gap-8">
            {/* LEFT — Brief Form (3 cols) */}
            <div className="lg:col-span-3 space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Project Brief</h1>
                    <p className="text-sm text-gray-500 mt-1">Describe your project. The AI assistant on the right can help you fill this in.</p>
                </div>

                {/* Project Name + Client */}
                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-600">Project Name</label>
                        <input className={inputCls} value={project.name} readOnly />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-600">Client Name</label>
                        <input className={inputCls} value={project.client_name} readOnly />
                    </div>
                </div>

                {/* Client Type */}
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-600">Client Type</label>
                    <div className="flex gap-2">
                        {(["domestic", "commercial", "public"] as const).map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setClientType(t)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                                    clientType === t
                                        ? "bg-gray-900 text-white border-gray-900"
                                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                                }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Site Address + Postcode */}
                <div className="grid sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 space-y-1.5">
                        <label className="text-sm font-medium text-gray-600">Site Address</label>
                        <input className={inputCls} value={project.site_address} readOnly />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-600">Postcode</label>
                        <div className="flex gap-2">
                            <input
                                className={inputCls}
                                defaultValue={project.postcode}
                                onBlur={e => handlePostcodeLookup(e.target.value)}
                                placeholder="SW1A 1AA"
                            />
                            {lat && (
                                <div className="flex items-center text-green-600">
                                    <MapPin className="w-4 h-4" />
                                </div>
                            )}
                        </div>
                        {region && <p className="text-xs text-gray-400">Region: {region}</p>}
                    </div>
                </div>

                {/* Start date + Estimated value */}
                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-600">Target Start Date</label>
                        <input
                            type="date"
                            className={inputCls}
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-600">Estimated Value</label>
                        <input
                            type="number"
                            className={inputCls}
                            value={estimatedValue || ""}
                            onChange={e => setEstimatedValue(Number(e.target.value) || 0)}
                            placeholder="60000"
                        />
                    </div>
                </div>

                {/* Scope */}
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-600">Scope of Works</label>
                    <textarea
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        rows={5}
                        value={scope}
                        onChange={e => setScope(e.target.value)}
                        placeholder="Describe the works in detail..."
                    />
                </div>

                {/* Trade Sections */}
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-600">Trade Sections</label>
                    <p className="text-xs text-gray-400 mb-2">Select the trades involved in this project.</p>
                    <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto border border-gray-200 rounded-lg p-3">
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
                                    className={`text-xs px-2 py-1.5 rounded-md border text-left transition-colors ${
                                        isSelected
                                            ? "bg-gray-900 text-white border-gray-900"
                                            : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                                    }`}
                                >
                                    {trade}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg font-semibold text-sm hover:bg-gray-700 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {isPending ? "Saving..." : "Save Brief"}
                    </button>

                    <button
                        onClick={handleSuggestEstimateLines}
                        disabled={suggesting || !scope || selectedTrades.length === 0}
                        className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Sparkles className="w-4 h-4" />
                        {suggesting ? "Generating..." : "Suggest Estimate Lines"}
                    </button>

                    <Link
                        href={`/dashboard/projects/costs?projectId=${projectId}`}
                        className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50"
                    >
                        Go to Estimating
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>

            {/* RIGHT — AI Chat Assistant (2 cols) */}
            <div className="lg:col-span-2">
                <div className="sticky top-24 border border-gray-200 rounded-xl bg-white overflow-hidden flex flex-col" style={{ height: "calc(100vh - 12rem)" }}>
                    {/* Chat header */}
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-sm font-bold text-gray-900">AI Brief Assistant</h3>
                        <p className="text-xs text-gray-500">Describe your project and I'll help build the brief</p>
                    </div>

                    {/* Chat messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {chatMessages.length === 0 && (
                            <div className="text-center py-10 text-gray-400">
                                <Sparkles className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                                <p className="text-sm">Tell me about your project and I'll help you build a complete brief.</p>
                                <p className="text-xs mt-2 text-gray-300">e.g. "Two-storey rear extension, brick and block, bifold doors, start April, about 60k"</p>
                            </div>
                        )}
                        {chatMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                                    msg.role === "user"
                                        ? "bg-gray-900 text-white"
                                        : "bg-gray-100 text-gray-800"
                                }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {chatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 rounded-lg px-3 py-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Chat input */}
                    <div className="border-t border-gray-200 p-3">
                        <div className="flex gap-2">
                            <input
                                className="flex-1 h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") handleChatSend(); }}
                                placeholder="Describe your project..."
                            />
                            <button
                                onClick={handleChatSend}
                                disabled={chatLoading || !chatInput.trim()}
                                className="h-10 w-10 flex items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
