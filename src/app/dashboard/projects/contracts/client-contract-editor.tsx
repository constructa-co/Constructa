"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, Plus, Trash2, Upload, Send, AlertTriangle, Shield, FileText, Scale, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    saveTcTierAction,
    analyseContractAction,
    saveRiskRegisterAction,
    generateRiskRegisterAction,
    saveContractExclusionsAction,
    contractChatAction,
    suggestTcTierAction,
} from "./actions";

interface RiskItem {
    id: string;
    type: "risk" | "opportunity";
    description: string;
    likelihood: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
    mitigation?: string;
    action?: string;
}

interface ContractFlag {
    type: string;
    clause: string;
    description: string;
    severity: string;
    recommendation: string;
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

interface Props {
    projectId: string;
    project: any;
}

const TC_TIERS = [
    {
        id: "domestic",
        name: "Domestic",
        subtitle: "For homeowner clients",
        description: "Plain English terms for residential projects. RICS Homeowner Adjudication. Simple payment terms.",
        clauses: 12,
    },
    {
        id: "commercial",
        name: "Commercial",
        subtitle: "For business clients",
        description: "JCT Minor Works based. Suitable for commercial and light industrial projects. Full liquidated damages and retention provisions.",
        clauses: 24,
    },
    {
        id: "specialist",
        name: "Specialist",
        subtitle: "For specialist/trade works",
        description: "Trade-specific terms. Suitable for subcontract packages and specialist installations.",
        clauses: 18,
    },
];

const TABS = [
    { key: "tc", label: "Terms & Conditions", icon: FileText },
    { key: "risk", label: "Risk & Opportunities", icon: Shield },
    { key: "exclusions", label: "Exclusions & Clarifications", icon: Scale },
    { key: "chat", label: "Contract AI Assistant", icon: MessageSquare },
] as const;

type TabKey = typeof TABS[number]["key"];

const SEVERITY_COLORS: Record<string, string> = {
    high: "bg-red-100 text-red-700 border-red-300",
    medium: "bg-amber-100 text-amber-700 border-amber-300",
    low: "bg-green-100 text-green-700 border-green-300",
};

const LIKELIHOOD_COLORS: Record<string, string> = {
    high: "bg-red-50 text-red-600",
    medium: "bg-amber-50 text-amber-600",
    low: "bg-green-50 text-green-600",
};

export default function ClientContractEditor({ projectId, project }: Props) {
    const [activeTab, setActiveTab] = useState<TabKey>("tc");

    // Tab A: T&C state
    const [selectedTier, setSelectedTier] = useState(project?.tc_tier || "domestic");
    const [suggestingTier, setSuggestingTier] = useState(false);
    const [uploadedText, setUploadedText] = useState(project?.uploaded_contract_text || "");
    const [analysing, setAnalysing] = useState(false);
    const [flags, setFlags] = useState<ContractFlag[]>(project?.contract_review_flags || []);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Tab B: Risk state
    const [riskRegister, setRiskRegister] = useState<RiskItem[]>(project?.risk_register || []);
    const [generatingRisks, setGeneratingRisks] = useState(false);

    // Tab C: Exclusions state
    const [contractExclusions, setContractExclusions] = useState(project?.contract_exclusions || "");
    const [contractClarifications, setContractClarifications] = useState(project?.contract_clarifications || "");
    const [savingExcl, setSavingExcl] = useState(false);

    // Tab D: Chat state
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState("");
    const [chatLoading, setChatLoading] = useState(false);

    // ─── Tab A handlers ────────────────────────────
    const handleSelectTier = async (tierId: string) => {
        setSelectedTier(tierId);
        await saveTcTierAction(projectId, tierId);
        toast.success(`T&C tier set to ${tierId}`);
    };

    const handleSuggestTier = async () => {
        setSuggestingTier(true);
        try {
            const result = await suggestTcTierAction(project?.client_type || "", project?.project_type || "");
            setSelectedTier(result.tier);
            await saveTcTierAction(projectId, result.tier);
            toast.success(`AI suggests: ${result.tier} — ${result.reason}`);
        } catch {
            toast.error("Failed to suggest tier");
        }
        setSuggestingTier(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            setUploadedText(text);
            toast.success("Contract text extracted — click Analyse to review");
        };
        reader.readAsText(file);
    };

    const handleAnalyse = async () => {
        if (!uploadedText) { toast.error("Upload a contract first"); return; }
        setAnalysing(true);
        try {
            const result = await analyseContractAction(projectId, uploadedText);
            setFlags(result.flags);
            toast.success(`Found ${result.flags.length} flags`);
        } catch {
            toast.error("Analysis failed");
        }
        setAnalysing(false);
    };

    // ─── Tab B handlers ────────────────────────────
    const addRiskItem = (type: "risk" | "opportunity") => {
        const item: RiskItem = {
            id: crypto.randomUUID(),
            type,
            description: "",
            likelihood: "medium",
            impact: "medium",
            ...(type === "risk" ? { mitigation: "" } : { action: "" }),
        };
        const updated = [...riskRegister, item];
        setRiskRegister(updated);
        saveRiskRegisterAction(projectId, updated);
    };

    const updateRiskItem = (id: string, updates: Partial<RiskItem>) => {
        const updated = riskRegister.map(r => r.id === id ? { ...r, ...updates } : r);
        setRiskRegister(updated);
        saveRiskRegisterAction(projectId, updated);
    };

    const deleteRiskItem = (id: string) => {
        const updated = riskRegister.filter(r => r.id !== id);
        setRiskRegister(updated);
        saveRiskRegisterAction(projectId, updated);
    };

    const handleGenerateRisks = async () => {
        setGeneratingRisks(true);
        try {
            const result = await generateRiskRegisterAction(projectId, project?.scope_text || project?.brief_scope || "", project?.project_type || "");
            const combined: RiskItem[] = [
                ...result.risks.map(r => ({ ...r, id: crypto.randomUUID(), type: "risk" as const, likelihood: r.likelihood as RiskItem["likelihood"], impact: r.impact as RiskItem["impact"] })),
                ...result.opportunities.map(o => ({ ...o, id: crypto.randomUUID(), type: "opportunity" as const, likelihood: o.likelihood as RiskItem["likelihood"], impact: o.impact as RiskItem["impact"] })),
            ];
            setRiskRegister(combined);
            toast.success(`Generated ${result.risks.length} risks and ${result.opportunities.length} opportunities`);
        } catch {
            toast.error("Failed to generate risk register");
        }
        setGeneratingRisks(false);
    };

    // ─── Tab C handlers ────────────────────────────
    const handleSaveExclusions = async () => {
        setSavingExcl(true);
        await saveContractExclusionsAction(projectId, contractExclusions, contractClarifications);
        toast.success("Saved");
        setSavingExcl(false);
    };

    // ─── Tab D handlers ────────────────────────────
    const handleSendChat = async () => {
        if (!chatInput.trim()) return;
        const userMsg = chatInput.trim();
        setChatInput("");
        setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
        setChatLoading(true);
        try {
            const result = await contractChatAction(userMsg, {
                tcTier: selectedTier,
                projectType: project?.project_type || "",
                flags,
            });
            setChatMessages(prev => [...prev, { role: "assistant", content: result.response }]);
        } catch {
            setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
        }
        setChatLoading(false);
    };

    const risks = riskRegister.filter(r => r.type === "risk");
    const opportunities = riskRegister.filter(r => r.type === "opportunity");

    return (
        <div className="space-y-6">
            {/* Tab bar */}
            <div className="flex gap-1 border-b border-slate-700">
                {TABS.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === key
                                ? "border-blue-500 text-blue-400"
                                : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            {/* ═══ TAB A: Terms & Conditions ═══ */}
            {activeTab === "tc" && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-100">Select T&C Tier</h3>
                        <Button onClick={handleSuggestTier} disabled={suggestingTier} variant="outline" size="sm" className="gap-2 border-slate-700 text-slate-300">
                            {suggestingTier ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            AI Suggest
                        </Button>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                        {TC_TIERS.map(tier => (
                            <button
                                key={tier.id}
                                onClick={() => handleSelectTier(tier.id)}
                                className={`text-left p-5 rounded-xl border-2 transition-all ${
                                    selectedTier === tier.id
                                        ? "border-blue-500 bg-blue-500/10"
                                        : "border-slate-700 bg-slate-900 hover:border-slate-500"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-slate-100">{tier.name}</span>
                                    <span className="text-xs text-slate-500">{tier.clauses} clauses</span>
                                </div>
                                <p className="text-xs text-slate-400 mb-1">{tier.subtitle}</p>
                                <p className="text-sm text-slate-300">{tier.description}</p>
                            </button>
                        ))}
                    </div>

                    {/* Upload Client Contract */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                        <h3 className="text-lg font-bold text-slate-100">Upload Client Contract</h3>
                        <p className="text-sm text-slate-400">Upload your client&apos;s contract (TXT) and let AI identify risks and obligations.</p>
                        <div className="flex items-center gap-3">
                            <input ref={fileInputRef} type="file" accept=".txt,.text" onChange={handleFileUpload} className="hidden" />
                            <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="gap-2 border-slate-700 text-slate-300">
                                <Upload className="w-4 h-4" />
                                Upload Contract
                            </Button>
                            {uploadedText && (
                                <Button onClick={handleAnalyse} disabled={analysing} className="gap-2 bg-purple-600 hover:bg-purple-700">
                                    {analysing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    Analyse Contract with AI
                                </Button>
                            )}
                            {uploadedText && <span className="text-xs text-green-400">Contract uploaded ({Math.round(uploadedText.length / 1000)}k chars)</span>}
                        </div>

                        {flags.length > 0 && (
                            <div className="space-y-3 mt-4">
                                <h4 className="text-sm font-bold text-slate-200">Contract Review Flags</h4>
                                {flags.map((flag, i) => (
                                    <div key={i} className={`p-4 rounded-lg border ${SEVERITY_COLORS[flag.severity] || SEVERITY_COLORS.low}`}>
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold uppercase">{flag.type}</span>
                                                    <span className="text-xs font-bold uppercase px-1.5 py-0.5 rounded bg-white/20">{flag.severity}</span>
                                                </div>
                                                <p className="text-sm font-medium">{flag.clause}</p>
                                                <p className="text-sm">{flag.description}</p>
                                                <p className="text-xs italic">Recommendation: {flag.recommendation}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ TAB B: Risk & Opportunities ═══ */}
            {activeTab === "risk" && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-100">Risk & Opportunity Register</h3>
                        <Button onClick={handleGenerateRisks} disabled={generatingRisks} className="gap-2 bg-purple-600 hover:bg-purple-700">
                            {generatingRisks ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            AI Generate
                        </Button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Risks */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider">Risks ({risks.length})</h4>
                                <Button onClick={() => addRiskItem("risk")} variant="outline" size="sm" className="gap-1 border-slate-700 text-slate-300 h-7 text-xs">
                                    <Plus className="w-3 h-3" /> Add Risk
                                </Button>
                            </div>
                            {risks.map(item => (
                                <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
                                    <input
                                        className="w-full text-sm bg-transparent border-b border-slate-700 pb-1 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                                        placeholder="Risk description..."
                                        value={item.description}
                                        onChange={e => updateRiskItem(item.id, { description: e.target.value })}
                                    />
                                    <div className="flex items-center gap-2">
                                        <select value={item.likelihood} onChange={e => updateRiskItem(item.id, { likelihood: e.target.value as any })}
                                            className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300">
                                            <option value="low">Low Likelihood</option>
                                            <option value="medium">Medium Likelihood</option>
                                            <option value="high">High Likelihood</option>
                                        </select>
                                        <select value={item.impact} onChange={e => updateRiskItem(item.id, { impact: e.target.value as any })}
                                            className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300">
                                            <option value="low">Low Impact</option>
                                            <option value="medium">Medium Impact</option>
                                            <option value="high">High Impact</option>
                                        </select>
                                        <button onClick={() => deleteRiskItem(item.id)} className="ml-auto text-slate-500 hover:text-red-400">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <input
                                        className="w-full text-xs bg-transparent border-b border-slate-800 pb-1 text-slate-400 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                                        placeholder="Mitigation strategy..."
                                        value={item.mitigation || ""}
                                        onChange={e => updateRiskItem(item.id, { mitigation: e.target.value })}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Opportunities */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-green-400 uppercase tracking-wider">Opportunities ({opportunities.length})</h4>
                                <Button onClick={() => addRiskItem("opportunity")} variant="outline" size="sm" className="gap-1 border-slate-700 text-slate-300 h-7 text-xs">
                                    <Plus className="w-3 h-3" /> Add Opportunity
                                </Button>
                            </div>
                            {opportunities.map(item => (
                                <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-2">
                                    <input
                                        className="w-full text-sm bg-transparent border-b border-slate-700 pb-1 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                                        placeholder="Opportunity description..."
                                        value={item.description}
                                        onChange={e => updateRiskItem(item.id, { description: e.target.value })}
                                    />
                                    <div className="flex items-center gap-2">
                                        <select value={item.likelihood} onChange={e => updateRiskItem(item.id, { likelihood: e.target.value as any })}
                                            className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300">
                                            <option value="low">Low Likelihood</option>
                                            <option value="medium">Medium Likelihood</option>
                                            <option value="high">High Likelihood</option>
                                        </select>
                                        <select value={item.impact} onChange={e => updateRiskItem(item.id, { impact: e.target.value as any })}
                                            className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300">
                                            <option value="low">Low Impact</option>
                                            <option value="medium">Medium Impact</option>
                                            <option value="high">High Impact</option>
                                        </select>
                                        <button onClick={() => deleteRiskItem(item.id)} className="ml-auto text-slate-500 hover:text-red-400">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <input
                                        className="w-full text-xs bg-transparent border-b border-slate-800 pb-1 text-slate-400 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                                        placeholder="Action to capture..."
                                        value={item.action || ""}
                                        onChange={e => updateRiskItem(item.id, { action: e.target.value })}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ TAB C: Exclusions & Clarifications ═══ */}
            {activeTab === "exclusions" && (
                <div className="space-y-6">
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm text-blue-300">
                        These will be included automatically in your Proposal.
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-300">Exclusions</label>
                            <Textarea
                                value={contractExclusions}
                                onChange={e => setContractExclusions(e.target.value)}
                                className="min-h-[200px] border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-600"
                                placeholder={"e.g. Asbestos removal\nParty wall works\nPlanning applications\nBuilding control fees"}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-300">Clarifications</label>
                            <Textarea
                                value={contractClarifications}
                                onChange={e => setContractClarifications(e.target.value)}
                                className="min-h-[200px] border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-600"
                                placeholder={"e.g. Works based on drawings ref. A100\nNo asbestos assumed\nExisting drainage is serviceable"}
                            />
                        </div>
                    </div>

                    <Button onClick={handleSaveExclusions} disabled={savingExcl} className="bg-blue-600 hover:bg-blue-700 gap-2">
                        {savingExcl ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Save Exclusions & Clarifications
                    </Button>
                </div>
            )}

            {/* ═══ TAB D: Contract AI Assistant ═══ */}
            {activeTab === "chat" && (
                <div className="space-y-4">
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-300">
                        This tool provides contract risk awareness information, not legal advice. For complex matters, seek professional legal counsel.
                    </div>

                    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                        {/* Messages */}
                        <div className="h-[400px] overflow-y-auto p-4 space-y-4">
                            {chatMessages.length === 0 && (
                                <div className="text-center text-slate-500 py-12 space-y-2">
                                    <MessageSquare className="w-8 h-8 mx-auto opacity-50" />
                                    <p className="text-sm">Ask any question about construction contracts, terms, or risk.</p>
                                    <p className="text-xs text-slate-600">e.g. &quot;What is a retention clause?&quot; or &quot;Is pay-when-paid enforceable in the UK?&quot;</p>
                                </div>
                            )}
                            {chatMessages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${
                                        msg.role === "user"
                                            ? "bg-blue-600 text-white"
                                            : "bg-slate-800 text-slate-200"
                                    }`}>
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                        {msg.role === "assistant" && (
                                            <p className="text-[10px] text-amber-400 mt-2 italic">This is risk awareness information, not legal advice.</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {chatLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-800 rounded-lg px-4 py-2.5">
                                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="border-t border-slate-800 p-3 flex gap-2">
                            <input
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                                placeholder="Ask about contract terms, risks, or obligations..."
                                className="flex-1 h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                            <Button onClick={handleSendChat} disabled={chatLoading || !chatInput.trim()} size="sm" className="bg-blue-600 hover:bg-blue-700 h-10 px-4">
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
